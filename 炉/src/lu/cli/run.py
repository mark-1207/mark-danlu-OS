"""CLI run 命令：单命题全流程运行

参考 docs/02-ARCHITECTURE.md 第 4 节

最小 v1 CLI：
- 接受命题字符串
- 加载默认配置
- 跑 Orchestrator 全 7 步
- 打印最终 Context 摘要

v1 简化：
- 真实 LLM 接入推迟到 v1.1
- 仅支持 --dry-run（mock LLM）和 --echo（echo LLM prompt）两种模式跑通管道
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from lu.config.loader import StyleProfile, load_style_profile
from lu.feedback.models import Feedback
from lu.feedback.store import FeedbackStore
from lu.llm.chain import LLMChain
from lu.llm.errors import LLMError
from lu.llm.providers import OpenAIProvider
from lu.pipeline.orchestrator import Orchestrator
from lu.sediment.obsidian_writer import ObsidianWriter
from lu.state.machine import RunState
from lu.store.file_store import FileStore
from lu.thinking_models.registry import load_default_registries

# 从项目根目录 .env 加载环境变量（覆盖已存在的同名变量）
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_PATH = _PROJECT_ROOT / ".env"
if _ENV_PATH.is_file():
    load_dotenv(_ENV_PATH, override=True)


DEFAULT_STYLE_PATH = "config/style_profile.yaml"
DEFAULT_FEEDBACK_PATH = "config/feedback.jsonl"


_STEP_STATE_MAP = {
    1: RunState.STEP1_DONE,
    2: RunState.STEP2_DONE,
    3: RunState.STEP3_DONE,
    4: RunState.STEP4_DONE,
    5: RunState.STEP5_DONE,
    6: RunState.STEP6_DONE,
    7: RunState.COMPLETED,
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lu",
        description="炉 — ContentForge × PRISM-OS 融合内容创作引擎",
    )
    sub = parser.add_subparsers(dest="command")

    # v3 P0: 新子命令 create / social / recreate
    # create：原创 8 步（替代旧 run）
    _add_create_parser(sub, DEFAULT_STYLE_PATH)
    # social：短内容 4 步全自动
    _add_social_parser(sub)
    # recreate：二创 5 步（链接/文档 + 改写指令）
    _add_recreate_parser(sub)

    # TUI 交互子命令（兼容旧 interactive）
    from lu.cli.interactive import build_parser as build_interactive_parser
    int_p = sub.add_parser("interactive", help="[已废弃] TUI 模式全流程（建议用 lu create）")
    int_p.add_argument("proposition", help="原始命题字符串")
    int_p.add_argument("--style", default="config/style_profile.yaml")
    int_p.add_argument("--dry-run", action="store_true")
    int_p.add_argument("--provider", choices=["openai", "echo"], default=None)
    int_p.add_argument("--model", default="gpt-4o-mini")
    int_p.add_argument("--runs-dir", default=None)

    # 旧 run 子命令（deprecation alias，调用 create）
    run_p = sub.add_parser("run", help="[已废弃] 单命题全流程（建议用 lu create）")
    run_p.add_argument("proposition", help="原始命题字符串")
    _add_common_args(run_p, DEFAULT_STYLE_PATH)

    # 飞书 config 子命令
    from lu.cli.config import build_parser as build_config_parser
    cfg_p = sub.add_parser("config", help="飞书 config 同步")
    cfg_sub = cfg_p.add_subparsers(dest="config_action", required=True)
    for act in ("pull", "push", "sync"):
        sp = cfg_sub.add_parser(act, help=f"{act} config")
        sp.add_argument("--config", default="config/feishu.yaml", help="飞书 config 路径")
        sp.add_argument("--style", default="config/style_profile.yaml", help="本地 style YAML")

    # 旧 viral 子命令（deprecation alias，调用 create --reference）
    from lu.cli.viral import build_parser as build_viral_parser
    vir_p = sub.add_parser("viral", help="[已废弃] 爆款二创（建议用 lu create --reference）")
    vir_p.add_argument("proposition", help="新命题")
    vir_p.add_argument("--reference", required=True, help="参考 URL 或本地文件")
    vir_p.add_argument("--style", default=DEFAULT_STYLE_PATH)
    vir_p.add_argument("--dry-run", action="store_true")
    vir_p.add_argument("--provider", choices=["openai", "echo"], default=None)
    vir_p.add_argument("--model", default="gpt-4o-mini")

    # 复盘 / 雷达 / 周报子命令
    from lu.cli.report import build_parser as build_report_parser
    rpt_p = sub.add_parser("report", help="复盘 / 雷达 / 周报")
    rpt_sub = rpt_p.add_subparsers(dest="report_action", required=True)
    # review
    rv = rpt_sub.add_parser("review", help="复盘")
    rv.add_argument("--runs-dir", default="runs")
    rv.add_argument("--feedback", default="config/feedback.jsonl")
    rv.add_argument("--period", default="all")
    rv.add_argument("--output", default=None)
    # radar
    rd = rpt_sub.add_parser("radar", help="雷达")
    rd.add_argument("--runs-dir", default="runs")
    rd.add_argument("--dry-run", action="store_true")
    rd.add_argument("--provider", choices=["openai", "echo"], default=None)
    rd.add_argument("--model", default="gpt-4o-mini")
    # weekly
    wk = rpt_sub.add_parser("weekly", help="周报")
    wk.add_argument("--runs-dir", default="runs")
    wk.add_argument("--feedback", default="config/feedback.jsonl")
    wk.add_argument("--period", default="本周")
    wk.add_argument("--output", default=None)

    # v2 P0 embedding 子命令
    from lu.cli.embedding import build_parser as build_embedding_parser
    emb_p = sub.add_parser("embed", help="对单文本算 embedding")
    emb_p.add_argument("text", help="要 embedding 的文本")
    emb_p.add_argument("--propositions", default="config/embeddings/propositions.jsonl")
    emb_p.add_argument("--model", default="text-embedding-3-small")
    rec_p = sub.add_parser("recall", help="在素材索引中按 query 召回 top-k")
    rec_p.add_argument("text", help="查询文本")
    rec_p.add_argument("--materials", default="config/embeddings/materials.jsonl")
    rec_p.add_argument("--top-k", type=int, default=3)
    rec_p.add_argument("--kind", default=None)
    rec_p.add_argument("--threshold", type=float, default=0.7)
    rec_p.add_argument("--model", default="text-embedding-3-small")

    return parser


def _add_common_args(parser, default_style_path: str) -> None:
    """加 3 个模式子命令共用的参数"""
    parser.add_argument(
        "--style",
        default=default_style_path,
        help="风格画像 YAML 路径",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="用 echo LLM 跑通管道（不调用真实 LLM）",
    )
    parser.add_argument(
        "--echo-llm",
        action="store_true",
        help="LLM 调用时打印 prompt 到 stderr（调试用）",
    )
    parser.add_argument(
        "--provider",
        choices=["openai", "echo"],
        default=None,
        help="LLM provider（默认需配合 --dry-run 使用 echo）",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="模型名称（仅 openai provider）",
    )
    parser.add_argument(
        "--runs-dir",
        default=None,
        help="运行持久化目录（默认不持久化）",
    )
    parser.add_argument(
        "--obsidian-vault",
        default=None,
        help="Obsidian vault 路径（默认不写入）",
    )
    parser.add_argument(
        "--resume",
        default=None,
        help="续跑指定 run_id（需配合 --runs-dir 与 --from-step）",
    )
    parser.add_argument(
        "--from-step",
        type=int,
        choices=[1, 2, 3, 4, 5, 6, 7, 8],
        default=None,
        help="从第 N 步开始（1-8）",
    )
    parser.add_argument(
        "--feedback-note",
        default=None,
        help="run 完成后记录反馈备注",
    )
    parser.add_argument(
        "--feedback-path",
        default=DEFAULT_FEEDBACK_PATH,
        help="反馈文件路径（默认 config/feedback.jsonl）",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="只输出元数据摘要，不打印完整草稿（默认会打印）",
    )


def _add_create_parser(sub, default_style_path: str) -> None:
    """create 子命令：原创 8 步全流程（替代旧 run）"""
    p = sub.add_parser("create", help="原创内容（8 步全流程，TUI 介入）")
    p.add_argument("proposition", help="原始命题字符串")
    p.add_argument(
        "--reference",
        default=None,
        help="参考 URL 或本地文件（学习爆款结构）",
    )
    _add_common_args(p, default_style_path)


def _add_social_parser(sub) -> None:
    """social 子命令：短内容 4 步全自动（微博/头条/推特）"""
    p = sub.add_parser("social", help="短内容全自动（微博/头条/推特）")
    p.add_argument("proposition", help="原始命题字符串")
    p.add_argument(
        "--platform",
        choices=["weibo", "toutiao", "twitter"],
        default="weibo",
        help="目标平台（默认 weibo）",
    )
    p.add_argument(
        "--length",
        type=int,
        default=300,
        help="目标字数（默认 300）",
    )
    p.add_argument(
        "--provider",
        choices=["openai", "echo"],
        default=None,
        help="LLM provider（默认需配合 --dry-run 使用 echo）",
    )
    p.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="模型名称",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="用 echo LLM 跑通管道",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="只输出元数据摘要",
    )


def _add_recreate_parser(sub) -> None:
    """recreate 子命令：二创 5 步（链接/文档 + 改写指令，必须两条件并存）"""
    p = sub.add_parser("recreate", help="二创（链接/文档 + 改写指令）")
    p.add_argument(
        "--from-url",
        default=None,
        help="原文 URL",
    )
    p.add_argument(
        "--from-file",
        default=None,
        help="原文本地文件",
    )
    p.add_argument(
        "--from-run-id",
        default=None,
        help="从之前 run_id 的 draft 改写",
    )
    p.add_argument(
        "--instruction",
        required=True,
        help="改写指令（如 '改写得更犀利' / '换视角重写'）",
    )
    p.add_argument(
        "--style",
        default=DEFAULT_STYLE_PATH,
        help="风格画像 YAML 路径",
    )
    p.add_argument(
        "--provider",
        choices=["openai", "echo"],
        default=None,
    )
    p.add_argument(
        "--model",
        default="gpt-4o-mini",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
    )
    p.add_argument(
        "--runs-dir",
        default=None,
    )
    p.add_argument(
        "--quiet",
        action="store_true",
    )


def cmd_interactive(args: argparse.Namespace) -> int:
    """分发到 lu.cli.interactive.main"""
    from lu.cli.interactive import main as interactive_main
    argv = [args.proposition]
    if args.dry_run:
        argv.append("--dry-run")
    if args.provider:
        argv.extend(["--provider", args.provider])
    if args.model:
        argv.extend(["--model", args.model])
    if args.runs_dir:
        argv.extend(["--runs-dir", args.runs_dir])
    if args.style:
        argv.extend(["--style", args.style])
    return interactive_main(argv)


def make_echo_llm() -> "callable":
    """Echo LLM：返回符合各阶段格式的占位 JSON"""
    blueprint_json = json.dumps(
        {
            "proposition": "命题",
            "stance": "立场",
            "audience": "读者",
            "core_anti_consensus": "反共识",
            "cases": [],
            "data": [],
            "quotes": [],
            "forbidden": [],
        },
        ensure_ascii=False,
    )

    refined_json = json.dumps(
        {
            "surface": "s",
            "underlying": "u",
            "audience": "a",
            "style_recommendation": {"voice": "v", "tone": "t", "examples": []},
            "contrarian_candidates": [],
            "framework_candidates": [],
            "risks": [],
            "falsifiability": "",
        },
        ensure_ascii=False,
    )

    def llm(prompt: str) -> str:
        if "8 项 JSON" in prompt or "RefinedProposition" in prompt:
            return refined_json
        if "蓝图字段 JSON" in prompt:
            return blueprint_json
        if '"content"' in prompt and "self_confidence" in prompt:
            return json.dumps({"content": "占位内容", "self_confidence": 0.5})
        if "score" in prompt and "details" in prompt:
            return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
        if "修复建议" in prompt:
            return json.dumps({"suggestion": "建议占位"})
        if "内容资产提取器" in prompt:
            return json.dumps(
                {
                    "cases": [],
                    "quotes": [],
                    "insights": [],
                    "contrarian_points": [],
                }
            )
        if "【思想模型" in prompt:
            return "模型占位输出"
        return refined_json

    return llm


def make_echo_user() -> "callable":
    """默认用户输入：循环 6 段非停词答案"""
    answers = [
        "我想讨论 AI 在工作中的实际影响",
        "因为很多人学了 AI 但没赚到钱",
        "互联网运营和产品经理",
        "犀利直接",
        "我朋友 A 是运营 2 年高强度用 LLM 但工资没涨",
        "反过来说，大多数人以为 AI 能涨工资，但实际上它把工作变得便宜",
    ]
    counter = {"i": 0}

    def ask(prompt: str) -> str:
        a = answers[counter["i"] % len(answers)]
        counter["i"] += 1
        return a

    return ask


def make_echo_yes_no() -> "callable":
    def ask(prompt: str) -> bool:
        return True

    return ask


def _build_openai_compatible_chain(model: str) -> LLMChain | None:
    """构造 OpenAI-compatible LLM fallback 链：mimo → kimi

    按 #17 决策：mimo 主，kimi fallback。
    英伟达 NIM chat 当前 key 无法访问常见 chat 模型，默认不加入 fallback；
    如需启用，设置 NVIDIA_CHAT_MODEL 环境变量。

    任一 provider 因缺少 key 构造失败时自动跳过，不阻塞链构造。
    """
    providers: list[callable] = []

    def _try_add(
        api_key_env: str,
        base_url_env: str,
        default_base_url: str,
        model_name: str,
    ) -> None:
        key = os.environ.get(api_key_env)
        if not key:
            return
        base_url = os.environ.get(base_url_env, default_base_url)
        try:
            providers.append(OpenAIProvider(
                api_key=key,
                base_url=base_url,
                model=model_name,
            ))
        except LLMError as e:
            print(
                f"[WARN] 初始化 {api_key_env} provider 失败: {e.message}",
                file=sys.stderr,
            )

    # 1) mimo 主 provider
    _try_add("OPENAI_API_KEY", "OPENAI_BASE_URL", "https://api.openai.com/v1", model)

    # 2) Kimi fallback
    kimi_model = os.environ.get("KIMI_MODEL", "moonshot-v1-128k")
    _try_add("KIMI_API_KEY", "KIMI_BASE_URL", "https://api.moonshot.cn/v1", kimi_model)

    # 3) NVIDIA NIM 兜底（仅当显式配置了 NVIDIA_CHAT_MODEL 时启用）
    nvidia_chat_model = os.environ.get("NVIDIA_CHAT_MODEL")
    if nvidia_chat_model:
        _try_add(
            "NVIDIA_API_KEY",
            "NVIDIA_BASE_URL",
            "https://integrate.api.nvidia.com/v1",
            nvidia_chat_model,
        )

    if not providers:
        print(
            "[ERROR] 没有可用的 OpenAI-compatible LLM provider（请检查 OPENAI_API_KEY / KIMI_API_KEY）",
            file=sys.stderr,
        )
        return None

    return LLMChain(providers)


def cmd_create(args: argparse.Namespace) -> int:
    """create 子命令：原创 8 步全流程（替代旧 run）"""
    recreate_args: dict | None = None
    if getattr(args, "reference", None):
        # 把 --reference 包装成 recreate 形式（学爆款结构）
        recreate_args = {
            "from_url": None,
            "from_file": None,
            "from_run_id": None,
            "instruction": f"学这个参考文章的结构，写新命题：{args.proposition}",
        }
        # 优先用 URL，否则尝试本地文件
        ref = args.reference
        if ref.startswith("http://") or ref.startswith("https://"):
            recreate_args["from_url"] = ref
        else:
            recreate_args["from_file"] = ref
    return _run_pipeline(args, mode="create", recreate_args=recreate_args)


def cmd_run(args: argparse.Namespace) -> int:
    """旧 run 子命令（已废弃）：分发到 create"""
    print(
        "[DEPRECATED] lu run 已废弃，请改用 lu create。",
        file=sys.stderr,
    )
    return cmd_create(args)


def cmd_social(args: argparse.Namespace) -> int:
    """social 子命令：短内容 4 步全自动"""
    social_args = {
        "platform": getattr(args, "platform", "weibo"),
        "length": getattr(args, "length", 300),
    }
    return _run_pipeline(args, mode="social", social_args=social_args)


def cmd_recreate(args: argparse.Namespace) -> int:
    """recreate 子命令：二创 5 步"""
    recreate_args = {
        "from_url": getattr(args, "from_url", None),
        "from_file": getattr(args, "from_file", None),
        "from_run_id": getattr(args, "from_run_id", None),
        "instruction": getattr(args, "instruction", None),
    }
    return _run_pipeline(args, mode="recreate", recreate_args=recreate_args)


def _run_pipeline(
    args: argparse.Namespace,
    *,
    mode: str,
    recreate_args: dict | None = None,
    social_args: dict | None = None,
) -> int:
    """统一的 pipeline 执行入口：3 个模式共用

    1. 加载 style
    2. 构造 LLM
    3. 构造 Orchestrator（按 mode）
    4. 执行 run()
    5. 持久化（obsidian + feedback）
    6. 打印摘要 + 草稿
    """
    style_path = Path(getattr(args, "style", DEFAULT_STYLE_PATH))
    if not style_path.is_file():
        print(f"[WARN] 风格画像不存在: {style_path}，使用默认空画像", file=sys.stderr)
        style = StyleProfile()
    else:
        style = load_style_profile(style_path)

    try:
        model_reg, framework_reg = load_default_registries()
    except Exception as e:
        print(f"[ERROR] 加载默认注册表失败: {e}", file=sys.stderr)
        return 2

    base_llm = _resolve_llm(args)
    if base_llm is None:
        return 2

    file_store: FileStore | None = None
    if getattr(args, "runs_dir", None):
        file_store = FileStore(args.runs_dir)

    from_step = _resolve_from_step(args)

    orch = Orchestrator(
        style_profile=style,
        model_registry=model_reg,
        framework_registry=framework_reg,
        mode=mode,
    )

    proposition = _resolve_proposition(args, mode)
    try:
        ctx = orch.run(
            proposition=proposition,
            llm_call=base_llm,
            ask_user=make_echo_user(),
            ask_yes_no=make_echo_yes_no(),
            file_store=file_store,
            resume_run_id=getattr(args, "resume", None),
            from_step=from_step,
            recreate_args=recreate_args,
            social_args=social_args,
        )
    except LLMError as e:
        print(f"[ERROR] LLM 调用失败 [{e.code}]: {e.message}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"[ERROR] 流程执行失败: {e}", file=sys.stderr)
        return 2

    _persist_outputs(args, ctx)
    _print_results(args, ctx, mode)
    return 0 if ctx.state == RunState.COMPLETED else 1


def _resolve_proposition(args: argparse.Namespace, mode: str) -> str:
    """从 args 取命题；social/recreate 模式也用 proposition 字段"""
    return getattr(args, "proposition", "") or "x"


def _resolve_llm(args: argparse.Namespace):
    """根据 args 决定 LLM"""
    if args.dry_run or args.echo_llm or getattr(args, "provider", None) == "echo":
        base_llm = make_echo_llm()
    elif getattr(args, "provider", None) == "openai":
        base_llm = _build_openai_compatible_chain(model=getattr(args, "model", "gpt-4o-mini"))
        if base_llm is None:
            return None
    else:
        print("[ERROR] 必须指定 --provider 或 --dry-run", file=sys.stderr)
        print("        示例: --provider openai 或 --dry-run", file=sys.stderr)
        return None

    if getattr(args, "echo_llm", False):
        base_llm = _wrap_echo_llm(base_llm)
    return base_llm


def _resolve_from_step(args: argparse.Namespace) -> RunState | None:
    """续跑 from_step 解析"""
    if getattr(args, "resume", None) and not getattr(args, "runs_dir", None):
        print("[ERROR] --resume 必须配合 --runs-dir", file=sys.stderr)
        return None  # type: ignore[return-value]
    if getattr(args, "resume", None) and not getattr(args, "from_step", None):
        print("[ERROR] --resume 必须配合 --from-step", file=sys.stderr)
        return None  # type: ignore[return-value]
    if getattr(args, "from_step", None):
        return _STEP_STATE_MAP[getattr(args, "from_step")]
    return None


def _persist_outputs(args: argparse.Namespace, ctx) -> None:
    """Obsidian 写入 + 反馈记录"""
    if getattr(args, "obsidian_vault", None) and ctx.harvested:
        try:
            writer = ObsidianWriter(args.obsidian_vault)
            paths = writer.write_harvested(ctx.harvested, ctx.run_id or "unknown")
            print(f"[INFO] 已写入 {len(paths)} 条 Obsidian 笔记", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Obsidian 写入失败: {e}", file=sys.stderr)

    if getattr(args, "feedback_note", None) and ctx.state == RunState.COMPLETED:
        try:
            weakest = (
                ctx.quality_report.weakest_dimension
                if ctx.quality_report
                else "未知"
            )
            feedback = Feedback(
                run_id=ctx.run_id,
                proposition=ctx.proposition_cleaned,
                quality_overall_passed=(
                    ctx.quality_report.overall_passed
                    if ctx.quality_report
                    else False
                ),
                weakest_dimension=weakest,
                accepted=True,
                note=args.feedback_note,
            )
            store = FeedbackStore(getattr(args, "feedback_path", DEFAULT_FEEDBACK_PATH))
            store.write(feedback)
            print(f"[INFO] 反馈已记录: {args.feedback_path}", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] 反馈记录失败: {e}", file=sys.stderr)


def _print_results(args: argparse.Namespace, ctx, mode: str) -> None:
    """打印摘要 + 草稿"""
    print(_format_summary(ctx))
    if not getattr(args, "quiet", False) and ctx.draft is not None:
        print()
        print("=" * 60)
        print(f"【完整草稿（{mode}）】")
        print("=" * 60)
        if ctx.draft.title:
            print(f"\n# {ctx.draft.title}\n")
        for section in ctx.draft.sections:
            print(f"\n## {section.role.value}\n")
            if section.content:
                print(section.content)
        print()


def _wrap_echo_llm(llm):
    """包装 LLM：调用前把 prompt 打印到 stderr"""
    def echo_llm(prompt: str) -> str:
        print("-" * 40, file=sys.stderr)
        print(prompt[:500], file=sys.stderr)
        print("-" * 40, file=sys.stderr)
        return llm(prompt)
    return echo_llm


def _format_summary(ctx) -> str:
    lines = [
        "=" * 60,
        f"命题: {ctx.proposition_cleaned}",
        f"状态: {ctx.state.value}",
    ]
    if ctx.refined_proposition:
        lines.append(f"浅层: {ctx.refined_proposition.surface[:60]}")
    if ctx.blueprint:
        lines.append(f"蓝图: {ctx.blueprint.proposition} ({len(ctx.blueprint.sections)} 段)")
    if ctx.draft:
        lines.append(
            f"草稿: {ctx.draft.title} ({ctx.draft.total_word_count} 字, "
            f"失败 {len(ctx.draft.failed_sections)} 段)"
        )
    if ctx.quality_report:
        lines.append(f"质检: overall_passed={ctx.quality_report.overall_passed}")
        lines.append(f"      弱维度: {ctx.quality_report.weakest_dimension}")
    if ctx.harvested:
        lines.append(
            f"沉淀: {len(ctx.harvested.cases)} 案例, "
            f"{len(ctx.harvested.quotes)} 金句, "
            f"{len(ctx.harvested.insights)} 洞察, "
            f"{len(ctx.harvested.forbidden_candidates)} 必避免候选"
        )
    if ctx.style_profile_snapshot:
        lines.append(
            f"风格画像: forbidden {len(ctx.style_profile_snapshot.forbidden)} 项"
        )
    lines.append("=" * 60)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    if argv is None:
        argv = sys.argv[1:]
    _KNOWN_SUBCOMMANDS = (
        "create",
        "social",
        "recreate",
        "run",
        "interactive",
        "config",
        "viral",
        "report",
        "embed",
        "recall",
    )
    if argv and not argv[0].startswith("-") and argv[0] not in _KNOWN_SUBCOMMANDS:
        argv = ["create"] + argv
    args = parser.parse_args(argv)

    if args.command == "create":
        return cmd_create(args)
    if args.command == "social":
        return cmd_social(args)
    if args.command == "recreate":
        return cmd_recreate(args)
    if args.command == "run":
        return cmd_run(args)
    if args.command == "interactive":
        return cmd_interactive(args)
    if args.command == "config":
        from lu.cli.config import cmd_config
        args.action = args.config_action
        return cmd_config(args)
    if args.command == "viral":
        print(
            "[DEPRECATED] lu viral 已废弃，请改用 lu create --reference <url>。",
            file=sys.stderr,
        )
        from lu.cli.viral import main as viral_main
        argv = [args.proposition, "--reference", args.reference]
        if args.dry_run:
            argv.append("--dry-run")
        if args.provider:
            argv.extend(["--provider", args.provider])
        if args.model:
            argv.extend(["--model", args.model])
        if args.style:
            argv.extend(["--style", args.style])
        return viral_main(argv)
    if args.command == "report":
        from lu.cli.report import cmd_report
        args.action = args.report_action
        return cmd_report(args)
    if args.command == "embed":
        from lu.cli.embedding import cmd_embed
        return cmd_embed(args)
    if args.command == "recall":
        from lu.cli.embedding import cmd_recall
        return cmd_recall(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

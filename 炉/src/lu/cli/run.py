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
import sys
from pathlib import Path

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

    run_p = sub.add_parser("run", help="单命题全流程")
    run_p.add_argument("proposition", help="原始命题字符串")
    run_p.add_argument(
        "--style",
        default=DEFAULT_STYLE_PATH,
        help="风格画像 YAML 路径",
    )
    run_p.add_argument(
        "--dry-run",
        action="store_true",
        help="用 echo LLM 跑通管道（不调用真实 LLM）",
    )
    run_p.add_argument(
        "--echo-llm",
        action="store_true",
        help="LLM 调用时打印 prompt 到 stderr（调试用）",
    )
    run_p.add_argument(
        "--provider",
        choices=["openai", "echo"],
        default=None,
        help="LLM provider（默认需配合 --dry-run 使用 echo）",
    )
    run_p.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="模型名称（仅 openai provider）",
    )
    run_p.add_argument(
        "--runs-dir",
        default=None,
        help="运行持久化目录（默认不持久化）",
    )
    run_p.add_argument(
        "--obsidian-vault",
        default=None,
        help="Obsidian vault 路径（默认不写入）",
    )
    run_p.add_argument(
        "--resume",
        default=None,
        help="续跑指定 run_id（需配合 --runs-dir 与 --from-step）",
    )
    run_p.add_argument(
        "--from-step",
        type=int,
        choices=[1, 2, 3, 4, 5, 6, 7],
        default=None,
        help="从第 N 步开始（1-7）",
    )
    run_p.add_argument(
        "--feedback-note",
        default=None,
        help="run 完成后记录反馈备注",
    )
    run_p.add_argument(
        "--feedback-path",
        default=DEFAULT_FEEDBACK_PATH,
        help="反馈文件路径（默认 config/feedback.jsonl）",
    )
    return parser


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


def cmd_run(args: argparse.Namespace) -> int:
    style_path = Path(args.style)
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

    # 确定 LLM
    if args.dry_run or args.echo_llm or args.provider == "echo":
        base_llm = make_echo_llm()
    elif args.provider == "openai":
        try:
            base_llm = LLMChain([OpenAIProvider(model=args.model)])
        except Exception as e:
            print(f"[ERROR] 初始化 OpenAI provider 失败: {e}", file=sys.stderr)
            return 2
    else:
        print("[ERROR] 必须指定 --provider 或 --dry-run", file=sys.stderr)
        print("        示例: --provider openai 或 --dry-run", file=sys.stderr)
        return 2

    if args.echo_llm:
        base_llm = _wrap_echo_llm(base_llm)

    # 可选持久化
    file_store: FileStore | None = None
    if args.runs_dir:
        file_store = FileStore(args.runs_dir)

    # 续跑校验
    if args.resume and not args.runs_dir:
        print("[ERROR] --resume 必须配合 --runs-dir", file=sys.stderr)
        return 2
    if args.resume and not args.from_step:
        print("[ERROR] --resume 必须配合 --from-step", file=sys.stderr)
        return 2

    from_step: RunState | None = None
    if args.from_step:
        from_step = _STEP_STATE_MAP[args.from_step]

    orch = Orchestrator(
        style_profile=style,
        model_registry=model_reg,
        framework_registry=framework_reg,
    )
    try:
        ctx = orch.run(
            proposition=args.proposition,
            llm_call=base_llm,
            ask_user=make_echo_user(),
            ask_yes_no=make_echo_yes_no(),
            file_store=file_store,
            resume_run_id=args.resume,
            from_step=from_step,
        )
    except LLMError as e:
        print(f"[ERROR] LLM 调用失败 [{e.code}]: {e.message}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"[ERROR] 流程执行失败: {e}", file=sys.stderr)
        return 2

    # 可选 Obsidian 写入
    if args.obsidian_vault and ctx.harvested:
        try:
            writer = ObsidianWriter(args.obsidian_vault)
            paths = writer.write_harvested(ctx.harvested, ctx.run_id or "unknown")
            print(f"[INFO] 已写入 {len(paths)} 条 Obsidian 笔记", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Obsidian 写入失败: {e}", file=sys.stderr)

    # 可选反馈记录
    if args.feedback_note and ctx.state == RunState.COMPLETED:
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
            store = FeedbackStore(args.feedback_path)
            store.write(feedback)
            print(f"[INFO] 反馈已记录: {args.feedback_path}", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] 反馈记录失败: {e}", file=sys.stderr)

    print(_format_summary(ctx))
    return 0 if ctx.state == RunState.COMPLETED else 1


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
    # 当用 -m 调用时自动补 "run" 子命令
    if argv is None:
        argv = sys.argv[1:]
    if argv and not argv[0].startswith("-") and argv[0] not in ("run",):
        argv = ["run"] + argv
    args = parser.parse_args(argv)

    if args.command == "run":
        return cmd_run(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

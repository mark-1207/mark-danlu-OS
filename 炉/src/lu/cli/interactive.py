"""CLI interactive 子命令：TUI 模式跑 7 步流程

参考 docs/02-ARCHITECTURE.md v1.2

- 走真实 Socratic 交互（rich.prompt）
- 段位选择走 TUI（select_sections_interactive）
- 其他步骤继续用 LLM（默认 --dry-run 也支持）
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lu.config.loader import StyleProfile, load_style_profile
from lu.llm.chain import LLMChain
from lu.llm.errors import LLMError
from lu.llm.providers import OpenAIProvider
from lu.pipeline.orchestrator import Orchestrator
from lu.state.machine import RunState
from lu.thinking_models.registry import load_default_registries
from lu.tui.prompts import make_ask_user, make_ask_yes_no
from lu.tui.sections import select_sections_interactive


DEFAULT_STYLE_PATH = "config/style_profile.yaml"


def _echo_llm() -> "callable":
    """与 lu.cli.run.make_echo_llm 同款"""
    blueprint_json = json.dumps(
        {
            "proposition": "命题", "stance": "立场", "audience": "读者",
            "core_anti_consensus": "反共识", "cases": [], "data": [],
            "quotes": [], "forbidden": [],
        },
        ensure_ascii=False,
    )
    refined_json = json.dumps(
        {
            "surface": "s", "underlying": "u", "audience": "a",
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
            return json.dumps({"content": "占位", "self_confidence": 0.5})
        if "score" in prompt and "details" in prompt:
            return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
        if "修复建议" in prompt:
            return json.dumps({"suggestion": "建议"})
        if "内容资产提取器" in prompt:
            return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
        if "【思想模型" in prompt:
            return "模型占位输出"
        return refined_json

    return llm


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lu interactive",
        description="TUI 模式跑炉全流程（rich.prompt 交互）",
    )
    parser.add_argument("proposition", help="原始命题字符串")
    parser.add_argument("--style", default=DEFAULT_STYLE_PATH)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="用 echo LLM 跑通管道（不调用真实 LLM）",
    )
    parser.add_argument("--provider", choices=["openai", "echo"], default=None)
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--runs-dir", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    if argv is None:
        argv = sys.argv[1:]
    # 自动补 interactive（虽然 run.py main 会先补，但支持直接调用）
    if argv and argv[0] not in ("--help", "-h"):
        args = parser.parse_args(argv)
    else:
        args = parser.parse_args(argv)

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

    if args.dry_run or args.provider == "echo":
        base_llm = _echo_llm()
    elif args.provider == "openai":
        try:
            base_llm = LLMChain([OpenAIProvider(model=args.model)])
        except Exception as e:
            print(f"[ERROR] 初始化 OpenAI provider 失败: {e}", file=sys.stderr)
            return 2
    else:
        print("[ERROR] 必须指定 --provider 或 --dry-run", file=sys.stderr)
        return 2

    file_store = None
    if args.runs_dir:
        from lu.store.file_store import FileStore
        file_store = FileStore(args.runs_dir)

    from rich.prompt import Prompt
    content_type = Prompt.ask("内容类型 (decision/analysis/perspective/story/reflection)", default="perspective")

    from lu.blueprint.sections import SectionSelector

    # 保存原 select，避免递归
    _original_select = SectionSelector.select

    def _tui_select(blueprint, user_choice):
        # 调用原 select 处理 core + 已有 user_choice，
        # 然后再让用户通过 TUI 添加额外可选段
        bp = _original_select(blueprint, user_choice)
        # 询问 TUI 是否再添加推荐段
        from lu.tui.sections import select_sections_interactive
        return select_sections_interactive(bp, content_type=content_type)

    SectionSelector.select = staticmethod(_tui_select)

    orch = Orchestrator(
        style_profile=style,
        model_registry=model_reg,
        framework_registry=framework_reg,
    )

    try:
        ctx = orch.run(
            proposition=args.proposition,
            llm_call=base_llm,
            ask_user=make_ask_user(),
            ask_yes_no=make_ask_yes_no(),
            file_store=file_store,
        )
    except LLMError as e:
        print(f"[ERROR] LLM 调用失败 [{e.code}]: {e.message}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"[ERROR] 流程执行失败: {e}", file=sys.stderr)
        return 2
    finally:
        SectionSelector.select = _original_select

    print("=" * 60)
    print(f"命题: {ctx.proposition_cleaned}")
    print(f"状态: {ctx.state.value}")
    if ctx.draft:
        print(f"草稿: {ctx.draft.title} ({ctx.draft.total_word_count} 字)")
    if ctx.quality_report:
        print(f"质检: overall_passed={ctx.quality_report.overall_passed}")
    print("=" * 60)
    return 0 if ctx.state == RunState.COMPLETED else 1

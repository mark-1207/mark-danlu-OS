"""CLI report 子命令：review / radar / weekly

- review：从 runs 目录 + feedback 文件生成 Markdown 复盘
- radar：从历史 + LLM 衍生候选命题
- weekly：本周产出 + 趋势 + 沉淀
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lu.feedback.store import FeedbackStore
from lu.llm.chain import LLMChain
from lu.llm.errors import LLMError
from lu.llm.providers import OpenAIProvider
from lu.pipeline.models import Context
from lu.report.radar import suggest_propositions
from lu.report.review import review as do_review
from lu.report.weekly import weekly_report
from lu.store.file_store import FileStore


DEFAULT_RUNS_DIR = "runs"
DEFAULT_FEEDBACK_PATH = "config/feedback.jsonl"


def _echo_llm(_prompt: str = "") -> str:
    return json.dumps(
        {"candidates": [{"proposition": "候选示例", "rationale": "示例", "related_themes": []}]},
        ensure_ascii=False,
    )


def _load_runs(runs_dir: Path) -> list[Context]:
    """从 runs 目录加载所有 Context"""
    if not runs_dir.is_dir():
        return []
    store = FileStore(runs_dir)
    ctxs: list[Context] = []
    for run_id in store.list_runs():
        try:
            ctxs.append(store.load(run_id, "context", Context))
        except Exception:
            continue
    return ctxs


def _load_feedback(path: Path):
    if not path.is_file():
        return []
    return FeedbackStore(path).read_all()


def cmd_review(args: argparse.Namespace) -> int:
    runs_dir = Path(args.runs_dir)
    feedback_path = Path(args.feedback)
    runs = _load_runs(runs_dir)
    feedback = _load_feedback(feedback_path)
    report = do_review(runs, feedback, period=args.period)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"[INFO] 已写入 {args.output}", file=sys.stderr)
    else:
        print(report)
    return 0


def cmd_radar(args: argparse.Namespace) -> int:
    runs_dir = Path(args.runs_dir)
    runs = _load_runs(runs_dir)

    if args.dry_run or args.provider == "echo":
        llm_call = _echo_llm
    elif args.provider == "openai":
        try:
            chain = LLMChain([OpenAIProvider(model=args.model)])
        except Exception as e:
            print(f"[ERROR] 初始化 OpenAI provider 失败: {e}", file=sys.stderr)
            return 2
        llm_call = chain
    else:
        print("[ERROR] 必须指定 --provider 或 --dry-run", file=sys.stderr)
        return 2

    try:
        candidates = suggest_propositions(runs, llm_call)
    except LLMError as e:
        print(f"[ERROR] LLM 调用失败 [{e.code}]: {e.message}", file=sys.stderr)
        return 2

    if not candidates:
        print("(无候选)")
        return 0

    print(f"## 雷达候选（{len(candidates)} 个）")
    for i, c in enumerate(candidates, 1):
        print(f"{i}. **{c.proposition}**")
        print(f"   理由：{c.rationale}")
        if c.related_themes:
            print(f"   关联：{', '.join(c.related_themes)}")
    return 0


def cmd_weekly(args: argparse.Namespace) -> int:
    runs_dir = Path(args.runs_dir)
    feedback_path = Path(args.feedback)
    runs = _load_runs(runs_dir)
    feedback = _load_feedback(feedback_path)
    report = weekly_report(runs, feedback, period=args.period)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"[INFO] 已写入 {args.output}", file=sys.stderr)
    else:
        print(report)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lu report")
    sub = parser.add_subparsers(dest="action", required=True)

    # review
    p = sub.add_parser("review", help="复盘")
    p.add_argument("--runs-dir", default=DEFAULT_RUNS_DIR)
    p.add_argument("--feedback", default=DEFAULT_FEEDBACK_PATH)
    p.add_argument("--period", default="all", help="all / 7d / 30d / etc")
    p.add_argument("--output", default=None, help="写入文件（默认 stdout）")

    # radar
    p = sub.add_parser("radar", help="雷达")
    p.add_argument("--runs-dir", default=DEFAULT_RUNS_DIR)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--provider", choices=["openai", "echo"], default=None)
    p.add_argument("--model", default="gpt-4o-mini")

    # weekly
    p = sub.add_parser("weekly", help="周报")
    p.add_argument("--runs-dir", default=DEFAULT_RUNS_DIR)
    p.add_argument("--feedback", default=DEFAULT_FEEDBACK_PATH)
    p.add_argument("--period", default="本周")
    p.add_argument("--output", default=None)

    return parser


def cmd_report(args: argparse.Namespace) -> int:
    if args.action == "review":
        return cmd_review(args)
    if args.action == "radar":
        return cmd_radar(args)
    if args.action == "weekly":
        return cmd_weekly(args)
    return 2


__all__ = ["build_parser", "cmd_report", "cmd_review", "cmd_radar", "cmd_weekly"]

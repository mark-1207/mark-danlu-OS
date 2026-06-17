"""CLI viral 子命令：爆款二创

参考 docs/02-ARCHITECTURE.md v1.3
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lu.config.loader import StyleProfile, load_style_profile
from lu.ingest.article import IngestError, fetch_url, read_file
from lu.llm.chain import LLMChain
from lu.llm.errors import LLMError
from lu.llm.providers import OpenAIProvider
from lu.state.machine import RunState
from lu.thinking_models.registry import load_default_registries
from lu.viral.pipeline import remix


DEFAULT_STYLE_PATH = "config/style_profile.yaml"


def _echo_llm() -> "callable":
    """最小 echo LLM（viral 用最少 prompt 集）"""
    refined = json.dumps(
        {
            "hook": "s", "contrarian": "s", "case_summary": "s",
            "thinking_model": "s", "closing_quote": "s",
            "key_terms": [], "contrarian_signals": [],
        },
        ensure_ascii=False,
    )
    blueprint = json.dumps(
        {
            "proposition": "p", "stance": "s", "audience": "a",
            "core_anti_consensus": "c", "cases": [], "data": [],
            "quotes": [], "forbidden": [],
        },
        ensure_ascii=False,
    )

    def llm(prompt: str) -> str:
        if "爆款结构" in prompt or "核心反共识" in prompt:
            return refined
        if "蓝图字段" in prompt:
            return blueprint
        if '"content"' in prompt and "self_confidence" in prompt:
            return json.dumps({"content": "占位", "self_confidence": 0.5})
        if "score" in prompt and "details" in prompt:
            return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
        if "内容资产提取器" in prompt:
            return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
        if "【思想模型" in prompt:
            return "m"
        return refined

    return llm


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lu viral", description="爆款二创")
    parser.add_argument("proposition", help="新命题字符串")
    parser.add_argument("--reference", required=True, help="参考文章 URL 或本地文件路径")
    parser.add_argument("--style", default=DEFAULT_STYLE_PATH)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--provider", choices=["openai", "echo"], default=None)
    parser.add_argument("--model", default="gpt-4o-mini")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    if argv is None:
        argv = sys.argv[1:]
    args = parser.parse_args(argv)

    # 摄入参考
    try:
        ref_path = Path(args.reference)
        if ref_path.is_file():
            ref_text = read_file(ref_path)
            source_url = None
        else:
            ref_text = fetch_url(args.reference)
            source_url = args.reference
    except IngestError as e:
        print(f"[ERROR] 摄入失败: {e}", file=sys.stderr)
        return 2

    # style
    style_path = Path(args.style)
    if not style_path.is_file():
        style = StyleProfile()
    else:
        try:
            style = load_style_profile(style_path)
        except Exception as e:
            print(f"[ERROR] 风格画像加载失败: {e}", file=sys.stderr)
            return 2

    # LLM
    if args.dry_run or args.provider == "echo":
        llm_call = _echo_llm()
    elif args.provider == "openai":
        try:
            llm_call = LLMChain([OpenAIProvider(model=args.model)])
        except Exception as e:
            print(f"[ERROR] 初始化 OpenAI provider 失败: {e}", file=sys.stderr)
            return 2
    else:
        print("[ERROR] 必须指定 --provider 或 --dry-run", file=sys.stderr)
        return 2

    # 跑
    try:
        result = remix(
            new_proposition=args.proposition,
            reference_text=ref_text,
            llm_call=llm_call,
            style=style,
            source_url=source_url,
        )
    except LLMError as e:
        print(f"[ERROR] LLM 调用失败 [{e.code}]: {e.message}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"[ERROR] 二创失败: {e}", file=sys.stderr)
        return 2

    print("=" * 60)
    print(f"新命题: {args.proposition}")
    if result["structure"].hook:
        print(f"参考钩子: {result['structure'].hook[:60]}")
    print(f"草稿: {result['draft'].title} ({result['draft'].total_word_count} 字)")
    if result["quality_report"]:
        print(f"质检: overall_passed={result['quality_report'].overall_passed}")
    print(f"沉淀: {len(result['harvested'].cases)} 案例, "
          f"{len(result['harvested'].quotes)} 金句, "
          f"{len(result['harvested'].insights)} 洞察")
    print("=" * 60)
    return 0


__all__ = ["main", "build_parser"]

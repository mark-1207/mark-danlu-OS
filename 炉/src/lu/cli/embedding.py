"""CLI embed / recall 子命令

embed: 对单文本算 embedding 并打印（不写入）
recall: 在 materials.jsonl 中按 query 召回 top-k
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from lu.embedding.factory import EmbeddingFactory
from lu.embedding.index import EmbeddingIndex
from lu.embedding.recall import RecallHit
from lu.llm.errors import LLMError

# 从项目根目录 .env 加载环境变量
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_PATH = _PROJECT_ROOT / ".env"
if _ENV_PATH.is_file():
    load_dotenv(_ENV_PATH, override=True)


DEFAULT_PROPOSITIONS = "data/embeddings/propositions.jsonl"
DEFAULT_MATERIALS = "data/embeddings/materials.jsonl"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lu-embedding", add_help=False)
    sub = parser.add_subparsers(dest="command", required=True)

    # embed
    emb_p = sub.add_parser("embed", help="对单文本算 embedding")
    emb_p.add_argument("text", help="要 embedding 的文本")
    emb_p.add_argument("--propositions", default=DEFAULT_PROPOSITIONS, help="命题索引路径")
    emb_p.add_argument("--model", default=None, help="模型名（默认读 LU_EMBEDDING_MODEL）")

    # recall
    rec_p = sub.add_parser("recall", help="在素材索引中按 query 召回 top-k")
    rec_p.add_argument("text", help="查询文本")
    rec_p.add_argument("--materials", default=DEFAULT_MATERIALS, help="素材索引路径")
    rec_p.add_argument("--top-k", type=int, default=3, help="召回数量")
    rec_p.add_argument("--kind", default=None, help="按 kind 过滤（case/quote/insight）")
    rec_p.add_argument("--threshold", type=float, default=0.7, help="相似度阈值")
    rec_p.add_argument("--model", default=None, help="模型名（默认读 LU_EMBEDDING_MODEL）")

    return parser


def cmd_embed(args: argparse.Namespace) -> int:
    try:
        chain = EmbeddingFactory.from_env(model=args.model)
    except LLMError as e:
        print(f"[ERROR] {e.message} [{e.code}]", file=sys.stderr)
        return 2

    try:
        result = chain.embed(args.text)
    except LLMError as e:
        print(f"[ERROR] embedding 失败: {e.message} [{e.code}]", file=sys.stderr)
        return 2

    # 打印：dim + 前 8 个值
    preview = result.embedding[:8]
    dim = len(result.embedding)
    print(
        json.dumps(
            {
                "model": result.model,
                "dim": dim,
                "tokens": result.tokens,
                "preview": preview,
            },
            ensure_ascii=False,
        )
    )
    print(f"# dim={dim}, tokens={result.tokens}", file=sys.stderr)
    return 0


def cmd_recall(args: argparse.Namespace) -> int:
    try:
        chain = EmbeddingFactory.from_env(model=args.model)
    except LLMError as e:
        print(f"[ERROR] {e.message} [{e.code}]", file=sys.stderr)
        return 2

    idx_path = Path(args.materials)
    if not idx_path.is_file():
        print(f"[WARN] 素材索引不存在: {idx_path}（无召回）", file=sys.stderr)
        print(json.dumps([], ensure_ascii=False))
        return 0

    try:
        result = chain.embed(args.text)
    except LLMError as e:
        print(f"[ERROR] embedding 失败: {e.message} [{e.code}]", file=sys.stderr)
        return 2

    idx = EmbeddingIndex(idx_path)
    hits = idx.recall(
        query=result.embedding,
        top_k=args.top_k,
        threshold=args.threshold,
        kind=args.kind,
    )

    print(json.dumps(_hits_to_dicts(hits), ensure_ascii=False, indent=2))
    print(f"# 召回 {len(hits)} 条（top_k={args.top_k}, threshold={args.threshold}）", file=sys.stderr)
    return 0


def _hits_to_dicts(hits: list[RecallHit]) -> list[dict]:
    return [
        {
            "id": h.id,
            "kind": h.kind,
            "text": h.text,
            "source": h.source,
            "tags": h.tags,
            "score": round(h.score, 4),
        }
        for h in hits
    ]


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "embed":
        return cmd_embed(args)
    if args.command == "recall":
        return cmd_recall(args)
    parser.print_help()
    return 1


__all__ = ["build_parser", "cmd_embed", "cmd_recall", "main"]


if __name__ == "__main__":
    raise SystemExit(main())

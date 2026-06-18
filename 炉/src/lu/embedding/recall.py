"""recall: cosine similarity + recall_materials 高层封装"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from lu.embedding.types import EmbeddingProvider, EmbeddingResult


@dataclass
class RecallHit:
    """单条召回结果"""

    id: str
    kind: str
    text: str
    source: str
    tags: list[str] = field(default_factory=list)
    score: float = 0.0


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """cosine 相似度

    - 同向量 = 1.0
    - 正交 = 0.0
    - 反向 = -1.0
    - 零向量 = 0.0（无方向）
    - 维度不一致抛 ValueError
    """
    if len(a) != len(b):
        raise ValueError(f"维度不一致: {len(a)} vs {len(b)}")
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def recall_materials(
    chain: EmbeddingProvider,
    index: "object",  # EmbeddingIndex（避免循环 import）
    query: str,
    *,
    top_k: int = 3,
    threshold: float = 0.7,
    kind: str | None = None,
) -> list[RecallHit]:
    """高层封装：用 chain 把 query 转成向量，再用 index.recall 召回

    chain: 任何实现 .embed(str) -> EmbeddingResult 的对象（含 EmbeddingChain）
    index: 有 .recall(query, top_k, threshold, kind) 方法的对象
    """
    result = chain.embed(query)
    return index.recall(
        query=result.embedding, top_k=top_k, threshold=threshold, kind=kind
    )


__all__ = ["RecallHit", "cosine_similarity", "recall_materials"]

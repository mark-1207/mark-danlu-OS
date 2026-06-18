"""Embedding types: Protocol + Result dataclass"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class EmbeddingResult:
    """单次 embedding 调用的结果"""

    embedding: list[float]
    model: str
    tokens: int = 0


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Embedding provider 协议

    实现要求：
    - name: 标识（用于日志 / chain）
    - embed(text) -> EmbeddingResult：同步调用，返回向量
    """

    name: str

    def embed(self, text: str) -> EmbeddingResult: ...


__all__ = ["EmbeddingResult", "EmbeddingProvider"]

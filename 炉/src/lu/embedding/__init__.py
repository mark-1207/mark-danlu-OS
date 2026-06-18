"""embedding: Embedding provider + chain + index + recall"""
from __future__ import annotations

from lu.embedding.chain import EmbeddingChain
from lu.embedding.factory import EmbeddingFactory
from lu.embedding.hook import EmbeddingHook, SimilarProposition
from lu.embedding.index import EmbeddingIndex, IndexedRecord
from lu.embedding.providers import OpenAIEmbeddingProvider
from lu.embedding.recall import RecallHit, cosine_similarity, recall_materials
from lu.embedding.types import EmbeddingProvider, EmbeddingResult

__all__ = [
    "EmbeddingChain",
    "EmbeddingFactory",
    "EmbeddingHook",
    "EmbeddingIndex",
    "EmbeddingProvider",
    "EmbeddingResult",
    "IndexedRecord",
    "OpenAIEmbeddingProvider",
    "RecallHit",
    "SimilarProposition",
    "cosine_similarity",
    "recall_materials",
]

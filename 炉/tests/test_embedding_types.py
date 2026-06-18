"""Embedding types 测试

- EmbeddingResult 字段完整
- EmbeddingProvider Protocol 存在
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import pytest

from lu.embedding.types import EmbeddingProvider, EmbeddingResult


class TestEmbeddingResult:
    def test_fields(self) -> None:
        r = EmbeddingResult(embedding=[0.1, 0.2, 0.3], model="text-embedding-3-small", tokens=3)
        assert r.embedding == [0.1, 0.2, 0.3]
        assert r.model == "text-embedding-3-small"
        assert r.tokens == 3

    def test_default_tokens(self) -> None:
        r = EmbeddingResult(embedding=[0.1], model="m")
        assert r.tokens == 0

    def test_can_be_used_as_dict_value(self) -> None:
        r = EmbeddingResult(embedding=[1.0], model="m", tokens=1)
        d = {"emb": r}
        assert d["emb"].embedding == [1.0]


class TestEmbeddingProviderProtocol:
    def test_protocol_is_runtime_checkable(self) -> None:
        @runtime_checkable
        class _DummyProto(Protocol):
            def embed(self, text: str) -> EmbeddingResult: ...

        # OpenAIProvider-style class
        class _Good:
            name = "good"

            def embed(self, text: str) -> EmbeddingResult:
                return EmbeddingResult(embedding=[1.0], model="m")

        class _Bad:
            name = "bad"

        assert isinstance(_Good(), _DummyProto)
        assert not isinstance(_Bad(), _DummyProto)

    def test_provider_protocol_has_embed_and_name(self) -> None:
        @runtime_checkable
        class _Proto(Protocol):
            name: str

            def embed(self, text: str) -> EmbeddingResult: ...

        class _Impl:
            name = "impl"

            def embed(self, text: str) -> EmbeddingResult:
                return EmbeddingResult(embedding=[1.0], model="m")

        assert hasattr(_Impl(), "name")
        assert hasattr(_Impl(), "embed")


def test_module_imports() -> None:
    """确保公开 API 完整"""
    assert EmbeddingResult is not None
    assert EmbeddingProvider is not None

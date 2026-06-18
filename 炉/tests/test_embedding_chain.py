"""EmbeddingChain 测试

- primary 成功直接返回
- primary 失败 → fallback
- 全部失败抛错
- 兼容 Callable[[str], EmbeddingResult] 注入
"""
from __future__ import annotations

import pytest

from lu.embedding.chain import EmbeddingChain
from lu.embedding.types import EmbeddingResult
from lu.llm.errors import LLMError


def _ok(text: str) -> EmbeddingResult:
    return EmbeddingResult(embedding=[1.0, 0.0], model="ok", tokens=len(text))


def _err(text: str) -> EmbeddingResult:
    raise LLMError("boom", code="SERVER")


class TestEmbeddingChain:
    def test_first_provider_success(self) -> None:
        chain = EmbeddingChain([_ok])
        r = chain.embed("hi")
        assert r.embedding == [1.0, 0.0]

    def test_fallback_to_second(self) -> None:
        chain = EmbeddingChain([_err, _ok])
        r = chain.embed("hi")
        assert r.embedding == [1.0, 0.0]

    def test_all_fail_raises_last_error(self) -> None:
        chain = EmbeddingChain([_err, _err])
        with pytest.raises(LLMError) as exc:
            chain.embed("hi")
        assert exc.value.code == "SERVER"

    def test_retries_within_provider(self) -> None:
        """同一 provider 失败时重试 max_retries 次"""
        attempts = {"n": 0}

        def flaky(text: str) -> EmbeddingResult:
            attempts["n"] += 1
            if attempts["n"] < 2:
                raise LLMError("transient", code="SERVER")
            return EmbeddingResult(embedding=[0.5], model="ok", tokens=1)

        chain = EmbeddingChain([flaky], max_retries=3, backoff_seconds=(0.0, 0.0, 0.0))
        r = chain.embed("hi")
        assert r.embedding == [0.5]
        assert attempts["n"] == 2

    def test_max_retries_exhausted_falls_back(self) -> None:
        attempts = {"n": 0}

        def always_fail(text: str) -> EmbeddingResult:
            attempts["n"] += 1
            raise LLMError("nope", code="SERVER")

        chain = EmbeddingChain([always_fail, _ok], max_retries=2, backoff_seconds=(0.0, 0.0))
        r = chain.embed("hi")
        assert r.embedding == [1.0, 0.0]
        assert attempts["n"] == 2  # 重试 2 次后切下一个

    def test_no_providers_raises(self) -> None:
        chain = EmbeddingChain([])
        with pytest.raises(LLMError) as exc:
            chain.embed("hi")
        assert exc.value.code == "UNKNOWN"

    def test_call_dunder(self) -> None:
        chain = EmbeddingChain([_ok])
        r = chain("hi")
        assert r.embedding == [1.0, 0.0]

    def test_default_max_retries_is_3(self) -> None:
        chain = EmbeddingChain([_ok])
        assert chain.max_retries == 3

    def test_provider_with_provider_objects(self) -> None:
        """能接受带 name/embed 的对象（Protocol 兼容）"""
        from lu.embedding.types import EmbeddingProvider

        class _P:
            name = "p1"

            def embed(self, text: str) -> EmbeddingResult:
                return EmbeddingResult(embedding=[0.7], model="m", tokens=1)

        chain = EmbeddingChain([_P()])  # type: ignore[list-item]
        r = chain.embed("x")
        assert r.embedding == [0.7]

"""LLM Chain 测试

- 正常返回
- 5xx 重试 3 次后 fallback
- 超时 fallback
- 全部失败抛 LLMError
"""
from __future__ import annotations

from unittest.mock import Mock

import pytest

from lu.llm.chain import LLMChain
from lu.llm.errors import LLMError


class _OkProvider:
    def __init__(self, text: str = "ok") -> None:
        self.text = text
        self.calls = 0

    def __call__(self, prompt: str) -> str:
        self.calls += 1
        return self.text


class _FailProvider:
    def __init__(self, code: str = "SERVER") -> None:
        self.code = code
        self.calls = 0

    def __call__(self, prompt: str) -> str:
        self.calls += 1
        raise LLMError(f"fail", code=self.code)


class TestLLMChain:
    def test_first_provider_succeeds(self) -> None:
        p1 = _OkProvider("first")
        p2 = _OkProvider("second")
        chain = LLMChain([p1, p2])

        assert chain.call("prompt") == "first"
        assert p1.calls == 1
        assert p2.calls == 0

    def test_falls_back_on_failure(self) -> None:
        p1 = _FailProvider("SERVER")
        p2 = _OkProvider("fallback")
        chain = LLMChain([p1, p2], max_retries=1, backoff_seconds=())

        assert chain.call("prompt") == "fallback"
        assert p1.calls == 1
        assert p2.calls == 1

    def test_retries_failed_provider_before_fallback(self) -> None:
        p1 = _FailProvider("SERVER")
        p2 = _OkProvider("fallback")
        chain = LLMChain([p1, p2], max_retries=3, backoff_seconds=())

        assert chain.call("prompt") == "fallback"
        assert p1.calls == 3
        assert p2.calls == 1

    def test_raises_when_all_providers_fail(self) -> None:
        p1 = _FailProvider("SERVER")
        p2 = _FailProvider("TIMEOUT")
        chain = LLMChain([p1, p2], max_retries=2, backoff_seconds=())

        with pytest.raises(LLMError) as exc:
            chain.call("prompt")

        assert p1.calls == 2
        assert p2.calls == 2
        assert exc.value.code == "TIMEOUT"

    def test_call_signature_matches_injection(self) -> None:
        """LLMChain.call 是 Callable[[str], str]，可直接注入现有模块"""
        chain = LLMChain([_OkProvider("x")])
        assert callable(chain)
        assert chain.call("p") == "x"

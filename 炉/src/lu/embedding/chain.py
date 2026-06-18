"""EmbeddingChain：多 Provider 重试 + fallback

与 LLMChain 同模式：依次尝试 providers，每个 provider 失败时重试 max_retries 次，
全部失败后切下一个 provider；最后抛最后一个错误。
"""
from __future__ import annotations

import time
from typing import Callable, Union

from lu.embedding.types import EmbeddingProvider, EmbeddingResult
from lu.llm.errors import LLMError


# 既支持 Protocol 对象，也支持 Callable[[str], EmbeddingResult]
ProviderLike = Union[EmbeddingProvider, Callable[[str], EmbeddingResult]]


class EmbeddingChain:
    """Embedding 调用链

    embed(text) -> EmbeddingResult
    __call__(text) -> EmbeddingResult（兼容 Callable 注入）
    """

    def __init__(
        self,
        providers: list[ProviderLike],
        *,
        max_retries: int = 3,
        backoff_seconds: tuple[float, ...] = (0.5, 1.0, 2.0),
    ) -> None:
        self.providers = providers
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds

    def _call_provider(self, provider: ProviderLike, text: str) -> EmbeddingResult:
        # 优先用 .embed（Protocol 对象），否则直接当 Callable 调
        if hasattr(provider, "embed") and callable(getattr(provider, "embed", None)):
            embed = getattr(provider, "embed")
            return embed(text)
        return provider(text)  # type: ignore[call-arg]

    def embed(self, text: str) -> EmbeddingResult:
        last_error: LLMError | None = None

        for provider in self.providers:
            for attempt in range(self.max_retries):
                try:
                    return self._call_provider(provider, text)
                except LLMError as e:
                    last_error = e
                    if (
                        attempt < self.max_retries - 1
                        and attempt < len(self.backoff_seconds)
                    ):
                        time.sleep(self.backoff_seconds[attempt])

        if last_error:
            raise last_error
        raise LLMError("没有可用的 embedding provider", code="UNKNOWN")

    def __call__(self, text: str) -> EmbeddingResult:
        return self.embed(text)


__all__ = ["EmbeddingChain", "ProviderLike"]

"""LLMChain：多 Provider 重试 + fallback"""
from __future__ import annotations

import time
from typing import Callable

from lu.llm.errors import LLMError


class LLMChain:
    """LLM 调用链

    依次尝试 providers，每个 provider 失败时重试 max_retries 次，
    全部失败后抛出最后一个错误。

    call(prompt: str) -> str 兼容现有 Callable[[str], str] 注入。
    """

    def __init__(
        self,
        providers: list[Callable[[str], str]],
        *,
        max_retries: int = 3,
        backoff_seconds: tuple[float, ...] = (1.0, 2.0, 4.0),
    ) -> None:
        self.providers = providers
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds

    def call(self, prompt: str) -> str:
        last_error: LLMError | None = None

        for provider in self.providers:
            for attempt in range(self.max_retries):
                try:
                    return provider(prompt)
                except LLMError as e:
                    last_error = e
                    if attempt < self.max_retries - 1 and attempt < len(self.backoff_seconds):
                        time.sleep(self.backoff_seconds[attempt])

        if last_error:
            raise last_error
        raise LLMError("没有可用的 LLM provider", code="UNKNOWN")

    def __call__(self, prompt: str) -> str:
        return self.call(prompt)

"""LLM 错误定义"""
from __future__ import annotations


class LLMError(Exception):
    """LLM 调用失败

    code: AUTH / TIMEOUT / SERVER / RATE_LIMIT / UNKNOWN
    """

    def __init__(self, message: str, code: str = "UNKNOWN") -> None:
        super().__init__(message)
        self.code = code
        self.message = message

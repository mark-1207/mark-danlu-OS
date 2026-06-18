"""OpenAI-compatible Embedding Provider

支持任意 OpenAI-compatible /embeddings 端点：
- OpenAI 默认：text-embedding-3-small (1536 维)
- NVIDIA NIM：nvidia/nv-embedqa-e5-v5
- OpenRouter：通过 OpenAI-compatible 端点
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import httpx

from lu.llm.errors import LLMError


_DEFAULT_BASE_URL = "https://api.openai.com/v1"
_DEFAULT_MODEL = "text-embedding-3-small"


@dataclass
class OpenAIEmbeddingProvider:
    """OpenAI-compatible embedding provider

    与 lu.llm.providers.OpenAIProvider 协议一致，但调 /embeddings。
    """

    api_key: str | None = None
    base_url: str | None = None
    model: str = _DEFAULT_MODEL
    timeout_sec: float = 60.0
    name: str = "openai"

    def __post_init__(self) -> None:
        key = self.api_key or os.environ.get("OPENAI_API_KEY", "")
        if not key:
            raise LLMError("OPENAI_API_KEY 未设置或为空", code="AUTH")
        self.api_key = key
        self.base_url = (self.base_url or _DEFAULT_BASE_URL).rstrip("/")

    def _build_payload(self, text: str) -> dict[str, Any]:
        return {"model": self.model, "input": text}

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code == 401:
            raise LLMError(f"鉴权失败: {response.text}", code="AUTH")
        if response.status_code == 429:
            raise LLMError(f"限流: {response.text}", code="RATE_LIMIT")
        if response.status_code >= 500:
            raise LLMError(f"服务端错误 {response.status_code}: {response.text}", code="SERVER")
        if response.status_code >= 400:
            raise LLMError(f"请求错误 {response.status_code}: {response.text}", code="SERVER")

    def _parse_response(self, response: httpx.Response) -> tuple[list[float], int]:
        try:
            data = response.json()
        except (json.JSONDecodeError, ValueError) as e:
            raise LLMError(f"响应不是合法 JSON: {e}", code="UNKNOWN") from e

        try:
            embedding = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError) as e:
            raise LLMError(f"响应格式异常: {data}", code="UNKNOWN") from e

        tokens = 0
        usage = data.get("usage") or {}
        if isinstance(usage, dict):
            tokens = int(usage.get("total_tokens", 0) or 0)

        if not isinstance(embedding, list):
            raise LLMError(f"embedding 字段不是 list: {type(embedding)}", code="UNKNOWN")

        return embedding, tokens

    def embed(self, text: str) -> EmbeddingResult:
        """同步 embedding 调用"""
        from lu.embedding.types import EmbeddingResult

        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(text)

        try:
            with httpx.Client(timeout=self.timeout_sec) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as e:
            raise LLMError(f"请求超时: {e}", code="TIMEOUT") from e
        except httpx.NetworkError as e:
            raise LLMError(f"网络错误: {e}", code="SERVER") from e

        self._raise_for_status(response)
        embedding, tokens = self._parse_response(response)
        return EmbeddingResult(embedding=embedding, model=self.model, tokens=tokens)

    def __call__(self, text: str) -> EmbeddingResult:
        return self.embed(text)


__all__ = ["OpenAIEmbeddingProvider"]

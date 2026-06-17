"""OpenAI-compatible LLM Provider

同步调用，返回字符串。
v1.1 仅实现 OpenAI-compatible；后续可扩展 Kimi/Anthropic。
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx

from lu.llm.errors import LLMError


class OpenAIProvider:
    """OpenAI-compatible provider"""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str = "gpt-4o-mini",
        timeout_sec: float = 60.0,
    ) -> None:
        key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not key:
            raise LLMError(
                "OPENAI_API_KEY 未设置或为空",
                code="AUTH",
            )
        self.api_key = key
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.model = model
        self.timeout_sec = timeout_sec

    def _build_payload(self, prompt: str) -> dict[str, Any]:
        return {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
        }

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code == 401:
            raise LLMError(f"鉴权失败: {response.text}", code="AUTH")
        if response.status_code == 429:
            raise LLMError(f"限流: {response.text}", code="RATE_LIMIT")
        if response.status_code >= 500:
            raise LLMError(f"服务端错误 {response.status_code}: {response.text}", code="SERVER")
        if response.status_code >= 400:
            raise LLMError(f"请求错误 {response.status_code}: {response.text}", code="SERVER")

    def _parse_response(self, response: httpx.Response) -> str:
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            raise LLMError(f"响应不是合法 JSON: {e}", code="UNKNOWN") from e

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as e:
            raise LLMError(f"响应格式异常: {data}", code="UNKNOWN") from e

        return content.strip()

    def call(self, prompt: str) -> str:
        """同步调用 LLM，返回文本"""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(prompt)

        try:
            with httpx.Client(timeout=self.timeout_sec) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as e:
            raise LLMError(f"请求超时: {e}", code="TIMEOUT") from e
        except httpx.NetworkError as e:
            raise LLMError(f"网络错误: {e}", code="SERVER") from e

        self._raise_for_status(response)
        return self._parse_response(response)

    def __call__(self, prompt: str) -> str:
        return self.call(prompt)

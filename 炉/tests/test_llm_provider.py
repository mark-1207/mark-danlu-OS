"""LLM Provider 测试

- OpenAIProvider 缺失 key 报错
- mock httpx 返回解析
- 基础 URL / model 可配置
"""
from __future__ import annotations

from unittest.mock import Mock, patch

import httpx
import pytest

from lu.llm.errors import LLMError
from lu.llm.providers import OpenAIProvider


class TestOpenAIProvider:
    def test_raises_when_api_key_missing(self) -> None:
        with pytest.raises(LLMError) as exc:
            OpenAIProvider(api_key="", model="gpt-4")
        assert exc.value.code == "AUTH"

    def test_call_parses_chat_completion_response(self) -> None:
        provider = OpenAIProvider(api_key="test-key", model="gpt-4")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "  模型输出  "}}],
        }

        with patch("lu.llm.providers.httpx.Client.post", return_value=mock_response):
            result = provider.call("你好")

        assert result == "模型输出"

    def test_call_raises_on_http_error(self) -> None:
        provider = OpenAIProvider(api_key="test-key", model="gpt-4")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Unauthorized", request=Mock(), response=mock_response
        )

        with patch("lu.llm.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.call("你好")
            assert exc.value.code == "AUTH"

    def test_base_url_defaults_to_openai(self) -> None:
        provider = OpenAIProvider(api_key="k", model="gpt-4")
        assert provider.base_url == "https://api.openai.com/v1"

    def test_custom_base_url(self) -> None:
        provider = OpenAIProvider(api_key="k", model="gpt-4", base_url="https://api.example.com/v1")
        assert provider.base_url == "https://api.example.com/v1"

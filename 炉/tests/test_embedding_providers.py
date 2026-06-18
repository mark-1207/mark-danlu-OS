"""Embedding Provider 测试

- OpenAIEmbeddingProvider 缺失 key 报错
- 调 /v1/embeddings 解析返回
- 鉴权/限流/服务端错误 → LLMError
- 默认 base_url + 可配置
"""
from __future__ import annotations

from unittest.mock import Mock, patch

import httpx
import pytest

from lu.embedding.providers import OpenAIEmbeddingProvider
from lu.llm.errors import LLMError


class TestOpenAIEmbeddingProviderInit:
    def test_raises_when_api_key_missing(self) -> None:
        with pytest.raises(LLMError) as exc:
            OpenAIEmbeddingProvider(api_key="", model="text-embedding-3-small")
        assert exc.value.code == "AUTH"

    def test_raises_when_api_key_none_and_env_empty(self, monkeypatch) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        with pytest.raises(LLMError) as exc:
            OpenAIEmbeddingProvider(api_key=None, model="text-embedding-3-small")
        assert exc.value.code == "AUTH"

    def test_default_base_url(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="text-embedding-3-small")
        assert provider.base_url == "https://api.openai.com/v1"

    def test_custom_base_url(self) -> None:
        provider = OpenAIEmbeddingProvider(
            api_key="nvkey",
            base_url="https://integrate.api.nvidia.com/v1",
            model="nvidia/nv-embedqa-e5-v5",
        )
        assert provider.base_url == "https://integrate.api.nvidia.com/v1"
        assert provider.model == "nvidia/nv-embedqa-e5-v5"

    def test_name_is_openai(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")
        assert provider.name == "openai"

    def test_trait_embedding_provider(self) -> None:
        from lu.embedding.types import EmbeddingProvider

        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")
        assert isinstance(provider, EmbeddingProvider)


class TestOpenAIEmbeddingProviderCall:
    def test_embed_parses_response(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="text-embedding-3-small")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3], "index": 0}],
            "usage": {"total_tokens": 3},
        }

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            result = provider.embed("你好")

        assert result.embedding == [0.1, 0.2, 0.3]
        assert result.tokens == 3
        assert result.model == "text-embedding-3-small"

    def test_embed_posts_to_embeddings_endpoint(self) -> None:
        provider = OpenAIEmbeddingProvider(
            api_key="sk-test",
            base_url="https://integrate.api.nvidia.com/v1",
            model="m",
        )

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"embedding": [1.0]}],
            "usage": {"total_tokens": 1},
        }

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response) as mock_post:
            provider.embed("hello")

        call = mock_post.call_args
        # URL ends with /embeddings
        assert call.args[0].endswith("/embeddings")
        # payload 包含 model + input
        payload = call.kwargs["json"]
        assert payload["model"] == "m"
        assert payload["input"] == "hello"

    def test_embed_sends_bearer_header(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"embedding": [1.0]}],
            "usage": {"total_tokens": 1},
        }

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response) as mock_post:
            provider.embed("hi")

        headers = mock_post.call_args.kwargs["headers"]
        assert headers["Authorization"] == "Bearer sk-test"

    def test_embed_401_raises_auth(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "AUTH"

    def test_embed_429_raises_rate_limit(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 429
        mock_response.text = "Rate limit"

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "RATE_LIMIT"

    def test_embed_500_raises_server(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 500
        mock_response.text = "Internal"

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "SERVER"

    def test_embed_bad_json_raises_unknown(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("not json")

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "UNKNOWN"

    def test_embed_missing_data_field_raises_unknown(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {"unexpected": "shape"}

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "UNKNOWN"

    def test_embed_timeout_raises_timeout(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m", timeout_sec=1.0)

        with patch(
            "lu.embedding.providers.httpx.Client.post",
            side_effect=httpx.TimeoutException("timeout"),
        ):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "TIMEOUT"

    def test_embed_network_error_raises_server(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        with patch(
            "lu.embedding.providers.httpx.Client.post",
            side_effect=httpx.NetworkError("net"),
        ):
            with pytest.raises(LLMError) as exc:
                provider.embed("x")
        assert exc.value.code == "SERVER"

    def test_embed_call_dunder(self) -> None:
        provider = OpenAIEmbeddingProvider(api_key="sk-test", model="m")

        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"embedding": [1.0]}],
            "usage": {"total_tokens": 1},
        }

        with patch("lu.embedding.providers.httpx.Client.post", return_value=mock_response):
            result = provider("hello")

        assert result.embedding == [1.0]

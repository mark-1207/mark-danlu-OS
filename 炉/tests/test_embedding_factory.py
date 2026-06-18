"""EmbeddingFactory 测试

- 从 env 构造默认 OpenAI chain
- 设置 LU_EMBEDDING_BASE_URL 切到 NVIDIA
- 设置 LU_EMBEDDING_MODEL 切模型
- 无 key 时抛错
"""
from __future__ import annotations

import os

import pytest

from lu.embedding.factory import EmbeddingFactory
from lu.llm.errors import LLMError


class TestEmbeddingFactory:
    def test_raises_when_no_api_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("LU_EMBEDDING_API_KEY", raising=False)
        with pytest.raises(LLMError) as exc:
            EmbeddingFactory.from_env()
        assert exc.value.code == "AUTH"

    def test_default_openai(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.delenv("LU_EMBEDDING_BASE_URL", raising=False)
        monkeypatch.delenv("LU_EMBEDDING_MODEL", raising=False)
        chain = EmbeddingFactory.from_env()
        assert chain.providers[0].name == "openai"
        assert chain.providers[0].model == "text-embedding-3-small"
        assert chain.providers[0].base_url == "https://api.openai.com/v1"

    def test_custom_base_url_for_nvidia(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LU_EMBEDDING_API_KEY", "nvkey")
        monkeypatch.setenv("LU_EMBEDDING_BASE_URL", "https://integrate.api.nvidia.com/v1")
        monkeypatch.setenv("LU_EMBEDDING_MODEL", "nvidia/nv-embedqa-e5-v5")
        chain = EmbeddingFactory.from_env()
        p = chain.providers[0]
        assert p.api_key == "nvkey"
        assert p.base_url == "https://integrate.api.nvidia.com/v1"
        assert p.model == "nvidia/nv-embedqa-e5-v5"
        assert p.name == "openai"  # 协议名仍叫 openai

    def test_explicit_params_override_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-env")
        chain = EmbeddingFactory.from_env(
            api_key="sk-explicit",
            base_url="https://custom.example.com/v1",
            model="custom-model",
        )
        p = chain.providers[0]
        assert p.api_key == "sk-explicit"
        assert p.base_url == "https://custom.example.com/v1"
        assert p.model == "custom-model"

    def test_factory_with_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """fallback 链：主 + 备用"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        chain = EmbeddingFactory.from_env(
            fallback_api_key="sk-fb",
            fallback_base_url="https://fb.example.com/v1",
            fallback_model="fb-model",
        )
        assert len(chain.providers) == 2
        assert chain.providers[0].name == "openai"
        assert chain.providers[1].api_key == "sk-fb"
        assert chain.providers[1].base_url == "https://fb.example.com/v1"

    def test_factory_uses_max_retries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        chain = EmbeddingFactory.from_env(max_retries=5)
        assert chain.max_retries == 5

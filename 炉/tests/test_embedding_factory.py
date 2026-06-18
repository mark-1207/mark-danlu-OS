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


@pytest.fixture(autouse=True)
def _clean_embedding_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """每个测试前清理 embedding 相关环境变量，避免 .env 泄漏影响断言"""
    for key in list(os.environ):
        if key.startswith("LU_EMBEDDING"):
            monkeypatch.delenv(key, raising=False)


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

    def test_factory_with_env_single_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_API_KEY", "sk-fb")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_BASE_URL", "https://fb.example.com/v1")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_MODEL", "fb-model")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 2
        assert chain.providers[1].api_key == "sk-fb"

    def test_factory_with_numbered_fallbacks(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """多 fallback：FALLBACK_1 + FALLBACK_2"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_API_KEY", "sk-fb1")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_BASE_URL", "https://fb1.example.com/v1")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_MODEL", "fb1-model")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_2_API_KEY", "sk-fb2")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_2_BASE_URL", "https://fb2.example.com/v1")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_2_MODEL", "fb2-model")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 3
        assert chain.providers[1].api_key == "sk-fb1"
        assert chain.providers[2].api_key == "sk-fb2"

    def test_factory_skips_duplicate_primary_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """fallback 与 primary 完全相同时应跳过"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_MODEL", "text-embedding-3-small")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 1

    def test_factory_numbered_and_single_fallback_combined(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """旧版单 fallback + 新版编号 fallback 同时存在时全部加入"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_API_KEY", "sk-old-fb")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_API_KEY", "sk-new-fb1")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 3
        assert chain.providers[1].api_key == "sk-old-fb"
        assert chain.providers[2].api_key == "sk-new-fb1"

    def test_factory_uses_max_retries(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        chain = EmbeddingFactory.from_env(max_retries=5)
        assert chain.max_retries == 5

    def test_factory_skips_invalid_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """fallback key 为空字符串时静默跳过"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_API_KEY", "")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 1

    def test_factory_empty_numbered_fallback_breaks_sequence(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """FALLBACK_1 为空、FALLBACK_2 有时只应读到空为止"""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_1_API_KEY", "")
        monkeypatch.setenv("LU_EMBEDDING_FALLBACK_2_API_KEY", "sk-fb2")
        chain = EmbeddingFactory.from_env()
        assert len(chain.providers) == 1

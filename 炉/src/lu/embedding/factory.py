"""EmbeddingFactory：从 env 或显式参数构造 EmbeddingChain

环境变量：
- LU_EMBEDDING_API_KEY（覆盖 OPENAI_API_KEY）
- LU_EMBEDDING_BASE_URL（默认 OpenAI 官方）
- LU_EMBEDDING_MODEL（默认 text-embedding-3-small）
- LU_EMBEDDING_FALLBACK_*：可选 fallback provider

显式参数优先级高于环境变量。
"""
from __future__ import annotations

import os

from lu.embedding.chain import EmbeddingChain
from lu.embedding.providers import OpenAIEmbeddingProvider
from lu.llm.errors import LLMError


_DEFAULT_BASE_URL = "https://api.openai.com/v1"
_DEFAULT_MODEL = "text-embedding-3-small"


class EmbeddingFactory:
    """Embedding 链工厂"""

    @staticmethod
    def from_env(
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        fallback_api_key: str | None = None,
        fallback_base_url: str | None = None,
        fallback_model: str | None = None,
        max_retries: int = 3,
    ) -> EmbeddingChain:
        """从环境变量 + 显式参数构造 EmbeddingChain

        优先级：显式参数 > LU_EMBEDDING_* > OPENAI_API_KEY
        """
        key = (
            api_key
            or os.environ.get("LU_EMBEDDING_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )
        url = base_url or os.environ.get("LU_EMBEDDING_BASE_URL", _DEFAULT_BASE_URL)
        m = model or os.environ.get("LU_EMBEDDING_MODEL", _DEFAULT_MODEL)

        if not key:
            raise LLMError(
                "未设置 OPENAI_API_KEY 或 LU_EMBEDDING_API_KEY",
                code="AUTH",
            )

        primary = OpenAIEmbeddingProvider(api_key=key, base_url=url, model=m)
        providers = [primary]

        fb_key = (
            fallback_api_key
            or os.environ.get("LU_EMBEDDING_FALLBACK_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )
        fb_url = (
            fallback_base_url
            or os.environ.get("LU_EMBEDDING_FALLBACK_BASE_URL", _DEFAULT_BASE_URL)
        )
        fb_m = (
            fallback_model
            or os.environ.get("LU_EMBEDDING_FALLBACK_MODEL", _DEFAULT_MODEL)
        )

        # 仅当 fallback 配置完整且与 primary 不同时才追加
        if fb_key and (fb_key != key or fb_url != url or fb_m != m):
            try:
                fallback = OpenAIEmbeddingProvider(
                    api_key=fb_key, base_url=fb_url, model=fb_m
                )
                providers.append(fallback)
            except LLMError:
                # fallback key 无效时静默跳过（不阻塞主链构造）
                pass

        return EmbeddingChain(providers, max_retries=max_retries)


__all__ = ["EmbeddingFactory"]

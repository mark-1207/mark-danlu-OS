"""EmbeddingFactory：从 env 或显式参数构造 EmbeddingChain

环境变量：
- LU_EMBEDDING_API_KEY（覆盖 OPENAI_API_KEY）
- LU_EMBEDDING_BASE_URL（默认 OpenAI 官方）
- LU_EMBEDDING_MODEL（默认 text-embedding-3-small）
- LU_EMBEDDING_FALLBACK_API_KEY / _BASE_URL / _MODEL：单 fallback（兼容旧配置）
- LU_EMBEDDING_FALLBACK_N_API_KEY / _BASE_URL / _MODEL：多 fallback（N=1,2,...）

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

        fallback 顺序：
        1. 显式 fallback_* 参数（单 fallback，兼容旧配置）
        2. LU_EMBEDDING_FALLBACK_* 环境变量（单 fallback，兼容旧配置）
        3. LU_EMBEDDING_FALLBACK_N_* 环境变量（N=1,2,... 多 fallback）
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

        # 1) 显式单 fallback 参数
        if fallback_api_key:
            providers.extend(
                EmbeddingFactory._build_fallbacks(
                    [(fallback_api_key, fallback_base_url, fallback_model)],
                    key,
                    url,
                    m,
                )
            )

        # 2) 旧版单 fallback 环境变量
        fb_key = os.environ.get("LU_EMBEDDING_FALLBACK_API_KEY")
        if fb_key:
            providers.extend(
                EmbeddingFactory._build_fallbacks(
                    [
                        (
                            fb_key,
                            os.environ.get("LU_EMBEDDING_FALLBACK_BASE_URL"),
                            os.environ.get("LU_EMBEDDING_FALLBACK_MODEL"),
                        )
                    ],
                    key,
                    url,
                    m,
                )
            )

        # 3) 新版多 fallback 环境变量：FALLBACK_1_*, FALLBACK_2_*, ...
        numbered: list[tuple[str, str | None, str | None]] = []
        for n in range(1, 10):
            fbk = os.environ.get(f"LU_EMBEDDING_FALLBACK_{n}_API_KEY")
            if not fbk:
                break
            numbered.append(
                (
                    fbk,
                    os.environ.get(f"LU_EMBEDDING_FALLBACK_{n}_BASE_URL"),
                    os.environ.get(f"LU_EMBEDDING_FALLBACK_{n}_MODEL"),
                )
            )
        if numbered:
            providers.extend(
                EmbeddingFactory._build_fallbacks(numbered, key, url, m)
            )

        return EmbeddingChain(providers, max_retries=max_retries)

    @staticmethod
    def _build_fallbacks(
        configs: list[tuple[str, str | None, str | None]],
        primary_key: str,
        primary_url: str,
        primary_model: str,
    ) -> list[OpenAIEmbeddingProvider]:
        """构造 fallback provider 列表，跳过与 primary 完全相同或无效的"""
        result: list[OpenAIEmbeddingProvider] = []
        for fb_key, fb_url, fb_m in configs:
            fb_url = fb_url or _DEFAULT_BASE_URL
            fb_m = fb_m or _DEFAULT_MODEL
            # 跳过与 primary 完全相同的配置（避免重复调用）
            if (
                fb_key == primary_key
                and fb_url == primary_url
                and fb_m == primary_model
            ):
                continue
            try:
                result.append(
                    OpenAIEmbeddingProvider(
                        api_key=fb_key, base_url=fb_url, model=fb_m
                    )
                )
            except LLMError:
                # fallback key 无效时静默跳过（不阻塞主链构造）
                pass
        return result


__all__ = ["EmbeddingFactory"]

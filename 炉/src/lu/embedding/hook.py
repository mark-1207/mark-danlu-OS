"""EmbeddingHook：把 embedding 集成到 orchestrator 的胶水层

职责：
- find_similar：检查新命题与历史命题的相似度
- recall_materials：给蓝图 LLM 召回相关素材
- record_proposition：把新命题写入历史索引
- record_materials：把沉淀的素材写入素材索引

失败语义：chain 抛错时静默返回空（不阻塞主流程）。
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from lu.embedding.chain import EmbeddingChain
from lu.embedding.index import EmbeddingIndex
from lu.embedding.recall import RecallHit
from lu.embedding.types import EmbeddingResult
from lu.llm.errors import LLMError

if TYPE_CHECKING:
    from lu.sediment.models import Harvested


@dataclass
class SimilarProposition:
    """历史相似命题"""

    proposition: str
    run_id: str | None
    score: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class EmbeddingHook:
    """Embedding 在 orchestrator 中的胶水层

    注入：
    - chain：可调用 .embed(str) -> EmbeddingResult 的对象
    - proposition_index：命题历史索引
    - material_index：素材索引
    - similar_threshold：相似提示阈值（默认 0.9）
    - recall_top_k：召回数量
    - recall_threshold：召回相似度阈值
    """

    chain: EmbeddingChain
    proposition_index: EmbeddingIndex
    material_index: EmbeddingIndex
    similar_threshold: float = 0.9
    recall_top_k: int = 3
    recall_threshold: float = 0.7

    def _safe_embed(self, text: str) -> EmbeddingResult | None:
        try:
            return self.chain.embed(text)
        except LLMError:
            return None

    def find_similar(self, proposition: str) -> list[SimilarProposition]:
        """找历史相似命题（≥ similar_threshold）"""
        emb = self._safe_embed(proposition)
        if emb is None:
            return []
        hits = self.proposition_index.recall(
            query=emb.embedding,
            top_k=5,
            threshold=self.similar_threshold,
            kind="proposition",
        )
        return [
            SimilarProposition(
                proposition=h.text,
                run_id=h.id,
                score=h.score,
            )
            for h in hits
        ]

    def record_proposition(
        self, proposition: str, run_id: str | None = None
    ) -> None:
        """把命题写入 proposition_index"""
        emb = self._safe_embed(proposition)
        if emb is None:
            return
        rec_id = run_id or f"prop-{uuid.uuid4().hex[:8]}"
        self.proposition_index.add(
            id=rec_id,
            kind="proposition",
            text=proposition,
            embedding=emb.embedding,
            source=run_id or rec_id,
        )

    def recall_materials(self, proposition: str) -> list[RecallHit]:
        """用命题向量在 material_index 中召回素材（case / quote / insight）"""
        emb = self._safe_embed(proposition)
        if emb is None:
            return []
        return self.material_index.recall(
            query=emb.embedding,
            top_k=self.recall_top_k,
            threshold=self.recall_threshold,
            kind=None,  # 不过滤 kind，召回 case/quote/insight
        )

    def record_materials(
        self, harvested: "Harvested", source: str
    ) -> None:
        """把 harvested 里的 cases/quotes/insights 写入 material_index

        每条素材单独算 embedding；chain 失败时跳过该条（不阻塞）。
        """
        for case in harvested.cases or []:
            text = case.summary or case.title
            if not text:
                continue
            emb = self._safe_embed(text)
            if emb is not None:
                self._add_material(text, "case", source, emb.embedding)
        for quote in harvested.quotes or []:
            if not quote.text:
                continue
            emb = self._safe_embed(quote.text)
            if emb is not None:
                self._add_material(quote.text, "quote", source, emb.embedding)
        for insight in harvested.insights or []:
            if not insight.text:
                continue
            emb = self._safe_embed(insight.text)
            if emb is not None:
                self._add_material(insight.text, "insight", source, emb.embedding)

    def _add_material(
        self, text: str, kind: str, source: str, embedding: list[float]
    ) -> None:
        rec_id = f"mat-{uuid.uuid4().hex[:8]}"
        self.material_index.add(
            id=rec_id,
            kind=kind,
            text=text,
            embedding=embedding,
            source=source,
        )


__all__ = ["EmbeddingHook", "SimilarProposition"]

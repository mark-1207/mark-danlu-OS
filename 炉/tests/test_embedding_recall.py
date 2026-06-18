"""cosine_similarity + recall helpers 测试"""
from __future__ import annotations

import math

import pytest

from lu.embedding.recall import (
    RecallHit,
    cosine_similarity,
    recall_materials,
)
from lu.embedding.types import EmbeddingResult


class TestCosineSimilarity:
    def test_identical_is_one(self) -> None:
        v = [1.0, 0.0, 0.0]
        assert math.isclose(cosine_similarity(v, v), 1.0, abs_tol=1e-9)

    def test_orthogonal_is_zero(self) -> None:
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert math.isclose(cosine_similarity(a, b), 0.0, abs_tol=1e-9)

    def test_opposite_is_minus_one(self) -> None:
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert math.isclose(cosine_similarity(a, b), -1.0, abs_tol=1e-9)

    def test_scaled_is_one(self) -> None:
        """v 和 2v 夹角相同 = 1.0"""
        a = [1.0, 2.0, 3.0]
        b = [2.0, 4.0, 6.0]
        assert math.isclose(cosine_similarity(a, b), 1.0, abs_tol=1e-9)

    def test_zero_vector_returns_zero(self) -> None:
        """零向量相似度定义为 0（无方向）"""
        a = [0.0, 0.0]
        b = [1.0, 0.0]
        assert cosine_similarity(a, b) == 0.0

    def test_both_zero_returns_zero(self) -> None:
        assert cosine_similarity([0.0, 0.0], [0.0, 0.0]) == 0.0

    def test_dim_mismatch_raises(self) -> None:
        with pytest.raises(ValueError):
            cosine_similarity([1.0, 0.0], [1.0, 0.0, 0.0])

    def test_3d_typical(self) -> None:
        a = [1.0, 2.0, 3.0]
        b = [4.0, 5.0, 6.0]
        # 手算: dot=32, |a|=sqrt(14), |b|=sqrt(77) -> 32 / sqrt(14*77) ≈ 0.9746
        s = cosine_similarity(a, b)
        assert 0.97 < s < 0.98


class TestRecallMaterials:
    def _chain(self, vec: list[float]):
        """构造一个返回固定 vec 的伪 chain"""
        from lu.embedding.chain import EmbeddingChain

        def _provider(text: str) -> EmbeddingResult:
            return EmbeddingResult(embedding=list(vec), model="m", tokens=len(text))

        return EmbeddingChain([_provider])

    def test_returns_empty_for_empty_index(self, tmp_path) -> None:
        from lu.embedding.index import EmbeddingIndex

        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        chain = self._chain([1.0, 0.0])
        hits = recall_materials(chain, idx, "anything", top_k=3, threshold=0.5)
        assert hits == []

    def test_returns_top_k_by_similarity(self, tmp_path) -> None:
        from lu.embedding.index import EmbeddingIndex

        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        # query = [1, 0]；3 个候选分别 = 同向、正交、反向
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="case", text="B", embedding=[0.0, 1.0], source="s")
        idx.add(id="c", kind="case", text="C", embedding=[-1.0, 0.0], source="s")
        chain = self._chain([1.0, 0.0])
        hits = recall_materials(chain, idx, "q", top_k=2, threshold=-1.0)
        assert len(hits) == 2
        assert hits[0].id == "a"
        assert math.isclose(hits[0].score, 1.0, abs_tol=1e-9)
        assert hits[1].id == "b"
        assert math.isclose(hits[1].score, 0.0, abs_tol=1e-9)

    def test_threshold_filters_low_scores(self, tmp_path) -> None:
        from lu.embedding.index import EmbeddingIndex

        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="case", text="B", embedding=[0.0, 1.0], source="s")
        chain = self._chain([1.0, 0.0])
        hits = recall_materials(chain, idx, "q", top_k=5, threshold=0.5)
        assert len(hits) == 1
        assert hits[0].id == "a"

    def test_kind_filter(self, tmp_path) -> None:
        from lu.embedding.index import EmbeddingIndex

        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="quote", text="B", embedding=[1.0, 0.0], source="s")
        chain = self._chain([1.0, 0.0])
        hits = recall_materials(
            chain, idx, "q", top_k=5, threshold=0.5, kind="quote"
        )
        assert len(hits) == 1
        assert hits[0].id == "b"
        assert hits[0].kind == "quote"

    def test_hit_has_score_and_metadata(self, tmp_path) -> None:
        from lu.embedding.index import EmbeddingIndex

        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(
            id="x",
            kind="insight",
            text="杠杆者洞察",
            embedding=[1.0, 0.0],
            source="run-1",
            tags=["杠杆者"],
        )
        chain = self._chain([1.0, 0.0])
        hits = recall_materials(chain, idx, "q", top_k=3, threshold=0.5)
        assert len(hits) == 1
        h = hits[0]
        assert h.id == "x"
        assert h.kind == "insight"
        assert h.text == "杠杆者洞察"
        assert h.source == "run-1"
        assert h.tags == ["杠杆者"]
        assert math.isclose(h.score, 1.0, abs_tol=1e-9)

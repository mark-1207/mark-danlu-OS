"""EmbeddingHook 测试：post-socratic 相似检测 + pre-blueprint 召回 + 写入"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from lu.embedding.chain import EmbeddingChain
from lu.embedding.hook import EmbeddingHook, SimilarProposition
from lu.embedding.index import EmbeddingIndex
from lu.embedding.types import EmbeddingResult


def _echo_chain(vec: list[float]) -> EmbeddingChain:
    """构造一个返回固定 vec 的伪 chain"""
    def _p(text: str) -> EmbeddingResult:
        return EmbeddingResult(embedding=list(vec), model="m", tokens=len(text))
    return EmbeddingChain([_p])


def _echo_chain_with_dim(dim: int) -> EmbeddingChain:
    def _p(text: str) -> EmbeddingResult:
        return EmbeddingResult(embedding=[0.5] * dim, model="m", tokens=len(text))
    return EmbeddingChain([_p])


class TestEmbeddingHookSimilar:
    def test_no_history_returns_empty(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([1.0, 0.0]),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        sims = hook.find_similar("anything")
        assert sims == []

    def test_finds_similar_above_threshold(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        prop_idx.add(
            id="r1",
            kind="proposition",
            text="杠杆者反思",
            embedding=[1.0, 0.0],
            source="run-1",
        )
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([1.0, 0.0]),
            proposition_index=prop_idx,
            material_index=mat_idx,
            similar_threshold=0.9,
        )
        sims = hook.find_similar("杠杆者")
        assert len(sims) == 1
        assert sims[0].proposition == "杠杆者反思"
        assert sims[0].run_id == "r1"
        assert sims[0].score == pytest.approx(1.0, abs=1e-6)

    def test_below_threshold_filtered(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        prop_idx.add(
            id="r1",
            kind="proposition",
            text="X",
            embedding=[1.0, 0.0],
            source="run-1",
        )
        prop_idx.add(
            id="r2",
            kind="proposition",
            text="Y",
            embedding=[0.0, 1.0],
            source="run-2",
        )
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([1.0, 0.0]),
            proposition_index=prop_idx,
            material_index=mat_idx,
            similar_threshold=0.9,
        )
        sims = hook.find_similar("q")
        assert len(sims) == 1
        assert sims[0].run_id == "r1"

    def test_chain_failure_returns_empty(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        from lu.llm.errors import LLMError

        def _fail(text: str) -> EmbeddingResult:
            raise LLMError("boom", code="SERVER")

        chain = EmbeddingChain([_fail])
        hook = EmbeddingHook(
            chain=chain, proposition_index=prop_idx, material_index=mat_idx
        )
        # 不抛错，返回空
        assert hook.find_similar("q") == []
        assert hook.record_proposition("q") is None
        assert hook.recall_materials("q") == []


class TestEmbeddingHookRecord:
    def test_record_proposition_appends(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([1.0, 0.0]),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        hook.record_proposition("AI 杠杆者", run_id="run-x")
        assert prop_idx.count() == 1
        records = prop_idx.read_all()
        assert records[0].id == "run-x"
        assert records[0].text == "AI 杠杆者"
        assert records[0].kind == "proposition"
        assert records[0].source == "run-x"

    def test_record_materials_writes_cases_quotes_insights(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([0.7, 0.7]),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        # 构造 harvested 风格对象
        from lu.blueprint.models import Case, Quote
        from lu.sediment.models import Harvested, Insight

        h = Harvested(
            cases=[Case(title="C1", summary="案例1"), Case(title="C2", summary="案例2")],
            quotes=[Quote(text="金句1")],
            insights=[
                Insight(text="洞察1"),
                Insight(text="洞察2"),
                Insight(text="洞察3"),
            ],
            forbidden_candidates=["AI味儿"],
        )
        hook.record_materials(h, source="run-1")
        records = mat_idx.read_all()
        # 2 cases + 1 quote + 3 insights = 6
        assert len(records) == 6
        kinds = {r.kind for r in records}
        assert kinds == {"case", "quote", "insight"}
        cases = [r for r in records if r.kind == "case"]
        assert len(cases) == 2
        assert cases[0].source == "run-1"

    def test_record_materials_skips_empty(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain([0.5, 0.5]),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        from lu.sediment.models import Harvested

        h = Harvested(cases=[], quotes=[], insights=[], forbidden_candidates=[])
        hook.record_materials(h, source="run-1")
        assert mat_idx.count() == 0


class TestEmbeddingHookRecall:
    def test_recall_returns_top_k_materials(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        # 写入若干素材
        mat_idx.add(id="c1", kind="case", text="C1", embedding=[1.0, 0.0], source="s")
        mat_idx.add(id="c2", kind="quote", text="Q1", embedding=[0.5, 0.5], source="s")
        mat_idx.add(id="c3", kind="insight", text="I1", embedding=[-1.0, 0.0], source="s")
        hook = EmbeddingHook(
            chain=_echo_chain([1.0, 0.0]),
            proposition_index=prop_idx,
            material_index=mat_idx,
            recall_top_k=2,
            recall_threshold=0.5,
        )
        hits = hook.recall_materials("query")
        assert len(hits) == 2
        assert hits[0].id == "c1"
        assert hits[1].id == "c2"


class TestSimilarPropositionFields:
    def test_fields(self) -> None:
        from datetime import datetime, timezone
        ts = datetime(2026, 1, 1, tzinfo=timezone.utc)
        s = SimilarProposition(
            proposition="x", run_id="r1", score=0.95, timestamp=ts
        )
        assert s.proposition == "x"
        assert s.run_id == "r1"
        assert s.score == 0.95
        assert s.timestamp == ts

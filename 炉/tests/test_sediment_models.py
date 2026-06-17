"""sediment/models.py 测试

Harvested 沉淀产物：
- cases / quotes / insights / contrarian_points / forbidden_candidates
DiffResult 对比结果：
- removed: 被用户删除的段落
- modified: 修改的段落
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from lu.blueprint.models import Case, Quote
from lu.socratic.output import ContrarianPoint
from lu.sediment.models import DiffResult, Harvested, Insight


class TestInsight:
    def test_minimal(self):
        i = Insight(text="AI 时代产品化能力是关键", source="从草稿提取")
        assert i.text == "AI 时代产品化能力是关键"
        assert i.source == "从草稿提取"

    def test_optional_tags(self):
        i = Insight(text="x", source="y", tags=["AI", "产品化"])
        assert i.tags == ["AI", "产品化"]

    def test_default_tags_empty(self):
        i = Insight(text="x", source="y")
        assert i.tags == []


class TestDiffResult:
    def test_minimal(self):
        d = DiffResult(removed=[], modified=[])
        assert d.removed == []
        assert d.modified == []
        assert d.forbidden_candidates == []

    def test_with_removed(self):
        d = DiffResult(removed=["段1", "段2"], modified=[])
        assert len(d.removed) == 2

    def test_with_modified(self):
        d = DiffResult(
            removed=[],
            modified=[("原段", "新段")],
        )
        assert d.modified == [("原段", "新段")]

    def test_with_forbidden_candidates(self):
        d = DiffResult(
            removed=[],
            modified=[],
            forbidden_candidates=["被删的套话"],
        )
        assert "被删的套话" in d.forbidden_candidates


class TestHarvested:
    def test_minimal(self):
        h = Harvested()
        assert h.cases == []
        assert h.quotes == []
        assert h.insights == []
        assert h.contrarian_points == []
        assert h.forbidden_candidates == []

    def test_with_data(self):
        h = Harvested(
            cases=[Case(title="X", summary="Y")],
            quotes=[Quote(text="q", author="a")],
            insights=[Insight(text="i", source="s")],
            contrarian_points=[ContrarianPoint(point="p", rationale="r")],
            forbidden_candidates=["AI 套话"],
        )
        assert len(h.cases) == 1
        assert len(h.quotes) == 1
        assert len(h.insights) == 1
        assert len(h.contrarian_points) == 1
        assert len(h.forbidden_candidates) == 1
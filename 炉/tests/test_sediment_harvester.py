"""sediment/harvester.py 测试

Harvester:
- extract(draft, refined, llm_call) → Harvested
- diff(draft, marked) → DiffResult
"""
from __future__ import annotations

import json

from lu.blueprint.models import Section, SectionRole
from lu.draft.models import Draft
from lu.sediment.harvester import Harvester
from lu.sediment.models import DiffResult, Harvested
from lu.socratic.output import RefinedProposition


def _draft(content: str = "钩子内容\n\n反共识\n\n案例\n\n思考\n\n收尾") -> Draft:
    return Draft(
        title="x",
        sections=[
            Section(
                role=SectionRole.HOOK,
                must_have=[],
                word_limit=100,
                style_hint="短",
                content=content,
                self_confidence=0.8,
            )
        ],
        total_word_count=len(content),
    )


def _refined() -> RefinedProposition:
    return RefinedProposition(
        surface="s",
        underlying="u",
        audience="a",
        style_recommendation={"voice": "v", "tone": "t", "examples": []},
        contrarian_candidates=[],
        framework_candidates=[],
        risks=[],
        falsifiability="f",
    )


def _ok_harvested() -> str:
    return json.dumps({
        "cases": [{"title": "特斯拉", "summary": "物理原理"}],
        "quotes": [{"text": "简单是终极的复杂", "author": "达芬奇"}],
        "insights": [{"text": "产品化是关键", "source": "草稿"}],
        "contrarian_points": [],
    }, ensure_ascii=False)


def _ok_llm(responses: list[str]):
    iterator = iter(responses)

    def call(prompt: str) -> str:
        try:
            return next(iterator)
        except StopIteration:
            return "[EXHAUSTED]"
    return call


class TestHarvesterExtract:
    def test_returns_harvested(self):
        llm = _ok_llm([_ok_harvested()])
        h = Harvester.extract(_draft(), _refined(), llm)
        assert isinstance(h, Harvested)

    def test_extracts_cases(self):
        llm = _ok_llm([_ok_harvested()])
        h = Harvester.extract(_draft(), _refined(), llm)
        assert len(h.cases) == 1
        assert h.cases[0].title == "特斯拉"

    def test_extracts_quotes(self):
        llm = _ok_llm([_ok_harvested()])
        h = Harvester.extract(_draft(), _refined(), llm)
        assert len(h.quotes) == 1
        assert h.quotes[0].author == "达芬奇"

    def test_extracts_insights(self):
        llm = _ok_llm([_ok_harvested()])
        h = Harvester.extract(_draft(), _refined(), llm)
        assert len(h.insights) == 1
        assert "产品化" in h.insights[0].text

    def test_invalid_json_returns_empty(self):
        llm = _ok_llm(["not json"])
        h = Harvester.extract(_draft(), _refined(), llm)
        assert isinstance(h, Harvested)
        assert h.cases == []
        assert h.quotes == []


class TestHarvesterDiff:
    def test_diff_returns_diff_result(self):
        d = Harvester.diff(_draft(), _draft())
        assert isinstance(d, DiffResult)

    def test_diff_identical_no_changes(self):
        d = Harvester.diff(_draft(), _draft())
        assert d.removed == []
        assert d.modified == []

    def test_diff_detects_removed_paragraph(self):
        original = _draft("段A\n\n段B\n\n段C")
        marked = _draft("段B")  # 用户删了段A 和 段C
        d = Harvester.diff(original, marked)

        # 至少有一个被删段落
        assert len(d.removed) >= 1

    def test_diff_detects_modified_paragraph(self):
        original = _draft("原句")
        marked = _draft("改句")
        d = Harvester.diff(original, marked)

        assert len(d.modified) >= 1
        old, new = d.modified[0]
        assert "原句" in old or "改句" in new

    def test_diff_short_paragraphs_become_forbidden_candidates(self):
        # 短段落（< 10 字）被删 → 加入 forbidden_candidates
        original = _draft("AI赋能\n\n真有内容的段落")
        marked = _draft("真有内容的段落")
        d = Harvester.diff(original, marked)

        # "AI赋能" 是被删的短套话
        assert any("赋能" in c for c in d.forbidden_candidates)
"""blueprint/models.py 测试

数据模型：
- SectionRole 枚举（5 核心 + 8 可选 = 13）
- Case / DataPoint / Quote 资产类型
- AntiAIAnchors 锚点池
- Section 段位
- Blueprint 蓝图
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Case,
    DataPoint,
    Section,
    SectionRole,
    Quote,
)


class TestSectionRole:
    def test_core_5_roles_exist(self):
        for r in ["hook", "anti_consensus", "case", "thinking", "closing"]:
            assert SectionRole(r) is not None

    def test_optional_roles_exist(self):
        for r in ["action", "rebuttal", "contrast", "data",
                  "self_deprecation", "quote", "twist", "pause"]:
            assert SectionRole(r) is not None

    def test_total_count_is_13(self):
        assert len(SectionRole) == 13

    def test_unknown_role_raises(self):
        with pytest.raises(ValueError):
            SectionRole("nonexistent_role")


class TestCase:
    def test_minimal(self):
        c = Case(title="特斯拉电池", summary="从物理原理算成本")
        assert c.title == "特斯拉电池"
        assert c.summary == "从物理原理算成本"
        assert c.source is None

    def test_with_source(self):
        c = Case(title="X", summary="Y", source="教科书")
        assert c.source == "教科书"


class TestDataPoint:
    def test_construction(self):
        d = DataPoint(statement="80% 用户偏好 X", source="Gartner 2024")
        assert d.statement == "80% 用户偏好 X"
        assert d.source == "Gartner 2024"


class TestQuote:
    def test_construction(self):
        q = Quote(text="简单是终极的复杂", author="达芬奇")
        assert q.text == "简单是终极的复杂"
        assert q.author == "达芬奇"


class TestAntiAIAnchors:
    def test_default_empty_lists(self):
        a = AntiAIAnchors()
        assert a.case_anchors == []
        assert a.contrarian_anchors == []
        assert a.data_anchors == []
        assert a.insight_anchors == []
        assert a.quote_anchors == []
        assert a.forbidden_list == []

    def test_populated(self):
        a = AntiAIAnchors(
            case_anchors=[Case(title="t", summary="s")],
            contrarian_anchors=["反共识1"],
            data_anchors=[DataPoint(statement="x", source="y")],
            insight_anchors=["洞察1"],
            quote_anchors=[Quote(text="q", author="a")],
            forbidden_list=["AI 套话"],
        )
        assert len(a.case_anchors) == 1
        assert len(a.contrarian_anchors) == 1
        assert len(a.data_anchors) == 1
        assert len(a.insight_anchors) == 1
        assert len(a.quote_anchors) == 1
        assert len(a.forbidden_list) == 1


class TestSection:
    def test_minimal_required_fields(self):
        s = Section(
            role=SectionRole.HOOK,
            must_have=["钩子要素"],
            word_limit=200,
            style_hint="短句冲击",
        )
        assert s.role is SectionRole.HOOK
        assert s.word_limit == 200
        assert s.content is None
        assert s.self_confidence is None
        assert s.thinking_model_hint is None

    def test_full_construction(self):
        s = Section(
            role=SectionRole.THINKING,
            must_have=["第一性原理"],
            word_limit=400,
            style_hint="层层剥开",
            thinking_model_hint="first_principles",
            content="正文...",
            self_confidence=0.85,
        )
        assert s.content == "正文..."
        assert s.self_confidence == 0.85

    def test_word_limit_must_be_positive(self):
        with pytest.raises(ValidationError):
            Section(
                role=SectionRole.HOOK,
                must_have=[],
                word_limit=0,
                style_hint="x",
            )


class TestBlueprint:
    def _make_minimal(self) -> Blueprint:
        return Blueprint(
            proposition="为什么学 AI 赚不到钱",
            stance="学 AI 不等于能赚钱，差的是产品化的能力",
            framework="problem_decomposition",
            framework_output={"chain_outputs": ["A", "B", "C"]},
            audience="想靠 AI 副业变现的程序员",
            core_anti_consensus="学 AI ≠ 赚钱，关键是卖产品",
            cases=[Case(title="特斯拉电池", summary="物理原理算成本")],
            data=[DataPoint(statement="80% 失败", source="Gartner")],
            quotes=[Quote(text="简单是终极的复杂", author="达芬奇")],
            forbidden=["赋能", "闭环", "抓手"],
            sections=[
                Section(
                    role=SectionRole.HOOK,
                    must_have=[],
                    word_limit=100,
                    style_hint="短",
                )
            ],
            anti_ai_anchors=AntiAIAnchors(
                case_anchors=[Case(title="X", summary="Y")],
            ),
        )

    def test_construction(self):
        b = self._make_minimal()
        assert b.proposition == "为什么学 AI 赚不到钱"
        assert b.framework == "problem_decomposition"
        assert len(b.cases) == 1
        assert len(b.sections) == 1

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            Blueprint(stance="x")  # type: ignore[call-arg]

    def test_sections_default_empty(self):
        b = Blueprint(
            proposition="p",
            stance="s",
            framework="f",
            framework_output={},
            audience="a",
            core_anti_consensus="c",
            cases=[],
            data=[],
            quotes=[],
            forbidden=[],
            anti_ai_anchors=AntiAIAnchors(),
        )
        assert b.sections == []

    def test_json_roundtrip(self):
        b = self._make_minimal()
        j = b.model_dump_json()
        b2 = Blueprint.model_validate_json(j)
        assert b2 == b
"""blueprint/sections.py 测试

SectionSelector：
- core 5 必选（hook / anti_consensus / case / thinking / closing）
- recommend(content_type) → 可选段位列表
- select(blueprint, user_choice) → Blueprint 写入 sections
"""
from __future__ import annotations

import pytest

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Section,
    SectionRole,
)
from lu.blueprint.sections import SectionSelector


def _empty_blueprint() -> Blueprint:
    return Blueprint(
        proposition="p",
        stance="s",
        framework="problem_decomposition",
        framework_output={},
        audience="a",
        core_anti_consensus="c",
        cases=[],
        data=[],
        quotes=[],
        forbidden=[],
        anti_ai_anchors=AntiAIAnchors(),
    )


class TestCoreSections:
    def test_core_5_in_order(self):
        core = SectionSelector.core_sections()
        roles = [s.role for s in core]
        assert roles == [
            SectionRole.HOOK,
            SectionRole.ANTI_CONSENSUS,
            SectionRole.CASE,
            SectionRole.THINKING,
            SectionRole.CLOSING,
        ]

    def test_each_core_has_word_limit_and_style_hint(self):
        for s in SectionSelector.core_sections():
            assert s.word_limit > 0
            assert s.style_hint


class TestRecommend:
    def test_decision_content_type_recommends_action_and_rebuttal(self):
        recs = SectionSelector.recommend("decision")
        roles = {s.role for s in recs}
        assert SectionRole.ACTION in roles
        assert SectionRole.REBUTTAL in roles

    def test_analysis_content_type_recommends_data(self):
        recs = SectionSelector.recommend("analysis")
        assert any(s.role is SectionRole.DATA for s in recs)

    def test_perspective_content_type_recommends_contrast(self):
        recs = SectionSelector.recommend("perspective")
        assert any(s.role is SectionRole.CONTRAST for s in recs)

    def test_unknown_content_type_returns_empty_recommendations(self):
        recs = SectionSelector.recommend("unknown_type_xyz")
        assert recs == []

    def test_recommended_sections_have_word_limit(self):
        for s in SectionSelector.recommend("decision"):
            assert s.word_limit > 0


class TestSelect:
    def test_select_returns_blueprint(self):
        bp = _empty_blueprint()
        result = SectionSelector.select(bp, user_choice=[])
        assert isinstance(result, Blueprint)

    def test_select_with_no_choice_uses_core_5(self):
        bp = _empty_blueprint()
        result = SectionSelector.select(bp, user_choice=[])
        roles = [s.role for s in result.sections]
        assert roles == [
            SectionRole.HOOK,
            SectionRole.ANTI_CONSENSUS,
            SectionRole.CASE,
            SectionRole.THINKING,
            SectionRole.CLOSING,
        ]

    def test_select_with_choice_adds_optional_sections(self):
        bp = _empty_blueprint()
        result = SectionSelector.select(
            bp, user_choice=["action", "rebuttal"]
        )
        roles = [s.role for s in result.sections]
        assert SectionRole.HOOK in roles
        assert SectionRole.ACTION in roles
        assert SectionRole.REBUTTAL in roles

    def test_select_preserves_order(self):
        bp = _empty_blueprint()
        result = SectionSelector.select(
            bp, user_choice=["closing"]  # 故意打乱顺序
        )
        roles = [s.role for s in result.sections]
        # 顺序应按标准叙事流：hook → anti_consensus → case → thinking → closing
        assert roles[-1] is SectionRole.CLOSING

    def test_select_ignores_unknown_choice(self):
        bp = _empty_blueprint()
        result = SectionSelector.select(
            bp, user_choice=["nonexistent_role"]
        )
        # 核心 5 段位，不应被无效选择影响
        assert len(result.sections) == 5

    def test_select_does_not_mutate_input(self):
        bp = _empty_blueprint()
        original_sections = list(bp.sections)
        SectionSelector.select(bp, user_choice=["action"])
        assert bp.sections == original_sections
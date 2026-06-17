"""blueprint/anchors.py 测试

AnchorPool：
- build(refined, framework_output) → AntiAIAnchors
- assign(anchors, sections) → 新 sections 列表（must_have 已填）
"""
from __future__ import annotations

from lu.blueprint.anchors import AnchorPool
from lu.blueprint.models import (
    AntiAIAnchors,
    Section,
    SectionRole,
)
from lu.socratic.output import RefinedProposition


def _refined() -> RefinedProposition:
    return RefinedProposition(
        surface="学 AI",
        underlying="想变现但卡在产品化",
        audience="想靠 AI 副业变现的程序员",
        style_recommendation={"voice": "直白", "tone": "犀利", "examples": []},
        contrarian_candidates=[
            {"point": "学 AI ≠ 赚钱", "rationale": "差的是产品化能力"},
            {"point": "工具不能直接卖", "rationale": "卖的是解决方案"},
        ],
        framework_candidates=[
            {"framework_id": "problem_decomposition", "name": "问题解构", "rationale": "拆根因"}
        ],
        risks=["可能劝退部分读者"],
        falsifiability="如果一个人学完 AI + 做了产品 = 赚到钱，则命题失效",
    )


class TestAnchorPoolBuild:
    def test_returns_anchors(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        assert isinstance(anchors, AntiAIAnchors)

    def test_extracts_contrarian_anchors_from_refined(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        assert len(anchors.contrarian_anchors) >= 2
        assert any("学 AI ≠ 赚钱" in c for c in anchors.contrarian_anchors)

    def test_extracts_insight_anchors_from_falsifiability(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        # falsifiability 应该作为洞察锚点
        assert any("产品" in i or "赚钱" in i for i in anchors.insight_anchors)

    def test_extracts_data_anchors_from_risks(self):
        refined = _refined()
        refined = refined.model_copy(update={
            "risks": ["80% AI 副业失败", "变现周期长"]
        })
        anchors = AnchorPool.build(refined=refined, framework_output={})
        # risks 含数据型陈述也应能进 data_anchors 或 insight_anchors
        # 简单实现：risks 整体进 insight_anchors
        assert len(anchors.insight_anchors) >= 1

    def test_empty_refined_returns_empty_anchors(self):
        empty = RefinedProposition(
            surface="",
            underlying="",
            audience="",
            style_recommendation={"voice": "", "tone": "", "examples": []},
            contrarian_candidates=[],
            framework_candidates=[],
            risks=[],
            falsifiability="",
        )
        anchors = AnchorPool.build(refined=empty, framework_output={})
        assert isinstance(anchors, AntiAIAnchors)


class TestAnchorPoolAssign:
    def test_assign_returns_list_of_sections(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        sections = [
            Section(
                role=SectionRole.CASE,
                must_have=[],
                word_limit=300,
                style_hint="讲故事",
            )
        ]
        result = AnchorPool.assign(anchors, sections)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_case_section_gets_case_anchors(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        # 注入一个 case anchor
        from lu.blueprint.models import Case
        anchors.case_anchors = [Case(title="X", summary="Y案例")]

        sections = [
            Section(
                role=SectionRole.CASE,
                must_have=[],
                word_limit=300,
                style_hint="讲故事",
            )
        ]
        result = AnchorPool.assign(anchors, sections)
        assert len(result[0].must_have) >= 1

    def test_thinking_section_gets_insight_anchors(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        sections = [
            Section(
                role=SectionRole.THINKING,
                must_have=[],
                word_limit=500,
                style_hint="层层剥开",
                thinking_model_hint="first_principles",
            )
        ]
        result = AnchorPool.assign(anchors, sections)
        # thinking 段位应至少有一个 must_have 来自 insight_anchors
        assert len(result[0].must_have) >= 1

    def test_anti_consensus_section_gets_contrarian_anchors(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        sections = [
            Section(
                role=SectionRole.ANTI_CONSENSUS,
                must_have=[],
                word_limit=300,
                style_hint="反共识",
            )
        ]
        result = AnchorPool.assign(anchors, sections)
        assert len(result[0].must_have) >= 1

    def test_assign_does_not_mutate_input_sections(self):
        anchors = AnchorPool.build(refined=_refined(), framework_output={})
        sections = [
            Section(
                role=SectionRole.HOOK,
                must_have=[],
                word_limit=100,
                style_hint="短句",
            )
        ]
        original_must_have = list(sections[0].must_have)
        AnchorPool.assign(anchors, sections)
        assert sections[0].must_have == original_must_have
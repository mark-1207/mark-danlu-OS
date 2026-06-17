"""draft/section_prompt.py 测试

SectionPromptBuilder.build(section, blueprint, style) → str
注入顺序：
1. 风格指纹
2. 必避免列表
3. 本段 must_have
4. 本段 role
5. Anti-AI 锚点池
6. 思想模型注入
"""
from __future__ import annotations

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Case,
    DataPoint,
    Quote,
    Section,
    SectionRole,
)
from lu.config.loader import ForbiddenTerm, StyleProfile
from lu.draft.section_prompt import SectionPromptBuilder


def _blueprint() -> Blueprint:
    return Blueprint(
        proposition="为什么学 AI 赚不到钱",
        stance="学 AI ≠ 赚钱",
        framework="problem_decomposition",
        framework_output={},
        audience="想靠 AI 副业变现的程序员",
        core_anti_consensus="关键是产品化",
        cases=[Case(title="特斯拉电池", summary="物理原理算成本")],
        data=[DataPoint(statement="80% 失败", source="Gartner")],
        quotes=[Quote(text="简单是终极的复杂", author="达芬奇")],
        forbidden=["赋能", "闭环"],
        sections=[],
        anti_ai_anchors=AntiAIAnchors(
            case_anchors=[Case(title="X", summary="Y案例")],
            contrarian_anchors=["反共识1"],
            data_anchors=[DataPoint(statement="D1", source="S1")],
            insight_anchors=["洞察1"],
            quote_anchors=[Quote(text="金句1", author="A1")],
            forbidden_list=["AI 套话"],
        ),
    )


def _style() -> StyleProfile:
    return StyleProfile(
        version=1,
        voice="直白犀利",
        forbidden=[
            ForbiddenTerm(term="官话", severity="high"),
            ForbiddenTerm(term="赋能", severity="medium", replacement="做事"),
        ],
    )


class TestPromptBuilding:
    def test_returns_string(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=["反共识钩子"],
            word_limit=100,
            style_hint="短句冲击",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_includes_section_role(self):
        section = Section(
            role=SectionRole.ANTI_CONSENSUS,
            must_have=[],
            word_limit=300,
            style_hint="反共识角度",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "anti_consensus" in prompt or "反共识" in prompt

    def test_includes_word_limit(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=120,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "120" in prompt

    def test_includes_style_hint(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短句冲击,3句话",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "短句冲击" in prompt

    def test_includes_style_voice(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "直白犀利" in prompt

    def test_includes_blueprint_forbidden(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        # blueprint.forbidden 包含 "赋能" / "闭环"
        assert "赋能" in prompt or "闭环" in prompt

    def test_includes_style_forbidden(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        # style.forbidden 包含 "官话"
        assert "官话" in prompt

    def test_includes_section_must_have(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=["反共识钩子", "具体场景"],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "反共识钩子" in prompt
        assert "具体场景" in prompt

    def test_includes_thinking_model_hint(self):
        section = Section(
            role=SectionRole.THINKING,
            must_have=[],
            word_limit=500,
            style_hint="层层剥开",
            thinking_model_hint="first_principles",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "first_principles" in prompt or "第一性原理" in prompt

    def test_includes_anti_ai_anchors(self):
        section = Section(
            role=SectionRole.ANTI_CONSENSUS,
            must_have=[],
            word_limit=300,
            style_hint="反共识",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "反共识1" in prompt

    def test_includes_proposition_context(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        assert "为什么学 AI 赚不到钱" in prompt


class TestInjectionOrder:
    def test_style_before_role(self):
        section = Section(
            role=SectionRole.HOOK,
            must_have=[],
            word_limit=100,
            style_hint="短",
        )
        prompt = SectionPromptBuilder.build(section, _blueprint(), _style())
        # 风格指纹（直白犀利）应在 role 描述之前出现
        voice_pos = prompt.find("直白犀利")
        role_pos = prompt.find("hook")
        assert voice_pos >= 0
        assert role_pos >= 0
        assert voice_pos < role_pos
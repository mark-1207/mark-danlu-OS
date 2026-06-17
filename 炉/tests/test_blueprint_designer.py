"""blueprint/designer.py 测试

BlueprintDesigner.design(refined, framework_id, framework_output) → Blueprint
- LLM 调用被注入（mock）
- CCOS 14 项映射
- 框架 ID 注入
- LLM 返回坏 JSON → 报错
"""
from __future__ import annotations

import json

import pytest

from lu.blueprint.designer import BlueprintDesigner
from lu.blueprint.models import Blueprint
from lu.socratic.output import RefinedProposition


def _refined() -> RefinedProposition:
    return RefinedProposition(
        surface="学 AI",
        underlying="想变现但卡在产品化",
        audience="想靠 AI 副业变现的程序员",
        style_recommendation={"voice": "直白", "tone": "犀利", "examples": []},
        contrarian_candidates=[{"point": "学 AI ≠ 赚钱", "rationale": "差的是产品化能力"}],
        framework_candidates=[
            {"framework_id": "problem_decomposition", "name": "问题解构", "rationale": "拆根因"}
        ],
        risks=["可能劝退部分读者"],
        falsifiability="如果一个人学完 AI + 做了产品 = 赚到钱，则命题失效",
    )


def _tracking_llm(responses: list[str]):
    """模拟 LLM：按调用顺序返回预设响应"""
    calls: list[str] = []
    iterator = iter(responses)

    def call(prompt: str) -> str:
        calls.append(prompt)
        try:
            return next(iterator)
        except StopIteration:
            return "[NO_MORE]"

    return call, calls


def _valid_blueprint_json() -> str:
    return json.dumps({
        "proposition": "为什么学 AI 赚不到钱",
        "stance": "学 AI 不等于赚钱",
        "audience": "想靠 AI 副业变现的程序员",
        "core_anti_consensus": "学 AI ≠ 赚钱，关键是产品化",
        "cases": [{"title": "特斯拉电池", "summary": "物理原理算成本"}],
        "data": [{"statement": "80% 失败", "source": "Gartner"}],
        "quotes": [{"text": "简单是终极的复杂", "author": "达芬奇"}],
        "forbidden": ["赋能", "闭环"],
    }, ensure_ascii=False)


class TestBlueprintDesignerDesign:
    def test_returns_blueprint(self):
        llm, _ = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)

        b = designer.design(
            refined=_refined(),
            framework_id="problem_decomposition",
            framework_output={"chain_outputs": ["A", "B", "C"]},
        )

        assert isinstance(b, Blueprint)
        assert b.proposition == "为什么学 AI 赚不到钱"
        assert b.framework == "problem_decomposition"
        assert b.framework_output == {"chain_outputs": ["A", "B", "C"]}

    def test_populates_all_ccos_14_fields(self):
        llm, _ = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)

        b = designer.design(
            refined=_refined(),
            framework_id="problem_decomposition",
            framework_output={},
        )

        # CCOS 9 项基础字段都已填充
        assert b.proposition
        assert b.stance
        assert b.audience
        assert b.core_anti_consensus
        assert len(b.cases) >= 1
        assert len(b.data) >= 1
        assert len(b.quotes) >= 1
        assert len(b.forbidden) >= 1
        # framework + sections 来自 framework_id
        assert b.framework == "problem_decomposition"

    def test_passes_refined_to_llm(self):
        llm, calls = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)

        designer.design(
            refined=_refined(),
            framework_id="problem_decomposition",
            framework_output={},
        )

        # prompt 中应包含 refined 的 surface / audience
        assert "学 AI" in calls[0] or "想变现但卡在产品化" in calls[0]
        assert "想靠 AI 副业变现的程序员" in calls[0]

    def test_invalid_json_raises(self):
        llm, _ = _tracking_llm(["not json {{{"])
        designer = BlueprintDesigner(llm_call=llm)

        with pytest.raises(ValueError, match="JSON"):
            designer.design(
                refined=_refined(),
                framework_id="problem_decomposition",
                framework_output={},
            )

    def test_empty_sections_by_default(self):
        llm, _ = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)

        b = designer.design(
            refined=_refined(),
            framework_id="problem_decomposition",
            framework_output={},
        )

        # 段位由 SectionSelector 处理，不在 designer 中
        assert b.sections == []

    def test_framework_output_preserved(self):
        llm, _ = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)
        fw_output = {
            "chain_outputs": [
                {"model_id": "first_principles", "output": "回到本质"},
                {"model_id": "five_why", "output": "为什么1"},
            ]
        }

        b = designer.design(
            refined=_refined(),
            framework_id="problem_decomposition",
            framework_output=fw_output,
        )

        assert b.framework_output == fw_output


class TestBlueprintDesignerPrompt:
    def test_prompt_contains_framework_id(self):
        llm, calls = _tracking_llm([_valid_blueprint_json()])
        designer = BlueprintDesigner(llm_call=llm)

        designer.design(
            refined=_refined(),
            framework_id="decision_analysis",
            framework_output={},
        )

        assert "decision_analysis" in calls[0]
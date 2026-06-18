"""BlueprintDesigner 召回素材注入测试"""
from __future__ import annotations

from typing import Any

from lu.blueprint.designer import BlueprintDesigner
from lu.blueprint.models import AntiAIAnchors
from lu.embedding.recall import RecallHit
from lu.socratic.output import ContrarianPoint, FrameworkCandidate, RefinedProposition, StyleRecommendation


def _empty_refined() -> RefinedProposition:
    return RefinedProposition.model_construct(
        surface="X",
        underlying="y",
        audience="z",
        style_recommendation=StyleRecommendation.model_construct(tone="x", pacing="y", structure="z"),
        contrarian_candidates=[],
        framework_candidates=[],
        risks=[],
        falsifiability="",
    )


class TestBlueprintDesignerEmbeddingInjection:
    def test_no_recalled_materials_default(self) -> None:
        """不传 recalled_materials → 行为不变（向后兼容）"""
        designer = BlueprintDesigner(llm_call=lambda p: "{}")
        # 不抛错，返回 blueprint
        bp = designer.design(
            refined=_empty_refined(),
            framework_id="problem_decomposition",
            framework_output={"a": "b"},
        )
        assert bp.anti_ai_anchors == AntiAIAnchors()

    def test_recalled_materials_injected_into_prompt(self) -> None:
        """recalled_materials 注入到 LLM prompt（通过捕获 prompt 验证）"""
        captured: dict[str, str] = {}

        def fake_llm(prompt: str) -> str:
            captured["prompt"] = prompt
            return '{"proposition": "x", "stance": "y", "audience": "z", "core_anti_consensus": "", "contrarian_points": [], "cases": [], "data_points": [], "quotes": [], "forbidden": []}'

        designer = BlueprintDesigner(llm_call=fake_llm)
        hits = [
            RecallHit(
                id="r1",
                kind="case",
                text="杠杆者案例",
                source="run-1",
                tags=["杠杆者"],
                score=0.9,
            ),
            RecallHit(
                id="r2",
                kind="quote",
                text="AI 不替代思考",
                source="run-1",
                tags=[],
                score=0.8,
            ),
        ]
        designer.design(
            refined=_empty_refined(),
            framework_id="problem_decomposition",
            framework_output={"a": "b"},
            recalled_materials=hits,
        )
        prompt = captured["prompt"]
        assert "杠杆者案例" in prompt
        assert "AI 不替代思考" in prompt
        assert "参考素材" in prompt

    def test_recalled_materials_default_empty(self) -> None:
        """recalled_materials 不传时默认空 → prompt 中不出现参考素材区块"""
        captured: dict[str, str] = {}

        def fake_llm(prompt: str) -> str:
            captured["prompt"] = prompt
            return '{"proposition": "x", "stance": "y", "audience": "z", "core_anti_consensus": "", "contrarian_points": [], "cases": [], "data_points": [], "quotes": [], "forbidden": []}'

        designer = BlueprintDesigner(llm_call=fake_llm)
        designer.design(
            refined=_empty_refined(),
            framework_id="problem_decomposition",
            framework_output={"a": "b"},
        )
        # 显式不传 recalled_materials 时不应有参考素材块
        assert "参考素材" not in captured["prompt"]

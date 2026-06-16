"""socratic/output.py 测试

将 LLM 输出解析为 RefinedProposition（8 项产出）
参考 D-004 + 04-DATA-MODEL 2.3
"""
from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from lu.socratic.output import (
    RefinedProposition,
    StyleRecommendation,
    ContrarianPoint,
    FrameworkCandidate,
    parse_llm_response,
    build_refined_proposition,
)
from lu.socratic.questions import Question


def _sample_history() -> list[tuple[Question, str]]:
    q1 = Question(id="Q1", theme="命题浅层", prompt="x")
    q2 = Question(id="Q2", theme="底层逻辑", prompt="y")
    return [
        (q1, "我想讨论 AI 对内容创作者的影响"),
        (q2, "因为很多创作者被算法逼着写低质内容"),
    ]


def _sample_llm_response() -> str:
    return json.dumps(
        {
            "surface": "AI 对内容创作者的影响",
            "underlying": "算法经济逼着创作者写低质内容",
            "audience": "自媒体创作者 + 关心内容质量的人",
            "style_recommendation": {
                "voice": "犀利一针见血",
                "tone": "批判性",
                "examples": ["参考 mark 的反共识文风"],
            },
            "contrarian_candidates": [
                {
                    "point": "AI 不是问题，平台才是",
                    "rationale": "反共识：把责任推给算法经济结构",
                },
                {
                    "point": "低质内容是被算出来的理性选择",
                    "rationale": "反常识：把'低质'重新框架化为'最优'",
                },
            ],
            "framework_candidates": [
                {
                    "framework_id": "problem_decomposition",
                    "name": "问题解构",
                    "rationale": "拆解 AI/创作者/平台三角关系",
                },
                {
                    "framework_id": "innovation_breakthrough",
                    "name": "创新突破",
                    "rationale": "备选，重新框架'低质'的合理性",
                },
            ],
            "risks": ["话题敏感，可能引发平台限流", "论据需要数据支撑"],
            "falsifiability": "若 AI 工具让创作者收入翻倍，则命题失效",
        },
        ensure_ascii=False,
    )


class TestParseLLMResponse:
    def test_parse_valid_json(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert isinstance(result, RefinedProposition)
        assert result.surface == "AI 对内容创作者的影响"
        assert result.underlying.startswith("算法经济")

    def test_parse_style_recommendation(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert result.style_recommendation.voice == "犀利一针见血"
        assert result.style_recommendation.tone == "批判性"

    def test_parse_contrarian_candidates(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert len(result.contrarian_candidates) == 2
        assert result.contrarian_candidates[0].point.startswith("AI")

    def test_parse_framework_candidates(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert len(result.framework_candidates) == 2
        assert result.framework_candidates[0].framework_id == "problem_decomposition"

    def test_parse_risks(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert len(result.risks) == 2
        assert "限流" in result.risks[0]

    def test_parse_falsifiability(self):
        raw = _sample_llm_response()
        result = parse_llm_response(raw)

        assert "AI 工具" in result.falsifiability

    def test_parse_json_in_markdown_block(self):
        raw = "```json\n" + _sample_llm_response() + "\n```"
        result = parse_llm_response(raw)
        assert result.surface == "AI 对内容创作者的影响"

    def test_invalid_json_raises(self):
        with pytest.raises(ValueError, match="JSON"):
            parse_llm_response("not a json {")

    def test_missing_required_field_raises(self):
        bad = json.dumps({"surface": "x", "underlying": "y"})
        with pytest.raises((ValueError, ValidationError)):
            parse_llm_response(bad)


class TestBuildRefinedProposition:
    def test_uses_provided_llm_call(self):
        calls: list[str] = []

        def mock_llm(prompt: str) -> str:
            calls.append(prompt)
            return _sample_llm_response()

        result = build_refined_proposition(
            proposition="AI 时代内容创作者",
            history=_sample_history(),
            llm_call=mock_llm,
        )

        assert len(calls) == 1
        assert "AI 时代内容创作者" in calls[0]
        assert isinstance(result, RefinedProposition)
        assert result.surface == "AI 对内容创作者的影响"

    def test_prompt_includes_history(self):
        captured: list[str] = []

        def mock_llm(prompt: str) -> str:
            captured.append(prompt)
            return _sample_llm_response()

        build_refined_proposition(
            proposition="X",
            history=_sample_history(),
            llm_call=mock_llm,
        )

        assert "AI 对内容创作者的影响" in captured[0]
        assert "算法" in captured[0]

    def test_prompt_mentions_8_items(self):
        captured: list[str] = []

        def mock_llm(prompt: str) -> str:
            captured.append(prompt)
            return _sample_llm_response()

        build_refined_proposition(
            proposition="X",
            history=_sample_history(),
            llm_call=mock_llm,
        )

        for keyword in [
            "命题浅层", "底层逻辑", "潜在诉求", "风格",
            "反共识", "框架", "风险", "可证伪",
        ]:
            assert keyword in captured[0], f"Prompt missing: {keyword}"

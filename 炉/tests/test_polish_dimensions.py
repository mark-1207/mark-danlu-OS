"""polish/dimensions/ 测试

9 个维度（6 维 + L5 三项）：
- 温度 / 热度 / 深度 / 厚度 / 情绪曲线 / 知识迁移
- 观点锐度 / 思想模型应用 / 事实准确性

每个维度：
- name
- prompt_template（可调用）
- score(draft, llm_call) → DimensionScore
"""
from __future__ import annotations

import json

from lu.blueprint.models import Section, SectionRole
from lu.draft.models import Draft
from lu.polish.dimensions import (
    DEFAULT_DIMENSIONS,
    Dimension,
    temperature,
    heat,
    depth,
    thickness,
    emotion_curve,
    knowledge_transfer,
    viewpoint_sharpness,
    thinking_model_application,
    factual_accuracy,
)


def _draft(content: str = "文章正文") -> Draft:
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


def _ok_response(score: float, details: dict | None = None) -> str:
    return json.dumps({
        "score": score,
        "details": details or {"note": "ok"},
        "suggestions": [],
    }, ensure_ascii=False)


def _tracking_llm(responses: list[str]):
    calls: list[str] = []
    iterator = iter(responses)

    def call(prompt: str) -> str:
        calls.append(prompt)
        try:
            return next(iterator)
        except StopIteration:
            return "[NO_MORE]"

    return call, calls


class TestDimensionInterface:
    def test_dimension_has_required_fields(self):
        d = temperature
        assert d.name
        assert d.weight > 0
        assert callable(d.score)

    def test_score_returns_dimension_score(self):
        from lu.polish.models import DimensionScore

        llm, _ = _tracking_llm([_ok_response(8.0)])
        score = temperature.score(_draft(), llm)
        assert isinstance(score, DimensionScore)
        assert score.score == 8.0
        assert score.passed is True


class TestAllDimensions:
    def test_default_dimensions_count_is_9(self):
        assert len(DEFAULT_DIMENSIONS) == 9

    def test_all_named_dimensions_covered(self):
        names = {d.name for d in DEFAULT_DIMENSIONS}
        expected = {
            "温度", "热度", "深度", "厚度", "情绪曲线", "知识迁移",
            "观点锐度", "思想模型应用", "事实准确性",
        }
        assert names == expected

    def test_all_dimensions_have_positive_weight(self):
        for d in DEFAULT_DIMENSIONS:
            assert d.weight > 0

    def test_all_dimensions_can_be_evaluated(self):
        for d in DEFAULT_DIMENSIONS:
            llm, _ = _tracking_llm([_ok_response(8.0)])
            score = d.score(_draft(), llm)
            assert score.score == 8.0
            assert score.name == d.name


class TestDimensionScoring:
    def test_low_score_marks_failed(self):
        from lu.polish.models import DimensionScore

        llm, _ = _tracking_llm([_ok_response(6.0)])
        score = temperature.score(_draft(), llm)
        assert score.passed is False

    def test_invalid_json_returns_default_score(self):
        from lu.polish.models import DimensionScore

        llm, _ = _tracking_llm(["not json"])
        score = temperature.score(_draft(), llm)
        # 失败时默认 5.0
        assert isinstance(score, DimensionScore)
        assert score.score == 5.0

    def test_prompt_contains_draft_content(self):
        llm, calls = _tracking_llm([_ok_response(8.0)])
        temperature.score(_draft("钩子内容"), llm)
        assert "钩子内容" in calls[0]

    def test_each_dimension_passes_draft(self):
        # 各维度独立调用 LLM，但都应包含 draft 内容
        for d in DEFAULT_DIMENSIONS:
            llm, calls = _tracking_llm([_ok_response(8.0)])
            d.score(_draft("维度测试"), llm)
            assert len(calls) == 1
            assert "维度测试" in calls[0]


class TestAllNamedDimensions:
    """确认 9 个命名维度都可用"""

    def test_temperature(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = temperature.score(_draft(), llm)
        assert s.name == "温度"

    def test_heat(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = heat.score(_draft(), llm)
        assert s.name == "热度"

    def test_depth(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = depth.score(_draft(), llm)
        assert s.name == "深度"

    def test_thickness(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = thickness.score(_draft(), llm)
        assert s.name == "厚度"

    def test_emotion_curve(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = emotion_curve.score(_draft(), llm)
        assert s.name == "情绪曲线"

    def test_knowledge_transfer(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = knowledge_transfer.score(_draft(), llm)
        assert s.name == "知识迁移"

    def test_viewpoint_sharpness(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = viewpoint_sharpness.score(_draft(), llm)
        assert s.name == "观点锐度"

    def test_thinking_model_application(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = thinking_model_application.score(_draft(), llm)
        assert s.name == "思想模型应用"

    def test_factual_accuracy(self):
        llm, _ = _tracking_llm([_ok_response(8.0)])
        s = factual_accuracy.score(_draft(), llm)
        assert s.name == "事实准确性"
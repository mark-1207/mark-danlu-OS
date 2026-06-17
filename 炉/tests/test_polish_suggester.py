"""polish/suggester.py 测试

FixSuggester.suggest(report, llm_call) → List[FixSuggestion]
- 只为未通过的维度生成建议
- 每维度 1 条建议
"""
from __future__ import annotations

import json

from lu.polish.models import DimensionScore, FixSuggestion, QualityReport
from lu.polish.suggester import FixSuggester


def _dim(name: str, score: float, passed: bool | None = None) -> DimensionScore:
    return DimensionScore(
        name=name,
        score=score,
        details={},
        suggestions=[],
        passed=passed if passed is not None else score >= 7.5,
    )


def _report_with_failures() -> QualityReport:
    return QualityReport(
        temperature=_dim("温度", 8.0),
        heat=_dim("热度", 5.0),  # failed
        depth=_dim("深度", 9.0),
        thickness=_dim("厚度", 6.0),  # failed
        emotion_curve=_dim("情绪曲线", 8.0),
        knowledge_transfer=_dim("知识迁移", 8.0),
        viewpoint_sharpness=_dim("观点锐度", 4.0),  # failed
        thinking_model_application=_dim("思想模型应用", 8.0),
        factual_accuracy=_dim("事实准确性", 9.0),
    )


def _report_all_pass() -> QualityReport:
    return QualityReport(
        temperature=_dim("温度", 9.0),
        heat=_dim("热度", 8.0),
        depth=_dim("深度", 9.0),
        thickness=_dim("厚度", 8.0),
        emotion_curve=_dim("情绪曲线", 9.0),
        knowledge_transfer=_dim("知识迁移", 8.0),
        viewpoint_sharpness=_dim("观点锐度", 9.0),
        thinking_model_application=_dim("思想模型应用", 8.0),
        factual_accuracy=_dim("事实准确性", 9.0),
    )


def _ok_suggestion(text: str) -> str:
    return json.dumps({"suggestion": text}, ensure_ascii=False)


def _looping_llm(responses: list[str]):
    """循环返回 responses；耗尽则再循环（用于灵活测试）"""
    iterator = iter(responses)

    def call(prompt: str) -> str:
        nonlocal iterator
        try:
            return next(iterator)
        except StopIteration:
            return "[EXHAUSTED]"
    return call


class TestFixSuggesterSuggest:
    def test_returns_list(self):
        llm = lambda _: _ok_suggestion("加案例")
        suggester = FixSuggester()

        suggestions = suggester.suggest(_report_with_failures(), llm)

        assert isinstance(suggestions, list)

    def test_only_failed_dimensions_get_suggestions(self):
        # 3 个失败维度：热度 / 厚度 / 观点锐度
        responses = [_ok_suggestion(f"修复{i}") for i in range(3)]
        llm = _looping_llm(responses)

        suggester = FixSuggester()
        suggestions = suggester.suggest(_report_with_failures(), llm)

        assert len(suggestions) == 3

    def test_all_pass_returns_empty(self):
        llm = _looping_llm([""])
        suggester = FixSuggester()

        suggestions = suggester.suggest(_report_all_pass(), llm)

        assert suggestions == []

    def test_each_suggestion_has_dimension_name(self):
        responses = [_ok_suggestion(f"修复{i}") for i in range(3)]
        llm = _looping_llm(responses)

        suggester = FixSuggester()
        suggestions = suggester.suggest(_report_with_failures(), llm)

        names = {s.dimension for s in suggestions}
        assert "热度" in names
        assert "厚度" in names
        assert "观点锐度" in names

    def test_each_suggestion_has_text(self):
        responses = [_ok_suggestion(f"修复{i}") for i in range(3)]
        llm = _looping_llm(responses)

        suggester = FixSuggester()
        suggestions = suggester.suggest(_report_with_failures(), llm)

        for s in suggestions:
            assert isinstance(s, FixSuggestion)
            assert s.suggestion
            assert s.dimension


class TestFixSuggestionModel:
    def test_construction(self):
        s = FixSuggestion(dimension="温度", suggestion="增加温度词")
        assert s.dimension == "温度"
        assert s.suggestion == "增加温度词"

    def test_priority_default(self):
        s = FixSuggestion(dimension="x", suggestion="y")
        assert s.priority == "medium"


class TestFixSuggesterResilience:
    def test_llm_failure_skips_suggestion(self):
        llm = lambda _: "not json"
        suggester = FixSuggester()

        suggestions = suggester.suggest(_report_with_failures(), llm)

        # LLM 失败 → 跳过所有建议
        assert suggestions == []

    def test_partial_failure(self):
        # 第一次失败，第二次成功，第三次失败
        responses = ["bad", _ok_suggestion("修复厚度"), "bad"]
        llm = _looping_llm(responses)

        suggester = FixSuggester()
        suggestions = suggester.suggest(_report_with_failures(), llm)

        # 至少有一条建议（成功的那条）
        assert len(suggestions) >= 1
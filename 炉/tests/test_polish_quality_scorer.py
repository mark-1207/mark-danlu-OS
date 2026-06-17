"""polish/quality_scorer.py 测试

QualityScorer.score(draft, blueprint, llm_call) → QualityReport
- 9 维度串行评分
- 任一维度失败不影响其他维度
- overall_passed / weakest_dimension 自动计算
"""
from __future__ import annotations

import json

import pytest

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Section,
    SectionRole,
)
from lu.draft.models import Draft
from lu.polish.quality_scorer import QualityScorer


def _draft(content: str = "正文") -> Draft:
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


def _blueprint() -> Blueprint:
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
        sections=[],
        anti_ai_anchors=AntiAIAnchors(),
    )


def _ok(score: float) -> str:
    return json.dumps({"score": score, "details": {}, "suggestions": []})


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


class TestQualityScorerScore:
    def test_returns_quality_report(self):
        from lu.polish.models import QualityReport

        llm, _ = _tracking_llm([_ok(8.0)] * 9)
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        assert isinstance(r, QualityReport)

    def test_calls_llm_once_per_dimension(self):
        llm, calls = _tracking_llm([_ok(8.0)] * 9)
        scorer = QualityScorer()

        scorer.score(_draft(), _blueprint(), llm)

        assert len(calls) == 9

    def test_all_pass_when_all_high(self):
        llm, _ = _tracking_llm([_ok(9.0)] * 9)
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        assert r.overall_passed is True

    def test_overall_failed_when_any_low(self):
        llm, _ = _tracking_llm([
            _ok(8.0), _ok(8.0), _ok(8.0),
            _ok(8.0), _ok(8.0), _ok(8.0),
            _ok(8.0), _ok(8.0), _ok(5.0),  # 最后一项 5.0 失败
        ])
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        assert r.overall_passed is False

    def test_weakest_dimension_identified(self):
        llm, _ = _tracking_llm([
            _ok(8.0), _ok(8.0), _ok(8.0),
            _ok(8.0), _ok(8.0), _ok(8.0),
            _ok(8.0), _ok(8.0), _ok(3.0),  # 最后一项最低
        ])
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        assert r.weakest_dimension == "事实准确性"


class TestQualityScorerResilience:
    def test_one_dimension_failure_does_not_break_others(self):
        llm, _ = _tracking_llm([
            _ok(8.0), "bad", _ok(8.0),  # 第 2 个失败
            _ok(8.0), _ok(8.0), _ok(8.0),
            _ok(8.0), _ok(8.0), _ok(8.0),
        ])
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        # 第 2 个（热度）默认 5.0，其他正常
        assert r.heat.score == 5.0
        assert r.temperature.score == 8.0

    def test_all_dimensions_fail_returns_report_with_defaults(self):
        llm, _ = _tracking_llm(["bad"] * 9)
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        # 所有维度都默认 5.0
        for field in [
            "temperature", "heat", "depth", "thickness",
            "emotion_curve", "knowledge_transfer",
            "viewpoint_sharpness", "thinking_model_application",
            "factual_accuracy",
        ]:
            assert getattr(r, field).score == 5.0


class TestQualityScorerMetadata:
    def test_generated_at_set(self):
        llm, _ = _tracking_llm([_ok(8.0)] * 9)
        scorer = QualityScorer()

        r = scorer.score(_draft(), _blueprint(), llm)

        assert r.generated_at is not None
"""polish/models.py 测试

DimensionScore + QualityReport：
- score 0-10，passed = (>= 7.5)
- QualityReport 9 维度字段（6 维 + L5 三项）+ overall_passed + weakest_dimension
"""
from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from lu.polish.models import DimensionScore, QualityReport


def _dim(name: str, score: float = 7.0) -> DimensionScore:
    return DimensionScore(
        name=name,
        score=score,
        details={"note": "test"},
    )


class TestDimensionScore:
    def test_passed_true_when_score_above_threshold(self):
        d = DimensionScore(name="温度", score=8.0, details={})
        assert d.passed is True

    def test_passed_true_at_threshold(self):
        d = DimensionScore(name="温度", score=7.5, details={})
        assert d.passed is True

    def test_passed_false_below_threshold(self):
        d = DimensionScore(name="温度", score=7.0, details={})
        assert d.passed is False

    def test_suggestions_default_empty(self):
        d = DimensionScore(name="x", score=8.0, details={})
        assert d.suggestions == []

    def test_score_must_be_in_range(self):
        with pytest.raises(ValidationError):
            DimensionScore(name="x", score=11.0, details={})

        with pytest.raises(ValidationError):
            DimensionScore(name="x", score=-0.1, details={})

    def test_details_accepts_dict(self):
        d = DimensionScore(
            name="x",
            score=8.0,
            details={"strength": "good", "weakness": "shallow"},
        )
        assert d.details["strength"] == "good"


class TestQualityReport:
    def _make_full_report(self) -> QualityReport:
        return QualityReport(
            temperature=_dim("温度", 8.5),
            heat=_dim("热度", 6.5),
            depth=_dim("深度", 8.0),
            thickness=_dim("厚度", 7.0),
            emotion_curve=_dim("情绪曲线", 9.0),
            knowledge_transfer=_dim("知识迁移", 7.0),
            viewpoint_sharpness=_dim("观点锐度", 6.0),
            thinking_model_application=_dim("思想模型应用", 8.0),
            factual_accuracy=_dim("事实准确性", 9.0),
        )

    def test_construction(self):
        r = self._make_full_report()
        assert r.temperature.score == 8.5
        assert r.factual_accuracy.passed is True

    def test_overall_passed_all_pass(self):
        r = QualityReport(
            temperature=_dim("x", 9.0),
            heat=_dim("x", 8.0),
            depth=_dim("x", 8.0),
            thickness=_dim("x", 8.0),
            emotion_curve=_dim("x", 8.0),
            knowledge_transfer=_dim("x", 8.0),
            viewpoint_sharpness=_dim("x", 8.0),
            thinking_model_application=_dim("x", 8.0),
            factual_accuracy=_dim("x", 8.0),
        )
        assert r.overall_passed is True

    def test_overall_passed_any_fail(self):
        r = self._make_full_report()
        # heat 6.5 < 7.5 failed
        assert r.overall_passed is False

    def test_weakest_dimension(self):
        r = self._make_full_report()
        # 最低分：观点锐度 6.0
        assert r.weakest_dimension == "观点锐度"

    def test_weakest_dimension_unique_when_tied(self):
        r = QualityReport(
            temperature=_dim("温度", 5.0),
            heat=_dim("热度", 5.0),
            depth=_dim("深度", 8.0),
            thickness=_dim("厚度", 8.0),
            emotion_curve=_dim("情绪曲线", 8.0),
            knowledge_transfer=_dim("知识迁移", 8.0),
            viewpoint_sharpness=_dim("观点锐度", 8.0),
            thinking_model_application=_dim("思想模型应用", 8.0),
            factual_accuracy=_dim("事实准确性", 8.0),
        )
        # 平局时取第一个（或某个确定规则）
        assert r.weakest_dimension in ("温度", "热度")

    def test_generated_at_set(self):
        r = self._make_full_report()
        assert isinstance(r.generated_at, datetime)

    def test_json_roundtrip(self):
        r = self._make_full_report()
        j = r.model_dump_json()
        r2 = QualityReport.model_validate_json(j)
        assert r2 == r
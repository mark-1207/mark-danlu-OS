"""打磨数据模型

参考 docs/04-DATA-MODEL.md 2.7 QualityReport
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


PASS_THRESHOLD = 7.5


class DimensionScore(BaseModel):
    """单维度评分

    score: 0-10
    passed: score >= PASS_THRESHOLD
    """

    name: str
    score: float = Field(ge=0, le=10)
    details: dict
    suggestions: list[str] = Field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.score >= PASS_THRESHOLD


class FixSuggestion(BaseModel):
    """修复建议"""

    dimension: str
    suggestion: str
    priority: str = "medium"


class QualityReport(BaseModel):
    """质量报告：9 维度评分 + 汇总"""

    temperature: DimensionScore
    heat: DimensionScore
    depth: DimensionScore
    thickness: DimensionScore
    emotion_curve: DimensionScore
    knowledge_transfer: DimensionScore
    viewpoint_sharpness: DimensionScore
    thinking_model_application: DimensionScore
    factual_accuracy: DimensionScore

    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def all_dimensions(self) -> list[DimensionScore]:
        return [
            self.temperature, self.heat, self.depth, self.thickness,
            self.emotion_curve, self.knowledge_transfer,
            self.viewpoint_sharpness, self.thinking_model_application,
            self.factual_accuracy,
        ]

    @property
    def overall_passed(self) -> bool:
        return all(d.passed for d in self.all_dimensions)

    @property
    def weakest_dimension(self) -> str:
        return min(self.all_dimensions, key=lambda d: d.score).name
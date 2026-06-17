"""质量评分器：9 维度串行评分，容错回退 5.0

参考 docs/03-MODULE-DESIGN.md 3.5
"""
from __future__ import annotations

from typing import Callable

from lu.blueprint.models import Blueprint
from lu.draft.models import Draft
from lu.polish.dimensions import DEFAULT_DIMENSIONS
from lu.polish.models import DimensionScore, QualityReport


_LLMCall = Callable[[str], str]


class QualityScorer:
    """质量评分器

    score(draft, blueprint, llm_call) → QualityReport
    """

    def __init__(self, dimensions: list | None = None) -> None:
        self.dimensions = dimensions if dimensions is not None else DEFAULT_DIMENSIONS

    def score(
        self,
        draft: Draft,
        blueprint: Blueprint,
        llm_call: _LLMCall,
    ) -> QualityReport:
        scores: dict[str, DimensionScore] = {}
        for dim in self.dimensions:
            scores[dim.name] = dim.score(draft, llm_call)

        return QualityReport(
            temperature=scores["温度"],
            heat=scores["热度"],
            depth=scores["深度"],
            thickness=scores["厚度"],
            emotion_curve=scores["情绪曲线"],
            knowledge_transfer=scores["知识迁移"],
            viewpoint_sharpness=scores["观点锐度"],
            thinking_model_application=scores["思想模型应用"],
            factual_accuracy=scores["事实准确性"],
        )
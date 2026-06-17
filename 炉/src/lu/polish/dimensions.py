"""9 个评分维度

- 6 维：温度 / 热度 / 深度 / 厚度 / 情绪曲线 / 知识迁移
- L5 三项：观点锐度 / 思想模型应用 / 事实准确性

每个维度：name + weight + score(draft, llm_call) → DimensionScore
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Callable

from lu.draft.models import Draft
from lu.polish.models import DimensionScore


_LLMCall = Callable[[str], str]


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def _parse_score(raw: str, dim_name: str) -> DimensionScore:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return DimensionScore(name=dim_name, score=5.0, details={"error": "invalid_json"})

    if not isinstance(data, dict):
        return DimensionScore(name=dim_name, score=5.0, details={"error": "not_dict"})

    raw_score = data.get("score", 5.0)
    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        score = 5.0
    score = max(0.0, min(10.0, score))

    details = data.get("details", {}) if isinstance(data.get("details"), dict) else {}
    suggestions = data.get("suggestions", []) if isinstance(data.get("suggestions"), list) else []

    return DimensionScore(
        name=dim_name,
        score=score,
        details=details,
        suggestions=[str(s) for s in suggestions],
    )


def _draft_text(draft: Draft) -> str:
    parts = [draft.title, *(s.content or "" for s in draft.sections)]
    return "\n\n".join(parts)


def _build_dim_prompt(dim_desc: str, draft_text: str) -> str:
    return f"""你是内容质量评审。基于以下文章评分（0-10）。

【维度】{dim_desc}

【文章】
{draft_text}

【输出格式】严格 JSON：
{{"score": 0.0, "details": {{}}, "suggestions": []}}"""


@dataclass(frozen=True)
class Dimension:
    name: str
    weight: float
    description: str
    score: Callable[[Draft, _LLMCall], DimensionScore]


def _make_dim(name: str, weight: float, description: str):
    def _score(draft: Draft, llm_call: _LLMCall) -> DimensionScore:
        prompt = _build_dim_prompt(description, _draft_text(draft))
        raw = llm_call(prompt)
        return _parse_score(raw, name)
    return Dimension(name=name, weight=weight, description=description, score=_score)


# 6 维
temperature = _make_dim(
    "温度",
    1.0,
    "温度：是否有鲜明的情绪和人格（冷冰冰 vs 有血有肉）",
)
heat = _make_dim(
    "热度",
    1.0,
    "热度：是否触及大众关心或争议的话题（共鸣度）",
)
depth = _make_dim(
    "深度",
    1.0,
    "深度：是否挖到根因/本质，不停留在表面现象",
)
thickness = _make_dim(
    "厚度",
    1.0,
    "厚度：是否有充分的事实/案例/数据支撑（不空洞）",
)
emotion_curve = _make_dim(
    "情绪曲线",
    1.0,
    "情绪曲线：读者的情绪是否有起伏变化（不是平铺直叙）",
)
knowledge_transfer = _make_dim(
    "知识迁移",
    1.0,
    "知识迁移：是否能从一个领域迁移到另一个领域（举一反三）",
)

# L5 三项
viewpoint_sharpness = _make_dim(
    "观点锐度",
    1.5,
    "观点锐度：核心观点是否锋利、不和稀泥",
)
thinking_model_application = _make_dim(
    "思想模型应用",
    1.5,
    "思想模型应用：是否正确使用了思想模型（不是堆砌术语）",
)
factual_accuracy = _make_dim(
    "事实准确性",
    1.5,
    "事实准确性：数据/案例/引用是否经得起查证",
)


DEFAULT_DIMENSIONS: list[Dimension] = [
    temperature,
    heat,
    depth,
    thickness,
    emotion_curve,
    knowledge_transfer,
    viewpoint_sharpness,
    thinking_model_application,
    factual_accuracy,
]
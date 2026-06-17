"""雷达：从历史 context 推荐可能的新命题

- 提取历史的主题/反共识
- 调用 LLM 衍生候选命题
- 容错：JSON 失败 → 空列表
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

from lu.pipeline.models import Context


@dataclass
class PropositionCandidate:
    """候选命题"""

    proposition: str
    rationale: str
    related_themes: list[str] = field(default_factory=list)


_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = _FENCE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def _themes_from_history(history: Iterable[Context]) -> list[str]:
    """从历史 context 提取主题（contrarian_signals + key_terms）"""
    themes: list[str] = []
    for ctx in history:
        if ctx.refined_proposition and ctx.refined_proposition.contrarian_candidates:
            for cp in ctx.refined_proposition.contrarian_candidates:
                if cp.point and cp.point not in themes:
                    themes.append(cp.point)
        if ctx.harvested:
            for insight in ctx.harvested.insights:
                if insight.text and insight.text not in themes:
                    themes.append(insight.text)
    return themes[:20]


def _build_prompt(themes: list[str]) -> str:
    return f"""你是内容雷达。基于用户历史主题，衍生 3-5 个新的可写命题。

【历史主题】
{chr(10).join(f'- {t}' for t in themes) if themes else '（无历史）'}

【输出格式】
严格 JSON：{{"candidates": [{{"proposition": "...", "rationale": "...", "related_themes": ["..."]}}, ...]}}
"""


def suggest_propositions(
    history: Iterable[Context],
    llm_call: Callable[[str], str],
) -> list[PropositionCandidate]:
    """从历史衍生候选命题"""
    themes = _themes_from_history(history)
    prompt = _build_prompt(themes)
    raw = llm_call(prompt)
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, dict):
        return []
    items = data.get("candidates", [])
    if not isinstance(items, list):
        return []
    out: list[PropositionCandidate] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        out.append(
            PropositionCandidate(
                proposition=str(item.get("proposition", "")),
                rationale=str(item.get("rationale", "")),
                related_themes=list(item.get("related_themes", []) or []),
            )
        )
    return out


__all__ = ["PropositionCandidate", "suggest_propositions"]

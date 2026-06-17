"""修复建议生成器

只对未通过（score < 7.5）的维度生成建议
"""
from __future__ import annotations

import json
import re
from typing import Callable

from lu.polish.models import FixSuggestion, QualityReport


_LLMCall = Callable[[str], str]


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def _parse_suggestion(raw: str) -> str | None:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    s = data.get("suggestion")
    return s if isinstance(s, str) and s.strip() else None


class FixSuggester:
    """修复建议生成器

    suggest(report, llm_call) → List[FixSuggestion]
    """

    @staticmethod
    def suggest(report: QualityReport, llm_call: _LLMCall) -> list[FixSuggestion]:
        failed = [d for d in report.all_dimensions if not d.passed]
        if not failed:
            return []

        suggestions: list[FixSuggestion] = []
        for dim in failed:
            prompt = (
                f"维度「{dim.name}」得分 {dim.score}/10（< 7.5 未通过）。\n"
                f"详情：{json.dumps(dim.details, ensure_ascii=False)}\n\n"
                f"给出一条可执行的修复建议。\n"
                f"输出 JSON：{{\"suggestion\": \"修复建议文本\"}}"
            )
            raw = llm_call(prompt)
            text = _parse_suggestion(raw)
            if text:
                suggestions.append(FixSuggestion(dimension=dim.name, suggestion=text))
        return suggestions
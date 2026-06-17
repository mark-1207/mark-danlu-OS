"""Harvester：从草稿 + 追问产出 提取产物；与 mark 标注的草稿做 diff

参考 docs/03-MODULE-DESIGN.md 3.6
"""
from __future__ import annotations

import difflib
import json
import re
from typing import Callable

from lu.blueprint.models import Case, Quote
from lu.draft.models import Draft
from lu.sediment.models import DiffResult, Harvested, Insight
from lu.socratic.output import ContrarianPoint, RefinedProposition


_LLMCall = Callable[[str], str]


SHORT_PARA_THRESHOLD = 10


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _extract_prompt(draft: Draft, refined: RefinedProposition) -> str:
    draft_text = "\n\n".join(
        f"【{s.role.value}】{s.content or ''}" for s in draft.sections
    )
    return f"""你是内容资产提取器。从草稿中提取可复用的内容资产。

【草稿】
{draft_text}

【追问产出】
{json.dumps(refined.model_dump(), ensure_ascii=False, indent=2)}

【提取目标】
- cases: 案例数组（{{title, summary}}）
- quotes: 金句数组（{{text, author}}）
- insights: 洞察数组（{{text, source}}）
- contrarian_points: 反共识数组（{{point, rationale}}）

【输出格式】严格 JSON。"""


def _parse_extract_response(raw: str) -> Harvested:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return Harvested()

    if not isinstance(data, dict):
        return Harvested()

    cases = [Case(**c) for c in data.get("cases", []) if isinstance(c, dict)]
    quotes = [Quote(**q) for q in data.get("quotes", []) if isinstance(q, dict)]
    insights = [
        Insight(**i) for i in data.get("insights", []) if isinstance(i, dict)
    ]
    contrarians = [
        ContrarianPoint(**c)
        for c in data.get("contrarian_points", [])
        if isinstance(c, dict)
    ]

    return Harvested(
        cases=cases,
        quotes=quotes,
        insights=insights,
        contrarian_points=contrarians,
    )


class Harvester:
    """沉淀提取器"""

    @staticmethod
    def extract(
        draft: Draft,
        refined: RefinedProposition,
        llm_call: _LLMCall,
    ) -> Harvested:
        prompt = _extract_prompt(draft, refined)
        raw = llm_call(prompt)
        return _parse_extract_response(raw)

    @staticmethod
    def diff(original: Draft, marked: Draft) -> DiffResult:
        original_text = "\n\n".join((s.content or "") for s in original.sections)
        marked_text = "\n\n".join((s.content or "") for s in marked.sections)

        original_paras = _split_paragraphs(original_text)
        marked_paras = _split_paragraphs(marked_text)

        sm = difflib.SequenceMatcher(None, original_paras, marked_paras)
        removed: list[str] = []
        modified: list[tuple[str, str]] = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "delete":
                removed.extend(original_paras[i1:i2])
            elif tag == "replace":
                for orig, new in zip(original_paras[i1:i2], marked_paras[j1:j2]):
                    modified.append((orig, new))

        forbidden = [r for r in removed if 0 < len(r) < SHORT_PARA_THRESHOLD]

        return DiffResult(
            removed=removed,
            modified=modified,
            forbidden_candidates=forbidden,
        )
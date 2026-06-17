"""草稿生成器：每段独立 LLM 调用，重试 + 失败跳过

参考 docs/03-MODULE-DESIGN.md 3.4
"""
from __future__ import annotations

import json
import re
import time
from typing import Callable

from lu.blueprint.models import Blueprint, Section, SectionRole
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.draft.section_prompt import SectionPromptBuilder


_LLMCall = Callable[[str], str]


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def _parse_section_output(raw: str) -> tuple[str, float] | None:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    content = data.get("content")
    if not isinstance(content, str):
        return None
    confidence = data.get("self_confidence", 0.0)
    if not isinstance(confidence, (int, float)):
        confidence = 0.0
    return content, float(confidence)


class DraftGenerator:
    """草稿生成器：注入 LLM 调用，按段独立生成 + 重试"""

    def __init__(self, llm_call: _LLMCall, max_retries: int = 2) -> None:
        self.llm_call = llm_call
        self.max_retries = max_retries

    def generate(self, blueprint: Blueprint, style: StyleProfile) -> Draft:
        start = time.monotonic()
        generated: list[Section] = []
        failed: list[SectionRole] = []

        for original_section in blueprint.sections:
            filled = self._generate_section_with_retries(original_section, blueprint, style)
            if filled is None:
                failed.append(original_section.role)
            else:
                generated.append(filled)

        total_words = sum(len(s.content or "") for s in generated)

        return Draft(
            title=blueprint.proposition,
            sections=generated,
            total_word_count=total_words,
            generation_duration_sec=time.monotonic() - start,
            failed_sections=failed,
        )

    def _generate_section_with_retries(
        self,
        section: Section,
        blueprint: Blueprint,
        style: StyleProfile,
    ) -> Section | None:
        prompt = SectionPromptBuilder.build(section, blueprint, style)
        last_err: str | None = None

        for attempt in range(self.max_retries + 1):
            raw = self.llm_call(prompt)
            parsed = _parse_section_output(raw)
            if parsed is not None:
                content, confidence = parsed
                return section.model_copy(update={
                    "content": content,
                    "self_confidence": confidence,
                })
            last_err = raw[:80]

        return None
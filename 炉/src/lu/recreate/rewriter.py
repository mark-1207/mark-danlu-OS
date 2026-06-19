"""recreate 5 段重写

输入：原文 + 改写指令 + Blueprint 风格
输出：5 段 Draft（hook/anti_consensus/case/thinking/closing）

策略：
- 用 viral_structure.extract 提取原文章结构（hook/contrarian/case/closing 等）
- 按改写方向构造 prompt
- LLM 生成新内容，套入 5 段结构
- 复用 5 段角色（HOOK/ANTI_CONSENSUS/CASE/THINKING/CLOSING）
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from typing import Callable

from lu.blueprint.models import Blueprint, Section, SectionRole
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.recreate.directive import RewriteDirective
from lu.recreate.loader import SourceText


def _build_rewrite_prompt(
    source: SourceText,
    directive: RewriteDirective,
    style_profile: StyleProfile | None = None,
) -> str:
    """构造改写 prompt"""
    style_text = ""
    if style_profile:
        forbidden = style_profile.forbidden or []
        if forbidden:
            style_text += f"\n- 必避免：{', '.join(forbidden[:10])}"

    direction_text = {
        "preserve_stance": "保留原文立场和观点，只调整语言风格和表达",
        "switch_view": "从对立视角重写（反方/中立/另一种立场）",
        "rewrite_struct": "重写文章结构（5 段顺序或角色可调整）",
        "rewrite_free": "完全重写，仅借鉴原文部分素材",
    }[directive.direction.value]

    return f"""你是 mark。基于原文和改写指令，撰写一篇新的 5 段长文。

【原文】
{source.text[:3000]}

【改写方向】
{direction_text}

【改写指令（用户原话）】
{directive.raw}
{style_text}

【输出格式】
严格 JSON：
{{
  "title": "新标题",
  "sections": {{
    "hook": "开篇钩子...",
    "anti_consensus": "反共识...",
    "case": "案例...",
    "thinking": "思考...",
    "closing": "收尾..."
  }}
}}
不要 markdown 代码块外的内容。
"""


def _parse_rewrite_response(raw: str) -> tuple[str, dict[str, str]]:
    """解析 LLM 返回的 {title, sections: {hook, ...}} JSON"""
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"recreate LLM 输出不是合法 JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValueError("recreate LLM 输出 JSON 顶层必须是 object")
    title = str(data.get("title", "")).strip()
    sections_raw = data.get("sections") or {}
    if not isinstance(sections_raw, dict):
        sections_raw = {}
    sections = {k: str(v).strip() for k, v in sections_raw.items() if v}
    return title, sections


_ROLE_ORDER: list[SectionRole] = [
    SectionRole.HOOK,
    SectionRole.ANTI_CONSENSUS,
    SectionRole.CASE,
    SectionRole.THINKING,
    SectionRole.CLOSING,
]


def _build_sections(
    sections_dict: dict[str, str], word_limits: dict[SectionRole, int] | None = None
) -> list[Section]:
    """把 sections dict 转成 Section 列表（按 5 段顺序）"""
    default_limits = {
        SectionRole.HOOK: 120,
        SectionRole.ANTI_CONSENSUS: 300,
        SectionRole.CASE: 400,
        SectionRole.THINKING: 500,
        SectionRole.CLOSING: 150,
    }
    if word_limits:
        default_limits.update(word_limits)

    out: list[Section] = []
    for role in _ROLE_ORDER:
        # 找匹配的 key（大小写不敏感，匹配 "hook" / "Hook" / "HOOK"）
        content = ""
        for k, v in sections_dict.items():
            if k.lower() == role.value:
                content = v
                break
        out.append(
            Section(
                role=role,
                must_have=[],
                word_limit=default_limits.get(role, 300),
                style_hint="recreate",
                thinking_model_hint=None,
                content=content,
                self_confidence=0.8,
            )
        )
    return out


def generate_recreate_draft(
    source: SourceText,
    directive: RewriteDirective,
    llm_call: Callable[[str], str],
    style_profile: StyleProfile | None = None,
) -> Draft:
    """recreate 5 段重写"""
    prompt = _build_rewrite_prompt(source, directive, style_profile)
    start = time.time()
    raw = llm_call(prompt)
    duration = time.time() - start

    title, sections_dict = _parse_rewrite_response(raw)
    if not title:
        title = source.title or "重写文章"

    sections = _build_sections(sections_dict)
    total_words = sum(len(s.content or "") for s in sections)

    return Draft(
        title=title,
        sections=sections,
        total_word_count=total_words,
        generated_at=datetime.now(timezone.utc),
        generation_duration_sec=duration,
        failed_sections=[],
    )


__all__ = ["generate_recreate_draft"]

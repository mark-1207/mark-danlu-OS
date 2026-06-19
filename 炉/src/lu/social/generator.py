"""social 模式草稿生成：1 段短文

输入：proposition + title + platform + style_profile
输出：Draft (1 section)
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from typing import Callable

from lu.blueprint.models import Section, SectionRole
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.social.platforms import PlatformConfig
from lu.social.prompts import build_draft_prompt


def _parse_draft_response(raw: str) -> tuple[str, list[str]]:
    """解析 LLM 返回的 {content, hashtags} JSON

    容错：处理 markdown 代码块、缺字段。
    """
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return text, []
    if not isinstance(data, dict):
        return text, []
    content = str(data.get("content", "")).strip()
    raw_tags = data.get("hashtags") or data.get("tags") or []
    if not isinstance(raw_tags, list):
        raw_tags = []
    hashtags = [str(t).strip() for t in raw_tags if t]
    return content, hashtags


def _format_with_hashtags(content: str, hashtags: list[str], platform: PlatformConfig) -> str:
    """正文末尾追加平台格式的 hashtags"""
    if not hashtags:
        return content
    tag_str = platform.format_hashtags(hashtags)
    if not tag_str:
        return content
    return f"{content}\n\n{tag_str}"


def _build_social_section(content: str, platform: PlatformConfig) -> Section:
    """构造 social 模式的单 section"""
    return Section(
        role=SectionRole.HOOK,
        must_have=[],
        word_limit=platform.max_length,
        style_hint=f"social/{platform.name}: {platform.tone}",
        thinking_model_hint=None,
        content=content,
        self_confidence=0.85,
    )


def generate_social_draft(
    proposition: str,
    title: str,
    platform: PlatformConfig,
    llm_call: Callable[[str], str],
    style_profile: StyleProfile | None = None,
) -> Draft:
    """social 模式：1 段草稿生成"""
    style_dict = style_profile.model_dump() if style_profile is not None else None
    prompt = build_draft_prompt(
        proposition=proposition,
        title=title,
        platform=platform,
        style_profile=style_dict,
    )

    start = time.time()
    raw = llm_call(prompt)
    duration = time.time() - start

    content, hashtags = _parse_draft_response(raw)
    content = _format_with_hashtags(content, hashtags, platform)

    return Draft(
        title=title,
        sections=[_build_social_section(content, platform)],
        total_word_count=len(content),
        generated_at=datetime.now(timezone.utc),
        generation_duration_sec=duration,
        failed_sections=[],
    )


__all__ = ["generate_social_draft"]

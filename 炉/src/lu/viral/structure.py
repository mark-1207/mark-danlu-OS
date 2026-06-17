"""爆款文章结构提取

- 复用 socratic.output._strip_code_fence 风格做 JSON 容错
- source_text 截前 5000 字
- 失败时返回空字段占位
"""
from __future__ import annotations

import json
import re
from typing import Callable

from pydantic import BaseModel, Field


MAX_SOURCE_CHARS = 5000


class ArticleStructure(BaseModel):
    """爆款文章结构"""

    source_url: str | None = None
    source_text: str = ""
    hook: str = ""
    contrarian: str = ""
    case_summary: str = ""
    thinking_model: str = ""
    closing_quote: str = ""
    key_terms: list[str] = Field(default_factory=list)
    contrarian_signals: list[str] = Field(default_factory=list)


_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = _FENCE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def _build_prompt(article: str) -> str:
    return f"""你是内容结构分析器。从给定文章中提取爆款结构，输出严格 JSON。

【文章】
{article[:3000]}

【输出字段】
- hook: 钩子（前 100 字内抓人的句子）
- contrarian: 反共识点（一句话）
- case_summary: 案例摘要（一句话）
- thinking_model: 用的思想模型（"第一性原理"/"反共识"/"奥卡姆剃刀"等）
- closing_quote: 收尾金句
- key_terms: 关键术语数组
- contrarian_signals: 反共识信号数组

严格 JSON，无 markdown 代码块。"""


def extract_structure(
    article: str,
    llm_call: Callable[[str], str],
    source_url: str | None = None,
) -> ArticleStructure:
    """从文章提取结构"""
    truncated = article[:MAX_SOURCE_CHARS]

    prompt = _build_prompt(truncated)
    raw = llm_call(prompt)
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return ArticleStructure(source_url=source_url, source_text=truncated)

    if not isinstance(data, dict):
        return ArticleStructure(source_url=source_url, source_text=truncated)

    return ArticleStructure(
        source_url=source_url,
        source_text=truncated,
        hook=str(data.get("hook", "")),
        contrarian=str(data.get("contrarian", "")),
        case_summary=str(data.get("case_summary", "")),
        thinking_model=str(data.get("thinking_model", "")),
        closing_quote=str(data.get("closing_quote", "")),
        key_terms=list(data.get("key_terms", []) or []),
        contrarian_signals=list(data.get("contrarian_signals", []) or []),
    )


__all__ = ["ArticleStructure", "extract_structure"]

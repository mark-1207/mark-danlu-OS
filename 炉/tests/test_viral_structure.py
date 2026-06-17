"""结构提取测试

- 正常 LLM JSON 返回 → ArticleStructure
- 失败 JSON → 容错返回空字段
- 截断 source_text 到 5000 字
"""
from __future__ import annotations

import json

from lu.viral.structure import ArticleStructure, extract_structure


def _llm_ok(_prompt: str = "") -> str:
    return json.dumps(
        {
            "hook": "震撼开场",
            "contrarian": "AI 不会让你变贵",
            "case_summary": "朋友 A 案例",
            "thinking_model": "第一性原理",
            "closing_quote": "AI 是杠杆不是工资",
            "key_terms": ["AI", "杠杆"],
            "contrarian_signals": ["反常识", "反共识"],
        },
        ensure_ascii=False,
    )


def _llm_bad(_prompt: str = "") -> str:
    return "not json"


def test_extract_ok() -> None:
    art = extract_structure("原文...", _llm_ok, source_url="https://x.com")
    assert isinstance(art, ArticleStructure)
    assert art.hook == "震撼开场"
    assert art.source_url == "https://x.com"
    assert art.source_text == "原文..."


def test_extract_truncates_long_text() -> None:
    long_text = "a" * 10000
    art = extract_structure(long_text, _llm_ok)
    assert len(art.source_text) == 5000


def test_extract_invalid_json_returns_empty() -> None:
    art = extract_structure("x", _llm_bad)
    assert art.hook == ""
    assert art.contrarian == ""
    # source_text 仍在
    assert art.source_text == "x"

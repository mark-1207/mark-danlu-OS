"""Viral Pipeline 测试

- 端到端 mock LLM
- structure + draft + quality_report + harvested 全部返回
"""
from __future__ import annotations

import json

from lu.config.loader import StyleProfile
from lu.viral.pipeline import remix


def _llm(_prompt: str = "") -> str:
    p = _prompt
    if "爆款结构" in p or "核心反共识" in p:
        return json.dumps(
            {
                "hook": "震撼开场",
                "contrarian": "AI 不会让你变贵",
                "case_summary": "朋友 A",
                "thinking_model": "第一性原理",
                "closing_quote": "AI 是杠杆",
                "key_terms": ["AI"],
                "contrarian_signals": ["反常识"],
            },
            ensure_ascii=False,
        )
    if "蓝图字段" in p:
        return json.dumps(
            {
                "proposition": "新命题", "stance": "立场", "audience": "读者",
                "core_anti_consensus": "反共识", "cases": [], "data": [],
                "quotes": [], "forbidden": [],
            },
            ensure_ascii=False,
        )
    if '"content"' in p and "self_confidence" in p:
        return json.dumps({"content": "段位内容", "self_confidence": 0.9})
    if "score" in p and "details" in p:
        return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
    if "内容资产提取器" in p:
        return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
    if "【思想模型" in p:
        return "m"
    return "{}"


def test_remix_end_to_end() -> None:
    result = remix(
        new_proposition="新命题",
        reference_text="参考文章...",
        llm_call=_llm,
        style=StyleProfile(),
    )
    assert result["structure"].hook == "震撼开场"
    assert result["draft"].total_word_count >= 1
    assert result["quality_report"] is not None
    assert result["harvested"] is not None
    assert result["style_profile_snapshot"] is not None

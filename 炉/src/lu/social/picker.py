"""标题自动选：1 维 × N 候选 + 按锐度自动选最优

锐度评分规则（启发式，无需 LLM）：
- 含数字/数据/百分比：+2
- 含反问/挑战词：+1.5
- 含尖锐词（"该死/荒谬/可悲/陷阱/陷阱/骗局/幻觉"等）：+1
- 含"AI/算法/数据/智能/技术"等热点词：+0.5
- 长度 8-20 字：+0.5
- 以问号或感叹号结尾：+0.5

最终选分数最高的。
"""
from __future__ import annotations

import json
import re
from typing import Callable


_SHARP_WORDS = frozenset(
    {
        "陷阱",
        "骗局",
        "幻觉",
        "荒谬",
        "可悲",
        "可耻",
        "该死",
        "失败",
        "危险",
        "错",
        "错位",
        "泡沫",
        "裸泳",
        "假象",
        "真相",
    }
)
_HOT_WORDS = frozenset(
    {"AI", "算法", "数据", "智能", "技术", "LLM", "GPT", "深度学习", "机器学习", "模型"}
)
_CHALLENGE_WORDS = frozenset(
    {"为什么", "凭什么", "凭什么", "怎么", "难道", "怎么可能", "真的", "为何"}
)


def _score_title(title: str) -> float:
    """启发式锐度评分（无 LLM 调用）"""
    score = 0.0
    if re.search(r"\d", title):
        score += 2.0
    if any(w in title for w in _CHALLENGE_WORDS) or title.endswith(("？", "?", "！", "!")):
        score += 1.5
    if any(w in title for w in _SHARP_WORDS):
        score += 1.0
    if any(w in title for w in _HOT_WORDS):
        score += 0.5
    n = len(title)
    if 8 <= n <= 20:
        score += 0.5
    return score


def pick_best_title(candidates: list[str]) -> str:
    """从多个候选中选锐度最高的"""
    if not candidates:
        return ""
    return max(candidates, key=_score_title)


def parse_titles_response(raw: str, expected_n: int = 3) -> list[str]:
    """解析 LLM 返回的标题 JSON

    容错：处理 markdown 代码块、缺字段、标题少于 expected。
    """
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        cleaned = [text[:30]] if text else []
        while len(cleaned) < expected_n and cleaned:
            cleaned.append(cleaned[0])
        return cleaned[:expected_n]

    if isinstance(data, dict):
        titles = data.get("titles") or data.get("candidates") or []
    elif isinstance(data, list):
        titles = data
    else:
        return []

    cleaned = [str(t).strip() for t in titles if t]
    while len(cleaned) < expected_n and len(cleaned) > 0:
        cleaned.append(cleaned[0])
    return cleaned[:expected_n]


def generate_social_titles(
    proposition: str,
    llm_call: Callable[[str], str],
    n: int = 3,
) -> list[str]:
    """social 模式：生成 N 个标题候选

    调用方传入 llm_call，picker 负责 prompt 构建 + 解析 + 返回。
    """
    from lu.social.platforms import PlatformConfig, PLATFORM_WEIBO
    from lu.social.prompts import build_title_prompt

    platform: PlatformConfig = PLATFORM_WEIBO  # default，social 模式标题用默认平台规则
    prompt = build_title_prompt(proposition=proposition, platform=platform, n=n)
    raw = llm_call(prompt)
    return parse_titles_response(raw, expected_n=n)


__all__ = [
    "generate_social_titles",
    "parse_titles_response",
    "pick_best_title",
]

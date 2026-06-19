"""recreate 改写指令解析

支持：
- 自由文本指令（如 "改写得更犀利"）
- 预设方向：preserve_stance / switch_view / rewrite_struct / rewrite_free

解析后输出 RewriteDirective dataclass。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class RewriteDirection(str, Enum):
    PRESERVE_STANCE = "preserve_stance"  # 保留原立场，只调语言
    SWITCH_VIEW = "switch_view"  # 换视角（反方/中立/其他）
    REWRITE_STRUCT = "rewrite_struct"  # 重写结构（5 段顺序/角色调整）
    REWRITE_FREE = "rewrite_free"  # 完全重写，仅借鉴部分素材


_PRESET_KEYWORDS: dict[RewriteDirection, tuple[str, ...]] = {
    RewriteDirection.PRESERVE_STANCE: ("保留", "立场", "精修", "润色", "微调", "preserve", "polish"),
    RewriteDirection.SWITCH_VIEW: ("换视角", "反方", "对立", "switch", "opposite"),
    RewriteDirection.REWRITE_STRUCT: ("重写结构", "调整结构", "换结构", "restructure"),
    RewriteDirection.REWRITE_FREE: ("完全重写", "自由重写", "重写", "free", "rewrite"),
}


@dataclass(frozen=True)
class RewriteDirective:
    """改写指令"""

    raw: str  # 原始指令
    direction: RewriteDirection  # 推断的方向
    extra: str = ""  # 指令中的额外要求（如字数、风格）


def detect_direction(text: str) -> RewriteDirection:
    """根据关键词推断改写方向"""
    text_lower = text.lower()
    matches: list[tuple[RewriteDirection, int]] = []
    for direction, keywords in _PRESET_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            matches.append((direction, score))
    if not matches:
        return RewriteDirection.PRESERVE_STANCE  # 默认保留立场
    matches.sort(key=lambda x: x[1], reverse=True)
    return matches[0][0]


def parse_directive(raw: str) -> RewriteDirective:
    """解析改写指令"""
    if not raw or not raw.strip():
        raise ValueError("recreate 指令不能为空")
    direction = detect_direction(raw)
    return RewriteDirective(raw=raw.strip(), direction=direction)


__all__ = ["RewriteDirective", "RewriteDirection", "detect_direction", "parse_directive"]

"""title 模块：Prism 标题生成"""
from __future__ import annotations

from lu.title.prism import (
    DIMENSIONS,
    PrismResult,
    TitleCandidate,
    build_prompt,
    generate_prism_titles,
    parse_prism_response,
)

__all__ = [
    "DIMENSIONS",
    "PrismResult",
    "TitleCandidate",
    "build_prompt",
    "generate_prism_titles",
    "parse_prism_response",
]

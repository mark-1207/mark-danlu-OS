"""gap 模块：素材缺口分析"""
from __future__ import annotations

from lu.gap.analyzer import (
    Gap,
    analyze_gaps,
    build_gap_prompt,
    parse_gap_response,
)

__all__ = ["Gap", "analyze_gaps", "build_gap_prompt", "parse_gap_response"]

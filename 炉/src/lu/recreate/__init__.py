"""recreate 模块：二创改写（链接/文档 + 改写指令）

触发场景：v3 P0 决定 — 用户输入链接或文档 + 改写指令（两者必须同时）
"""
from __future__ import annotations

from lu.recreate.directive import (
    RewriteDirection,
    RewriteDirective,
    detect_direction,
    parse_directive,
)
from lu.recreate.loader import (
    SourceText,
    load_from_file,
    load_from_run_id,
    load_from_url,
    load_source,
)
from lu.recreate.rewriter import generate_recreate_draft

__all__ = [
    "RewriteDirection",
    "RewriteDirective",
    "SourceText",
    "detect_direction",
    "generate_recreate_draft",
    "load_from_file",
    "load_from_run_id",
    "load_from_url",
    "load_source",
    "parse_directive",
]

"""TUI 段位选择器：交互式让用户选可选段

直接构造 blueprint 而不依赖 SectionSelector.select，避免与 cli.interactive
monkey-patch 时递归。
"""
from __future__ import annotations

from rich.prompt import Confirm

from lu.blueprint.models import Blueprint
from lu.blueprint.sections import SectionSelector


def select_sections_interactive(blueprint: Blueprint, content_type: str) -> Blueprint:
    """交互式让用户选可选段，返回新 blueprint

    流程：
    1. 拿核心 5 段（SectionSelector.core_sections）
    2. 拿 content_type 推荐可选段（SectionSelector.recommend）
    3. 询问用户是否要加可选段
    4. 逐个询问每个推荐段
    5. 选中的段位叠加在核心 5 段后
    """
    core = SectionSelector.core_sections()
    recs = SectionSelector.recommend(content_type)

    if not recs:
        # 无推荐时只返回核心 5 段
        return blueprint.model_copy(update={"sections": core})

    if not Confirm.ask("是否添加可选段？", default=False):
        return blueprint.model_copy(update={"sections": core})

    final = list(core)
    for rec in recs:
        if Confirm.ask(f"  是否加 [{rec.role.value}] {rec.style_hint[:30]}？", default=False):
            final.append(rec.model_copy(deep=True))

    return blueprint.model_copy(update={"sections": final})


__all__ = ["select_sections_interactive"]

"""Pipeline Context：7 步流程上下文聚合

参考 docs/04-DATA-MODEL.md 2.2 Context
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from lu.blueprint.models import Blueprint, Section
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.polish.models import QualityReport
from lu.sediment.models import Harvested
from lu.socratic.engine import SocraticResult
from lu.socratic.output import RefinedProposition
from lu.state.machine import RunState


class Context(BaseModel):
    """7 步流程上下文：每步产出挂载到对应字段"""

    proposition_cleaned: str = ""

    socratic_session: SocraticResult | None = None
    refined_proposition: RefinedProposition | None = None

    blueprint: Blueprint | None = None
    selected_sections: list[Section] = Field(default_factory=list)

    draft: Draft | None = None

    quality_report: QualityReport | None = None

    harvested: Harvested | None = None
    style_profile_snapshot: StyleProfile | None = None

    state: RunState = RunState.CREATED

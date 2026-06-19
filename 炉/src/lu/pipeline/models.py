"""Pipeline Context：7 步流程上下文聚合

参考 docs/04-DATA-MODEL.md 2.2 Context
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from lu.blueprint.models import Blueprint, Section
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.embedding.hook import SimilarProposition
from lu.embedding.recall import RecallHit
from lu.polish.models import QualityReport
from lu.sediment.models import Harvested
from lu.socratic.engine import SocraticResult
from lu.socratic.output import RefinedProposition
from lu.state.machine import RunState


class Context(BaseModel):
    """流程上下文：每步产出挂载到对应字段

    mode 决定 8 步流程如何执行（social / create / recreate）。
    旧 run 数据无 mode 字段，加载时自动补为 "create"（向后兼容）。
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    run_id: str | None = None
    proposition_cleaned: str = ""

    # v3 P0 多模式
    mode: Literal["social", "create", "recreate"] = "create"
    source_run_id: str | None = None  # recreate 模式：指向原 run

    socratic_session: SocraticResult | None = None
    refined_proposition: RefinedProposition | None = None

    # v2 P0 embedding 注入
    similar_propositions: list[SimilarProposition] = Field(default_factory=list)
    recalled_materials: list[RecallHit] = Field(default_factory=list)

    # v3 P0 新增字段
    candidate_titles: list[str] = Field(default_factory=list)
    blueprint_title: str = ""
    gaps: list[str] = Field(default_factory=list)
    gaps_resolved: bool = False
    recreate_source_text: str = ""
    recreate_instruction: str = ""
    recreate_direction: str = "preserve_stance"
    recreate_source_kind: str = ""
    recreate_source_id: str = ""
    recreate_struct: object | None = None  # ArticleStructure from viral.structure
    social_platform: str = "weibo"
    social_length: int = 300

    blueprint: Blueprint | None = None
    selected_sections: list[Section] = Field(default_factory=list)

    draft: Draft | None = None

    quality_report: QualityReport | None = None

    harvested: Harvested | None = None
    style_profile_snapshot: StyleProfile | None = None

    state: RunState = RunState.CREATED

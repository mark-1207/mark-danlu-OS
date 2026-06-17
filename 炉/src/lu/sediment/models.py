"""沉淀数据模型

参考 docs/04-DATA-MODEL.md 5.5 Harvested
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from lu.blueprint.models import Case, Quote
from lu.socratic.output import ContrarianPoint


class Insight(BaseModel):
    text: str
    source: str = "草稿"
    tags: list[str] = Field(default_factory=list)


class DiffResult(BaseModel):
    """草稿 vs mark 标注的 diff"""

    removed: list[str] = Field(default_factory=list)
    modified: list[tuple[str, str]] = Field(default_factory=list)
    forbidden_candidates: list[str] = Field(default_factory=list)


class Harvested(BaseModel):
    """沉淀产物"""

    cases: list[Case] = Field(default_factory=list)
    quotes: list[Quote] = Field(default_factory=list)
    insights: list[Insight] = Field(default_factory=list)
    contrarian_points: list[ContrarianPoint] = Field(default_factory=list)
    forbidden_candidates: list[str] = Field(default_factory=list)
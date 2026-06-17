"""蓝图数据模型

参考：
- docs/02-ARCHITECTURE.md 2.4 Blueprint
- docs/04-DATA-MODEL.md 2.4 / 2.5
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class SectionRole(str, Enum):
    """段位角色

    核心 5：HOOK / ANTI_CONSENSUS / CASE / THINKING / CLOSING
    可选 8：ACTION / REBUTTAL / CONTRAST / DATA / SELF_DEPRECATION / QUOTE / TWIST / PAUSE
    """

    HOOK = "hook"
    ANTI_CONSENSUS = "anti_consensus"
    CASE = "case"
    THINKING = "thinking"
    CLOSING = "closing"

    ACTION = "action"
    REBUTTAL = "rebuttal"
    CONTRAST = "contrast"
    DATA = "data"
    SELF_DEPRECATION = "self_deprecation"
    QUOTE = "quote"
    TWIST = "twist"
    PAUSE = "pause"


class Case(BaseModel):
    title: str
    summary: str
    source: str | None = None


class DataPoint(BaseModel):
    statement: str
    source: str | None = None


class Quote(BaseModel):
    text: str
    author: str | None = None


class AntiAIAnchors(BaseModel):
    """Anti-AI 锚点池

    为段位生成提供素材来源；草稿阶段按段位 must_have 注入。
    """

    case_anchors: list[Case] = Field(default_factory=list)
    contrarian_anchors: list[str] = Field(default_factory=list)
    data_anchors: list[DataPoint] = Field(default_factory=list)
    insight_anchors: list[str] = Field(default_factory=list)
    quote_anchors: list[Quote] = Field(default_factory=list)
    forbidden_list: list[str] = Field(default_factory=list)


class Section(BaseModel):
    """段位：草稿生成时填充 content / self_confidence"""

    role: SectionRole
    must_have: list[str] = Field(default_factory=list)
    word_limit: int = Field(gt=0)
    style_hint: str
    thinking_model_hint: str | None = None

    content: str | None = None
    self_confidence: float | None = None


class Blueprint(BaseModel):
    """蓝图：CCOS 14 项 + 段位 + Anti-AI 锚点"""

    proposition: str
    stance: str
    framework: str
    framework_output: dict

    audience: str
    core_anti_consensus: str
    cases: list[Case] = Field(default_factory=list)
    data: list[DataPoint] = Field(default_factory=list)
    quotes: list[Quote] = Field(default_factory=list)
    forbidden: list[str] = Field(default_factory=list)

    sections: list[Section] = Field(default_factory=list)

    anti_ai_anchors: AntiAIAnchors = Field(default_factory=AntiAIAnchors)
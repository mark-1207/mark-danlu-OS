"""草稿数据模型

参考 docs/04-DATA-MODEL.md 2.6 Draft
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from lu.blueprint.models import Section, SectionRole


class Draft(BaseModel):
    """草稿：段位已填充 content + self_confidence"""

    title: str
    sections: list[Section] = Field(default_factory=list)
    total_word_count: int = Field(ge=0)

    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generation_duration_sec: float = 0.0
    failed_sections: list[SectionRole] = Field(default_factory=list)
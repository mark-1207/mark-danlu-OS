"""Feedback 数据模型

参考 docs/02-ARCHITECTURE.md §2.7 沉淀回写 / 反馈数据
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class Feedback(BaseModel):
    """单次 run 的反馈记录"""

    run_id: str | None = None
    proposition: str
    quality_overall_passed: bool
    weakest_dimension: str
    accepted: bool = True
    note: str = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

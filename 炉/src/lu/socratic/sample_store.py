"""Socratic 样本存储：追加写 config/socratic_samples.jsonl

记录每次追问的结果：
- proposition
- rounds（完成轮数）
- user_says_stop（用户主动停 vs 系统判定停）
- final_signals（最后回答的关键词）
- timestamp

为阶段 2-3 学习提供数据。
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field


class SocraticSample(BaseModel):
    """单次苏格拉底追问的结果样本"""

    proposition: str
    rounds: int = 0
    user_says_stop: bool = False
    final_signals: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SampleStore:
    """Socratic 样本追加写 + 读多行"""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def write(self, sample: SocraticSample) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        line = sample.model_dump_json()
        with self.path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    def read_all(self) -> list[SocraticSample]:
        if not self.path.is_file():
            return []
        records: list[SocraticSample] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                records.append(SocraticSample.model_validate_json(line))
        return records

    def count(self) -> int:
        if not self.path.is_file():
            return 0
        return sum(1 for _ in self.path.open("r", encoding="utf-8") if _.strip())


__all__ = ["SocraticSample", "SampleStore"]

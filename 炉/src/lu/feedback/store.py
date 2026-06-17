"""FeedbackStore：追加写 feedback.jsonl

v1.x 仅本地持久化；v2.x 接入飞书时实现 FeedbackSink
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from lu.feedback.models import Feedback

if TYPE_CHECKING:
    from lu.feishu import FeedbackSink


class FeedbackStore:
    """Feedback 持久化器（追加写 + 读多行）"""

    def __init__(
        self,
        path: Path | str,
        sinks: "list[FeedbackSink] | None" = None,
    ) -> None:
        self.path = Path(path)
        self.sinks: list[FeedbackSink] = list(sinks or [])

    def write(self, feedback: Feedback) -> None:
        """追加写一条 feedback + 推送到所有 sink"""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        line = feedback.model_dump_json()
        with self.path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

        for sink in self.sinks:
            try:
                sink.send(feedback)
            except Exception:
                # 单个 sink 失败不影响其他
                pass

    def read_all(self) -> list[Feedback]:
        if not self.path.is_file():
            return []
        records: list[Feedback] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                records.append(Feedback.model_validate_json(line))
        return records

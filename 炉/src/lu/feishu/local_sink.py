"""LocalJsonlSink：本地占位实现（写到独立 jsonl，便于后续切真飞书时对比）"""
from __future__ import annotations

import json
from pathlib import Path

from lu.feedback.models import Feedback


class LocalJsonlSink:
    """本地 jsonl 写入器（v1.x 占位）"""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def send(self, feedback: Feedback) -> bool:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            line = feedback.model_dump_json()
            with self.path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
            return True
        except Exception:
            return False


__all__ = ["LocalJsonlSink"]

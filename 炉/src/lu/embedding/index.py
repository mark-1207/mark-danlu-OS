"""EmbeddingIndex: JSONL 追加写 + cosine recall

每行一个 JSON 记录：
{
  "id": str,
  "kind": "case" | "quote" | "insight" | "proposition" | ...,
  "text": str,
  "embedding": list[float],
  "source": str,
  "tags": list[str],
  "timestamp": ISO-8601
}
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from lu.embedding.recall import RecallHit, cosine_similarity


@dataclass
class IndexedRecord:
    """索引中的一条记录"""

    id: str
    kind: str
    text: str
    embedding: list[float]
    source: str
    tags: list[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_json(self) -> str:
        return self.model_dump_json()

    def model_dump_json(self) -> str:
        """与 Pydantic 风格一致"""
        d = {
            "id": self.id,
            "kind": self.kind,
            "text": self.text,
            "embedding": self.embedding,
            "source": self.source,
            "tags": self.tags,
            "timestamp": self.timestamp.isoformat(),
        }
        return json.dumps(d, ensure_ascii=False)


class EmbeddingIndex:
    """JSONL 追加写 + 内存 recall"""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    def add(
        self,
        *,
        id: str,
        kind: str,
        text: str,
        embedding: list[float],
        source: str,
        tags: list[str] | None = None,
    ) -> None:
        """追加写一条记录"""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        record = IndexedRecord(
            id=id,
            kind=kind,
            text=text,
            embedding=embedding,
            source=source,
            tags=list(tags or []),
        )
        with self.path.open("a", encoding="utf-8") as f:
            f.write(record.to_json() + "\n")

    def read_all(self) -> list[IndexedRecord]:
        """读所有有效记录（跳过空行 / 损坏 JSON）"""
        if not self.path.is_file():
            return []
        records: list[IndexedRecord] = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                records.append(_record_from_dict(d))
        return records

    def count(self) -> int:
        """数有效记录数（跳过空行 + 损坏 JSON）"""
        return len(self.read_all())

    def recall(
        self,
        *,
        query: list[float],
        top_k: int = 3,
        threshold: float = 0.7,
        kind: str | None = None,
    ) -> list[RecallHit]:
        """在已有记录中按 cosine 相似度召回 top_k"""
        records = self.read_all()
        candidates: list[RecallHit] = []
        for r in records:
            if kind is not None and r.kind != kind:
                continue
            try:
                score = cosine_similarity(query, r.embedding)
            except ValueError:
                # 维度不匹配：跳过
                continue
            if score < threshold:
                continue
            candidates.append(
                RecallHit(
                    id=r.id,
                    kind=r.kind,
                    text=r.text,
                    source=r.source,
                    tags=list(r.tags),
                    score=score,
                )
            )
        candidates.sort(key=lambda h: h.score, reverse=True)
        return candidates[:top_k]


def _record_from_dict(d: dict) -> IndexedRecord:
    ts_raw = d.get("timestamp")
    if isinstance(ts_raw, str):
        try:
            ts = datetime.fromisoformat(ts_raw)
        except ValueError:
            ts = datetime.now(timezone.utc)
    elif isinstance(ts_raw, datetime):
        ts = ts_raw
    else:
        ts = datetime.now(timezone.utc)
    return IndexedRecord(
        id=str(d.get("id", "")),
        kind=str(d.get("kind", "")),
        text=str(d.get("text", "")),
        embedding=list(d.get("embedding", [])),
        source=str(d.get("source", "")),
        tags=list(d.get("tags", [])),
        timestamp=ts,
    )


__all__ = ["EmbeddingIndex", "IndexedRecord"]

"""EmbeddingIndex 测试"""
from __future__ import annotations

import math
from pathlib import Path

import pytest

from lu.embedding.index import EmbeddingIndex, IndexedRecord


class TestEmbeddingIndexAdd:
    def test_add_creates_file(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="hello", embedding=[0.1, 0.2], source="s1")
        assert (tmp_path / "m.jsonl").exists()

    def test_add_increments_count(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        assert idx.count() == 0
        idx.add(id="a", kind="case", text="x", embedding=[0.0], source="s")
        idx.add(id="b", kind="quote", text="y", embedding=[0.0], source="s")
        assert idx.count() == 2

    def test_add_creates_parent_dirs(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "nested" / "deep" / "m.jsonl")
        idx.add(id="a", kind="case", text="x", embedding=[0.0], source="s")
        assert (tmp_path / "nested" / "deep" / "m.jsonl").exists()

    def test_add_with_tags(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(
            id="a",
            kind="insight",
            text="x",
            embedding=[0.0],
            source="s",
            tags=["杠杆者", "AI"],
        )
        r = idx.read_all()[0]
        assert r.tags == ["杠杆者", "AI"]

    def test_add_appends_atomically(self, tmp_path: Path) -> None:
        """每次 add 写一行，line-count == add count"""
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        for i in range(10):
            idx.add(id=f"id-{i}", kind="case", text=f"t-{i}", embedding=[0.0], source="s")
        assert idx.count() == 10


class TestEmbeddingIndexPersist:
    def test_read_all_after_reload(self, tmp_path: Path) -> None:
        path = tmp_path / "m.jsonl"
        idx = EmbeddingIndex(path)
        idx.add(id="a", kind="case", text="hello", embedding=[0.1, 0.2], source="s1")
        idx.add(id="b", kind="quote", text="world", embedding=[0.3, 0.4], source="s2")
        # 重新构造 = 重新加载
        idx2 = EmbeddingIndex(path)
        records = idx2.read_all()
        assert len(records) == 2
        assert records[0].id == "a"
        assert records[1].id == "b"
        assert records[0].embedding == [0.1, 0.2]

    def test_empty_file_returns_empty_list(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        assert idx.read_all() == []
        assert idx.count() == 0

    def test_skip_blank_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "m.jsonl"
        idx = EmbeddingIndex(path)
        idx.add(id="a", kind="case", text="x", embedding=[0.0], source="s")
        # 手动写空行模拟异常
        with path.open("a", encoding="utf-8") as f:
            f.write("\n")
            f.write("   \n")
        assert idx.count() == 1

    def test_skip_corrupt_json(self, tmp_path: Path) -> None:
        path = tmp_path / "m.jsonl"
        idx = EmbeddingIndex(path)
        idx.add(id="a", kind="case", text="x", embedding=[0.0], source="s")
        with path.open("a", encoding="utf-8") as f:
            f.write("not valid json\n")
        assert idx.count() == 1  # 只数有效行
        records = idx.read_all()
        # corrupt 行不返回
        assert len(records) == 1


class TestEmbeddingIndexRecall:
    def test_recall_top_k(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="case", text="B", embedding=[0.5, 0.5], source="s")
        idx.add(id="c", kind="case", text="C", embedding=[-1.0, 0.0], source="s")
        hits = idx.recall(query=[1.0, 0.0], top_k=2, threshold=-1.0)
        assert len(hits) == 2
        assert hits[0].id == "a"
        assert hits[1].id == "b"

    def test_recall_threshold(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="case", text="B", embedding=[0.0, 1.0], source="s")
        hits = idx.recall(query=[1.0, 0.0], top_k=5, threshold=0.5)
        assert len(hits) == 1
        assert hits[0].id == "a"

    def test_recall_kind_filter(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0], source="s")
        idx.add(id="b", kind="quote", text="B", embedding=[1.0, 0.0], source="s")
        hits = idx.recall(query=[1.0, 0.0], top_k=5, threshold=0.5, kind="quote")
        assert len(hits) == 1
        assert hits[0].id == "b"

    def test_recall_empty_index(self, tmp_path: Path) -> None:
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        hits = idx.recall(query=[1.0, 0.0], top_k=3, threshold=0.0)
        assert hits == []

    def test_recall_ignores_dim_mismatch(self, tmp_path: Path) -> None:
        """维度不匹配的记录应被跳过（不抛错）"""
        idx = EmbeddingIndex(tmp_path / "m.jsonl")
        idx.add(id="a", kind="case", text="A", embedding=[1.0, 0.0, 0.0], source="s")
        idx.add(id="b", kind="case", text="B", embedding=[1.0, 0.0], source="s")
        hits = idx.recall(query=[1.0, 0.0], top_k=5, threshold=0.0)
        assert len(hits) == 1
        assert hits[0].id == "b"


class TestIndexedRecord:
    def test_fields(self) -> None:
        from datetime import datetime, timezone

        ts = datetime(2026, 1, 1, tzinfo=timezone.utc)
        r = IndexedRecord(
            id="a",
            kind="case",
            text="x",
            embedding=[0.1, 0.2],
            source="s",
            tags=["t"],
            timestamp=ts,
        )
        assert r.id == "a"
        assert r.kind == "case"
        assert r.text == "x"
        assert r.embedding == [0.1, 0.2]
        assert r.source == "s"
        assert r.tags == ["t"]
        assert r.timestamp == ts

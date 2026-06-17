"""Socratic 样本存储测试

- 追加写 / 读多行
- 缺失文件返回空列表
- 自动创建父目录
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from lu.socratic.sample_store import SocraticSample, SampleStore


def _make_sample(rounds: int = 3, user_stop: bool = True) -> SocraticSample:
    return SocraticSample(
        proposition="测试命题",
        rounds=rounds,
        user_says_stop=user_stop,
        final_signals=["够了"],
    )


class TestSampleStore:
    def test_write_creates_file(self, tmp_path: Path) -> None:
        store = SampleStore(tmp_path / "samples.jsonl")
        store.write(_make_sample())
        assert (tmp_path / "samples.jsonl").is_file()

    def test_read_all(self, tmp_path: Path) -> None:
        path = tmp_path / "samples.jsonl"
        store = SampleStore(path)
        store.write(_make_sample(rounds=2))
        store.write(_make_sample(rounds=3))
        store.write(_make_sample(rounds=4))
        records = store.read_all()
        assert len(records) == 3
        assert [r.rounds for r in records] == [2, 3, 4]

    def test_empty_file_returns_empty(self, tmp_path: Path) -> None:
        store = SampleStore(tmp_path / "missing.jsonl")
        assert store.read_all() == []

    def test_creates_parent_dirs(self, tmp_path: Path) -> None:
        path = tmp_path / "sub" / "samples.jsonl"
        store = SampleStore(path)
        store.write(_make_sample())
        assert path.is_file()

    def test_count(self, tmp_path: Path) -> None:
        path = tmp_path / "samples.jsonl"
        store = SampleStore(path)
        for _ in range(5):
            store.write(_make_sample())
        assert store.count() == 5

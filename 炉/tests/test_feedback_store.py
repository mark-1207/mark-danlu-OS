"""Feedback 模型 + 持久化测试

- Feedback 字段必填 + 默认值
- FeedbackStore 追加写 + 读多行
- 写不存在的父目录时自动创建
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from lu.feedback.models import Feedback
from lu.feedback.store import FeedbackStore


def _make_feedback(note: str = "ok", accepted: bool = True) -> Feedback:
    return Feedback(
        run_id="2026-06-17_test",
        proposition="AI 牛马陷阱",
        quality_overall_passed=True,
        weakest_dimension="温度",
        accepted=accepted,
        note=note,
    )


class TestFeedbackModel:
    def test_required_fields(self) -> None:
        f = Feedback(
            run_id="r1",
            proposition="p",
            quality_overall_passed=False,
            weakest_dimension="深度",
        )
        assert f.accepted is True  # default
        assert f.note == ""
        assert f.created_at is not None

    def test_explicit_accepted_false(self) -> None:
        f = Feedback(
            run_id="r1",
            proposition="p",
            quality_overall_passed=False,
            weakest_dimension="深度",
            accepted=False,
        )
        assert f.accepted is False


class TestFeedbackStore:
    def test_write_creates_file(self, tmp_path: Path) -> None:
        store = FeedbackStore(tmp_path / "feedback.jsonl")
        store.write(_make_feedback())
        assert (tmp_path / "feedback.jsonl").is_file()

    def test_append_multiple_lines(self, tmp_path: Path) -> None:
        path = tmp_path / "feedback.jsonl"
        store = FeedbackStore(path)
        store.write(_make_feedback(note="first"))
        store.write(_make_feedback(note="second"))
        store.write(_make_feedback(note="third"))

        content = path.read_text(encoding="utf-8")
        assert content.count("\n") == 3
        assert "first" in content
        assert "third" in content

    def test_read_all(self, tmp_path: Path) -> None:
        path = tmp_path / "feedback.jsonl"
        store = FeedbackStore(path)
        store.write(_make_feedback(note="a"))
        store.write(_make_feedback(note="b"))

        records = store.read_all()
        assert len(records) == 2
        assert records[0].note == "a"
        assert records[1].note == "b"

    def test_read_all_empty_when_no_file(self, tmp_path: Path) -> None:
        store = FeedbackStore(tmp_path / "missing.jsonl")
        assert store.read_all() == []

    def test_creates_parent_dirs(self, tmp_path: Path) -> None:
        path = tmp_path / "subdir" / "feedback.jsonl"
        store = FeedbackStore(path)
        store.write(_make_feedback())
        assert path.is_file()

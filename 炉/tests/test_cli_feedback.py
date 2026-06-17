"""CLI --feedback-note 测试"""
from __future__ import annotations

from pathlib import Path

from lu.feedback.models import Feedback
from lu.feedback.store import FeedbackStore


class TestCLIFeedback:
    def test_feedback_note_writes_to_file(self, tmp_path: Path, monkeypatch) -> None:
        # monkeypatch feedback path 到 tmp
        from lu.cli import run as cli_run

        feedback_path = tmp_path / "feedback.jsonl"
        monkeypatch.setattr(cli_run, "DEFAULT_FEEDBACK_PATH", str(feedback_path))

        from lu.cli.run import main
        ret = main(["测试命题", "--dry-run", "--feedback-note", "观点锋利"])
        assert ret == 0

        store = FeedbackStore(feedback_path)
        records = store.read_all()
        assert len(records) == 1
        assert records[0].note == "观点锋利"
        assert records[0].proposition == "测试命题"

    def test_no_feedback_note_does_not_write(self, tmp_path: Path, monkeypatch) -> None:
        from lu.cli import run as cli_run

        feedback_path = tmp_path / "feedback.jsonl"
        monkeypatch.setattr(cli_run, "DEFAULT_FEEDBACK_PATH", str(feedback_path))

        from lu.cli.run import main
        ret = main(["测试命题", "--dry-run"])
        assert ret == 0
        assert not feedback_path.exists()

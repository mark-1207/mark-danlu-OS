"""Feishu hook 测试

- LocalJsonlSink 写入 + 返回值
- FeedbackSink 协议 runtime_checkable
- FeedbackStore 集成多 sink
"""
from __future__ import annotations

from pathlib import Path

from lu.feedback.models import Feedback
from lu.feedback.store import FeedbackStore
from lu.feishu import FeedbackSink, LocalJsonlSink


def _fb() -> Feedback:
    return Feedback(
        run_id="r1",
        proposition="p",
        quality_overall_passed=True,
        weakest_dimension="温度",
        note="ok",
    )


class TestLocalJsonlSink:
    def test_satisfies_protocol(self) -> None:
        sink = LocalJsonlSink("/tmp/feishu_log.jsonl")
        assert isinstance(sink, FeedbackSink)

    def test_send_returns_true_on_success(self, tmp_path: Path) -> None:
        sink = LocalJsonlSink(tmp_path / "feishu.jsonl")
        assert sink.send(_fb()) is True
        assert (tmp_path / "feishu.jsonl").is_file()

    def test_send_appends_multiple(self, tmp_path: Path) -> None:
        path = tmp_path / "feishu.jsonl"
        sink = LocalJsonlSink(path)
        sink.send(_fb())
        sink.send(_fb())
        content = path.read_text(encoding="utf-8")
        assert content.count("\n") == 2


class TestFeedbackStoreWithSinks:
    def test_sink_failure_does_not_break_write(
        self, tmp_path: Path, capsys
    ) -> None:
        # 构造一个会失败的 sink
        class _FailingSink:
            def send(self, feedback: Feedback) -> bool:
                raise RuntimeError("boom")

        path = tmp_path / "feedback.jsonl"
        store = FeedbackStore(path, sinks=[_FailingSink()])
        # 不应抛异常
        store.write(_fb())
        # 本地文件仍写入
        assert path.is_file()
        records = store.read_all()
        assert len(records) == 1

    def test_multiple_sinks_all_called(self, tmp_path: Path) -> None:
        local_sink_path = tmp_path / "feishu.jsonl"
        local_sink = LocalJsonlSink(local_sink_path)
        path = tmp_path / "feedback.jsonl"
        store = FeedbackStore(path, sinks=[local_sink])

        store.write(_fb())
        assert path.is_file()
        assert local_sink_path.is_file()

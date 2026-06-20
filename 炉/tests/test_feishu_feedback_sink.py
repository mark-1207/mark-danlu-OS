"""FeishuFeedbackSink 测试：把 Feedback 写到飞书 Bitable

- 实现 FeedbackSink 协议
- 用 FeishuBitableClient.create_record
- fields 映射：本地 Feedback 字段 → 飞书 Bitable field_id
- 容错：lark-cli 失败返回 False（不抛）
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from lu.feedback.models import Feedback
from lu.feishu.client import FeishuBitableClient
from lu.feishu.feedback_sink import FeishuFeedbackSink
from lu.feishu import FeedbackSink


class TestFeishuFeedbackSink:
    def _config(self, tmp_path: Path) -> Path:
        p = tmp_path / "feishu.yaml"
        p.write_text(
            "app_token: app_xxx\n"
            "table_id: tbl_xxx\n"
            "fields:\n"
            "  run_id: fld_run_id\n"
            "  proposition: fld_prop\n"
            "  overall_passed: fld_pass\n"
            "  weakest_dimension: fld_weakest\n"
            "  accepted: fld_accepted\n"
            "  note: fld_note\n"
            "  created_at: fld_created\n",
            encoding="utf-8",
        )
        return p

    def test_is_feedback_sink(self, tmp_path: Path) -> None:
        sink = FeishuFeedbackSink(self._config(tmp_path))
        assert isinstance(sink, FeedbackSink)

    def test_send_calls_create_record(self, tmp_path: Path) -> None:
        sink = FeishuFeedbackSink(self._config(tmp_path))
        fb = Feedback(
            run_id="r1",
            proposition="test prop",
            quality_overall_passed=True,
            weakest_dimension="温度",
            accepted=True,
            note="ok",
        )

        with patch.object(FeishuBitableClient, "create_record", return_value={"record_id": "rec_1"}) as mock_create:
            result = sink.send(fb)

        assert result is True
        mock_create.assert_called_once()
        # mock 的 method 不带 self，所以 args[0] 就是 fields
        call_fields = mock_create.call_args.args[0]
        assert call_fields["fld_run_id"] == "r1"
        assert call_fields["fld_prop"] == "test prop"
        assert call_fields["fld_pass"] is True
        assert call_fields["fld_weakest"] == "温度"
        assert call_fields["fld_accepted"] is True
        assert call_fields["fld_note"] == "ok"
        assert "fld_created" in call_fields

    def test_send_returns_false_on_error(self, tmp_path: Path) -> None:
        sink = FeishuFeedbackSink(self._config(tmp_path))
        fb = Feedback(
            run_id="r1", proposition="p", quality_overall_passed=True, weakest_dimension="x"
        )

        with patch.object(
            FeishuBitableClient, "create_record", side_effect=Exception("lark-cli 失败")
        ):
            result = sink.send(fb)

        assert result is False  # 容错，不抛

    def test_minimal_feedback(self, tmp_path: Path) -> None:
        """只填必填字段也能 send"""
        sink = FeishuFeedbackSink(self._config(tmp_path))
        fb = Feedback(
            proposition="minimal", quality_overall_passed=False, weakest_dimension="y"
        )
        with patch.object(FeishuBitableClient, "create_record", return_value={}) as mock_create:
            result = sink.send(fb)
        assert result is True
        # run_id 是 None，不应调用
        call_fields = mock_create.call_args.args[0]
        assert call_fields["fld_prop"] == "minimal"
        # run_id 字段不应被发送（None 被跳过）
        assert "fld_run_id" not in call_fields

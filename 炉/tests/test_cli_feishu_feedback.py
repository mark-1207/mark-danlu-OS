"""CLI --feishu-feedback 集成测试

- --feishu-feedback 触发 FeishuFeedbackSink.send
- 本地 FeedbackStore 总写
- 飞书失败时本地保留（warn-and-skip）
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from lu.cli.run import main
from lu.feedback.models import Feedback


class TestCLIFeishuFeedback:
    def _feishu_config(self, tmp_path: Path) -> Path:
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
            "  note: fld_note\n",
            encoding="utf-8",
        )
        return p

    def test_feishu_feedback_called(self, tmp_path: Path) -> None:
        cfg = self._feishu_config(tmp_path)
        feedback_path = tmp_path / "fb.jsonl"

        with patch("lu.feishu.FeishuFeedbackSink.send", return_value=True) as mock_send:
            ret = main([
                "create",
                "AI 杠杆者反思",
                "--dry-run",
                "--quiet",
                "--feedback-note", "测试同步飞书",
                "--feedback-path", str(feedback_path),
                "--feishu-feedback", str(cfg),
            ])

        assert ret == 0
        mock_send.assert_called_once()
        # 传入的 feedback 字段正确
        fb = mock_send.call_args.args[0]
        assert isinstance(fb, Feedback)
        assert fb.proposition == "AI 杠杆者反思"
        assert fb.note == "测试同步飞书"

    def test_feishu_failure_does_not_block(self, tmp_path: Path) -> None:
        """飞书失败时本地反馈仍保留，不抛错"""
        cfg = self._feishu_config(tmp_path)
        feedback_path = tmp_path / "fb.jsonl"

        with patch("lu.feishu.FeishuFeedbackSink.send", return_value=False):
            ret = main([
                "create",
                "AI",
                "--dry-run",
                "--quiet",
                "--feedback-note", "x",
                "--feedback-path", str(feedback_path),
                "--feishu-feedback", str(cfg),
            ])

        # 本地反馈文件应该存在
        assert feedback_path.exists()
        content = feedback_path.read_text(encoding="utf-8")
        assert "AI" in content

    def test_no_feishu_flag_no_sink_call(self, tmp_path: Path) -> None:
        """不指定 --feishu-feedback：不调 FeishuFeedbackSink"""
        feedback_path = tmp_path / "fb.jsonl"

        with patch("lu.feishu.FeishuFeedbackSink.send", return_value=True) as mock_send:
            ret = main([
                "create",
                "AI",
                "--dry-run",
                "--quiet",
                "--feedback-note", "x",
                "--feedback-path", str(feedback_path),
            ])

        assert ret == 0
        mock_send.assert_not_called()

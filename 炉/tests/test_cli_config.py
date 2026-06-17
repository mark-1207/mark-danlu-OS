"""CLI config sync 子命令测试"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from lu.cli.config import cmd_config, should_push
from lu.config.loader import StyleProfile


def _run_argv(action: str, *extra: str) -> int:
    """辅助：构造 args"""
    import argparse
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser(action)
    p.add_argument("--config", default="config/feishu.yaml")
    p.add_argument("--style", default="config/style_profile.yaml")
    args = parser.parse_args([action, *extra])
    return cmd_config(args)


class TestShouldPush:
    def test_local_newer_pushes(self) -> None:
        assert should_push(local_version=3, remote_version=2) is True

    def test_local_older_skips(self) -> None:
        assert should_push(local_version=1, remote_version=2) is False

    def test_equal_versions_skips(self) -> None:
        assert should_push(local_version=2, remote_version=2) is False

    def test_no_remote_pushes(self) -> None:
        assert should_push(local_version=1, remote_version=None) is True


class TestConfigPull:
    def test_pull_writes_local_yaml(self, tmp_path: Path) -> None:
        cfg = tmp_path / "feishu.yaml"
        cfg.write_text('app_token: x\ntable_id: y\nfields: {}', encoding="utf-8")
        style_path = tmp_path / "style_profile.yaml"

        with patch("lu.cli.config.FeishuBitableClient") as mc, \
             patch("lu.cli.config.from_bitable", return_value=StyleProfile(version=1, voice="v")):
            mc.return_value.list_records.return_value = [
                {"fields": {
                    "version": 1, "voice": "v",
                    "forbidden_terms": [], "forbidden_severity": [],
                    "stop_typical_rounds": 3.0,
                    "stop_saturation_keywords": [],
                    "stop_auto_enabled": False,
                    "stop_sample_count": 0,
                }}
            ]
            import argparse
            args = argparse.Namespace(
                action="pull", config=str(cfg), style=str(style_path),
            )
            ret = cmd_config(args)
        assert ret == 0
        assert style_path.is_file()


class TestConfigPush:
    def test_push_creates_record(self, tmp_path: Path) -> None:
        cfg = tmp_path / "feishu.yaml"
        cfg.write_text('app_token: x\ntable_id: y\nfields: {}', encoding="utf-8")
        style_path = tmp_path / "style_profile.yaml"
        style_path.write_text("version: 1\nvoice: 犀利", encoding="utf-8")

        with patch("lu.cli.config.FeishuBitableClient") as mc:
            mc.return_value.list_records.return_value = []
            mc.return_value.create_record.return_value = {"id": "rec_1"}
            import argparse
            args = argparse.Namespace(
                action="push", config=str(cfg), style=str(style_path),
            )
            ret = cmd_config(args)
        assert ret == 0
        mc.return_value.create_record.assert_called_once()


class TestConfigSync:
    def test_sync_pushes_when_local_newer(self, tmp_path: Path) -> None:
        cfg = tmp_path / "feishu.yaml"
        cfg.write_text('app_token: x\ntable_id: y\nfields: {}', encoding="utf-8")
        style_path = tmp_path / "style_profile.yaml"
        style_path.write_text("version: 5\nvoice: 犀利", encoding="utf-8")

        with patch("lu.cli.config.FeishuBitableClient") as mc:
            mc.return_value.list_records.return_value = [
                {"fields": {"version": 3}}
            ]
            mc.return_value.create_record.return_value = {"id": "rec_1"}
            import argparse
            args = argparse.Namespace(
                action="sync", config=str(cfg), style=str(style_path),
            )
            ret = cmd_config(args)
        assert ret == 0
        mc.return_value.create_record.assert_called_once()

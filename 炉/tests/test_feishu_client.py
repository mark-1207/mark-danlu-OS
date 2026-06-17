"""Feishu client 测试

- mock subprocess.run，验证 lark-cli 命令拼装
- 成功/失败返回值
- 缺 lark-cli 时抛 FeishuError
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from lu.feishu.client import FeishuBitableClient, FeishuError


@pytest.fixture
def config_path(tmp_path: Path) -> Path:
    cfg = tmp_path / "feishu.yaml"
    cfg.write_text(
        json.dumps(
            {
                "app_token": "bascn_test_token",
                "table_id": "tbl_test_id",
                "fields": {
                    "voice": "fld_voice",
                    "version": "fld_version",
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return cfg


@pytest.fixture
def success_result() -> MagicMock:
    r = MagicMock()
    r.returncode = 0
    r.stdout = json.dumps({"code": 0, "msg": "ok", "data": {"items": []}})
    r.stderr = ""
    return r


class TestFeishuBitableClient:
    def test_init_loads_config(self, config_path: Path) -> None:
        client = FeishuBitableClient(config_path)
        assert client.app_token == "bascn_test_token"
        assert client.table_id == "tbl_test_id"
        assert client.fields["voice"] == "fld_voice"

    def test_list_records(self, config_path: Path, success_result: MagicMock) -> None:
        with patch("lu.feishu.client.subprocess.run", return_value=success_result) as p:
            client = FeishuBitableClient(config_path)
            records = client.list_records()
        assert records == []
        # 验证命令拼装
        cmd = p.call_args.args[0]
        assert "lark-cli" in cmd
        assert "bascn_test_token" in cmd
        assert "tbl_test_id" in cmd

    def test_create_record(self, config_path: Path, success_result: MagicMock) -> None:
        success_result.stdout = json.dumps({"code": 0, "data": {"record": {"id": "rec_1"}}})
        with patch("lu.feishu.client.subprocess.run", return_value=success_result) as p:
            client = FeishuBitableClient(config_path)
            record = client.create_record({"voice": "犀利"})
        assert record["id"] == "rec_1"

    def test_missing_lark_cli_raises(self, config_path: Path) -> None:
        with patch("lu.feishu.client.subprocess.run", side_effect=FileNotFoundError):
            client = FeishuBitableClient(config_path)
            with pytest.raises(FeishuError):
                client.list_records()

    def test_lark_cli_nonzero_raises(self, config_path: Path) -> None:
        r = MagicMock()
        r.returncode = 1
        r.stdout = ""
        r.stderr = "auth failed"
        with patch("lu.feishu.client.subprocess.run", return_value=r):
            client = FeishuBitableClient(config_path)
            with pytest.raises(FeishuError) as exc:
                client.list_records()
            assert "auth failed" in str(exc.value) or "lark-cli" in str(exc.value).lower()

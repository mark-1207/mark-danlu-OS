"""FeishuBitableClient：基于 lark-cli subprocess 包装

不引入 Python SDK；调用 lark-cli 外部命令。
需要用户先 `lark-cli login` 完成认证。

配置（feishu_config.yaml）：
```yaml
app_token: bascn_xxx
table_id: tbl_xxx
fields:
  voice: fld_voice
  version: fld_version
  ...
```
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import yaml


class FeishuError(Exception):
    """飞书调用错误"""


class FeishuBitableClient:
    """飞书多维表格 client"""

    def __init__(self, config_path: Path | str) -> None:
        self.config_path = Path(config_path)
        if not self.config_path.is_file():
            raise FeishuError(f"飞书配置不存在: {self.config_path}")
        try:
            data = yaml.safe_load(self.config_path.read_text(encoding="utf-8"))
        except Exception as e:
            raise FeishuError(f"飞书配置解析失败: {e}") from e
        if not isinstance(data, dict):
            raise FeishuError("飞书配置必须是 mapping")

        self.app_token = data.get("app_token", "")
        self.table_id = data.get("table_id", "")
        self.fields: dict[str, str] = data.get("fields", {})

        if not self.app_token or not self.table_id:
            raise FeishuError("飞书配置缺少 app_token / table_id")

    def _run(self, args: list[str]) -> dict:
        """调用 lark-cli，解析返回 JSON"""
        if not shutil.which("lark-cli"):
            raise FeishuError(
                "lark-cli 未安装或不在 PATH，请先 `npm install -g @larksuite/cli` 并 `lark-cli login`"
            )
        cmd = ["lark-cli"] + args
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        except FileNotFoundError as e:
            raise FeishuError(f"lark-cli 不可执行: {e}") from e
        except subprocess.TimeoutExpired as e:
            raise FeishuError(f"lark-cli 超时: {e}") from e

        if result.returncode != 0:
            raise FeishuError(f"lark-cli 失败 (code={result.returncode}): {result.stderr}")

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise FeishuError(f"lark-cli 输出不是 JSON: {e}: {result.stdout[:200]}") from e

    def list_records(self) -> list[dict]:
        """列出所有记录"""
        resp = self._run(["bitable", "list", "--app-token", self.app_token, "--table-id", self.table_id])
        items = resp.get("data", {}).get("items", [])
        return list(items)

    def create_record(self, fields: dict) -> dict:
        """创建记录，fields 是 Bitable field_id → value 映射"""
        resp = self._run([
            "bitable", "create",
            "--app-token", self.app_token,
            "--table-id", self.table_id,
            "--fields", json.dumps(fields, ensure_ascii=False),
        ])
        return resp.get("data", {}).get("record", {})

    def update_record(self, record_id: str, fields: dict) -> dict:
        """更新记录"""
        resp = self._run([
            "bitable", "update",
            "--app-token", self.app_token,
            "--table-id", self.table_id,
            "--record-id", record_id,
            "--fields", json.dumps(fields, ensure_ascii=False),
        ])
        return resp.get("data", {}).get("record", {})

    def batch_upsert(self, records: list[dict]) -> list[dict]:
        """批量 upsert（按 record_id 区分新建/更新）"""
        results: list[dict] = []
        for rec in records:
            rid = rec.get("id") or rec.get("record_id")
            fields = {k: v for k, v in rec.items() if k not in ("id", "record_id")}
            if rid:
                results.append(self.update_record(rid, fields))
            else:
                results.append(self.create_record(fields))
        return results


__all__ = ["FeishuBitableClient", "FeishuError"]

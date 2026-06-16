"""FileStore: JSON 文件持久化

目录结构：
<base_path>/
└── <run_id>/
    ├── context.json
    ├── blueprint.json
    └── ...

支持：
- 任意 pydantic BaseModel 序列化
- 任意 dict 序列化
- 列 run 列表、列 key 列表
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class RunNotFoundError(FileNotFoundError):
    """指定 run_id 不存在"""


class KeyNotFoundError(FileNotFoundError):
    """指定 key 在 run 中不存在"""


class FileStore:
    def __init__(self, base_path: Path | str) -> None:
        self.base_path = Path(base_path)

    def _run_dir(self, run_id: str) -> Path:
        return self.base_path / run_id

    def _file(self, run_id: str, key: str) -> Path:
        return self._run_dir(run_id) / f"{key}.json"

    def save(
        self,
        run_id: str,
        key: str,
        data: BaseModel | dict[str, Any],
    ) -> Path:
        run_dir = self._run_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)

        path = self._file(run_id, key)
        if isinstance(data, BaseModel):
            payload = data.model_dump(mode="json")
        else:
            payload = data

        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path

    def load(self, run_id: str, key: str, model_class: type[T]) -> T:
        run_dir = self._run_dir(run_id)
        if not run_dir.is_dir():
            raise RunNotFoundError(f"Run 不存在: {run_id}")

        path = self._file(run_id, key)
        if not path.is_file():
            raise KeyNotFoundError(f"Run {run_id} 中不存在 key: {key}")

        payload = json.loads(path.read_text(encoding="utf-8"))
        if model_class is dict:
            return payload  # type: ignore[return-value]
        return model_class.model_validate(payload)

    def list_keys(self, run_id: str) -> list[str]:
        run_dir = self._run_dir(run_id)
        if not run_dir.is_dir():
            return []
        return sorted(p.stem for p in run_dir.glob("*.json"))

    def list_runs(self) -> list[str]:
        if not self.base_path.is_dir():
            return []
        return sorted(p.name for p in self.base_path.iterdir() if p.is_dir())

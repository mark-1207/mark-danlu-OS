"""FileStore 持久化测试

FileStore 负责将 run 上下文持久化为 JSON 文件：
runs/<run_id>/<key>.json
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from pydantic import BaseModel

from lu.store.file_store import FileStore, RunNotFoundError, KeyNotFoundError


class SampleModel(BaseModel):
    name: str
    value: int
    created_at: datetime


class TestFileStoreBasic:
    def test_save_and_load(self, tmp_path: Path):
        store = FileStore(tmp_path)
        data = SampleModel(name="test", value=42, created_at=datetime(2026, 6, 16))

        store.save("run_001", "context", data)
        loaded = store.load("run_001", "context", SampleModel)

        assert loaded == data

    def test_save_creates_directory(self, tmp_path: Path):
        store = FileStore(tmp_path)
        data = SampleModel(name="x", value=1, created_at=datetime.now())

        store.save("run_002", "context", data)

        assert (tmp_path / "run_002").is_dir()
        assert (tmp_path / "run_002" / "context.json").is_file()

    def test_save_dict(self, tmp_path: Path):
        store = FileStore(tmp_path)
        store.save("run_003", "metadata", {"foo": "bar", "count": 10})

        loaded = store.load("run_003", "metadata", dict)
        assert loaded == {"foo": "bar", "count": 10}


class TestFileStoreLoad:
    def test_load_missing_run_raises(self, tmp_path: Path):
        store = FileStore(tmp_path)
        with pytest.raises(RunNotFoundError, match="run_xxx"):
            store.load("run_xxx", "context", SampleModel)

    def test_load_missing_key_raises(self, tmp_path: Path):
        store = FileStore(tmp_path)
        store.save("run_004", "context", SampleModel(name="a", value=1, created_at=datetime.now()))

        with pytest.raises(KeyNotFoundError, match="missing_key"):
            store.load("run_004", "missing_key", SampleModel)


class TestFileStoreList:
    def test_list_keys(self, tmp_path: Path):
        store = FileStore(tmp_path)
        now = datetime.now()
        store.save("run_005", "context", SampleModel(name="a", value=1, created_at=now))
        store.save("run_005", "blueprint", SampleModel(name="b", value=2, created_at=now))
        store.save("run_005", "draft", SampleModel(name="c", value=3, created_at=now))

        keys = store.list_keys("run_005")
        assert sorted(keys) == ["blueprint", "context", "draft"]

    def test_list_keys_empty_run(self, tmp_path: Path):
        store = FileStore(tmp_path)
        (tmp_path / "empty_run").mkdir()
        assert store.list_keys("empty_run") == []

    def test_list_runs(self, tmp_path: Path):
        store = FileStore(tmp_path)
        now = datetime.now()
        store.save("run_a", "context", SampleModel(name="x", value=1, created_at=now))
        store.save("run_b", "context", SampleModel(name="y", value=2, created_at=now))
        store.save("run_c", "context", SampleModel(name="z", value=3, created_at=now))

        runs = store.list_runs()
        assert sorted(runs) == ["run_a", "run_b", "run_c"]


class TestFileStoreOverwrite:
    def test_overwrite_existing(self, tmp_path: Path):
        store = FileStore(tmp_path)
        now = datetime.now()
        store.save("run_006", "context", SampleModel(name="old", value=1, created_at=now))
        store.save("run_006", "context", SampleModel(name="new", value=99, created_at=now))

        loaded = store.load("run_006", "context", SampleModel)
        assert loaded.name == "new"
        assert loaded.value == 99

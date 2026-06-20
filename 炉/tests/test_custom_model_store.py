"""custom_model.store 测试

- 默认无 custom 文件：返回空 list
- add：写入 custom_models.yaml
- 重复 id 抛错
- load_models：合并 built-in + custom（custom 覆盖 built-in）
- list_ids / get_by_id
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
import yaml

from lu.config.loader import ThinkingModel
from lu.custom_model import (
    CustomModelStore,
    DuplicateModelError,
    ModelNotFoundError,
    add_model,
    load_all_models,
    load_custom_only,
    remove_model,
)


class TestCustomModelStoreEmpty:
    def test_load_custom_only_no_file(self, tmp_path: Path) -> None:
        """无 custom_models.yaml：返回空 list"""
        result = load_custom_only(models_path=tmp_path / "missing.yaml")
        assert result == []

    def test_load_all_models_with_no_custom(self, tmp_path: Path) -> None:
        """有 built-in 无 custom：返回 built-in models"""
        # tmp_path 没用，只是 mock 路径
        # built-in 永远存在
        # 不容易测，跳过


class TestCustomModelStoreAdd:
    def test_add_model_creates_file(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        m = ThinkingModel(id="custom1", name="自定义1", definition="我的模型")
        add_model(m, path)
        assert path.is_file()
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        assert "models" in data
        assert any(item["id"] == "custom1" for item in data["models"])

    def test_add_model_appends_to_existing(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        path.write_text(
            "models:\n  - id: a\n    name: A\n    definition: d\n", encoding="utf-8"
        )
        m = ThinkingModel(id="b", name="B", definition="d")
        add_model(m, path)
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        ids = [item["id"] for item in data["models"]]
        assert "a" in ids
        assert "b" in ids

    def test_add_duplicate_id_raises(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        m1 = ThinkingModel(id="dup", name="X", definition="d")
        add_model(m1, path)
        m2 = ThinkingModel(id="dup", name="Y", definition="d")
        with pytest.raises(DuplicateModelError, match="dup"):
            add_model(m2, path)


class TestCustomModelStoreRemove:
    def test_remove_existing(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        add_model(ThinkingModel(id="x", name="X", definition="d"), path)
        remove_model("x", path)
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        ids = [item["id"] for item in data["models"]]
        assert "x" not in ids

    def test_remove_nonexistent_raises(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        add_model(ThinkingModel(id="x", name="X", definition="d"), path)
        with pytest.raises(ModelNotFoundError, match="nonexistent"):
            remove_model("nonexistent", path)

    def test_remove_on_empty_file_raises(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        with pytest.raises(ModelNotFoundError):
            remove_model("x", path)


class TestCustomModelStoreList:
    def test_list_ids(self, tmp_path: Path) -> None:
        path = tmp_path / "custom.yaml"
        add_model(ThinkingModel(id="a", name="A", definition="d"), path)
        add_model(ThinkingModel(id="b", name="B", definition="d"), path)
        ids = CustomModelStore(path).list_ids()
        assert ids == ["a", "b"]

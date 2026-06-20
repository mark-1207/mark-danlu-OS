"""custom_model 模块：用户自定义 ThinkingModel 存储

文件位置：config/thinking_models/custom_models.yaml（与 built-in 分开）

约束：
- 严格遵守"无巨型函数"
- 每个函数 < 30 行
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Type, TypeVar

import yaml

from lu.config.loader import Framework, ThinkingModel

T = TypeVar("T", ThinkingModel, Framework)


_DEFAULT_CUSTOM_MODELS_PATH = Path("config/thinking_models/custom_models.yaml")
_DEFAULT_CUSTOM_FRAMEWORKS_PATH = Path(
    "config/thinking_models/custom_frameworks.yaml"
)
_ID_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")


class DuplicateError(ValueError):
    """id 已存在"""


class NotFoundError(KeyError):
    """id 不存在"""


# 别名保持向后兼容
DuplicateModelError = DuplicateError
ModelNotFoundError = NotFoundError


def _read_yaml(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise ValueError(f"{path} 解析失败: {e}") from e
    return data if isinstance(data, dict) else {}


def _write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def _validate_id(item_id: str) -> None:
    if not _ID_PATTERN.match(item_id):
        raise ValueError(
            f"id 不合法: {item_id!r}（需匹配 ^[a-zA-Z][a-zA-Z0-9_]*$）"
        )


def _load_items_from(path: Path, cls: Type[T], key: str) -> list[T]:
    data = _read_yaml(path)
    raw = data.get(key) or []
    out: list[T] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(cls(**item))
        except Exception:
            continue
    return out


# ========== Model API ==========


def load_custom_only(
    models_path: Path | str | None = None,
) -> list[ThinkingModel]:
    path = Path(models_path) if models_path else _DEFAULT_CUSTOM_MODELS_PATH
    return _load_items_from(path, ThinkingModel, "models")


def load_all_models(
    built_in_path: Path | str = "config/thinking_models/models.yaml",
    custom_path: Path | str | None = None,
) -> list[ThinkingModel]:
    built_in = _load_items_from(Path(built_in_path), ThinkingModel, "models")
    custom = load_custom_only(custom_path)
    by_id: dict[str, ThinkingModel] = {m.id: m for m in built_in}
    for m in custom:
        by_id[m.id] = m
    return list(by_id.values())


def add_model(
    model: ThinkingModel, models_path: Path | str | None = None
) -> None:
    _validate_id(model.id)
    path = Path(models_path) if models_path else _DEFAULT_CUSTOM_MODELS_PATH
    data = _read_yaml(path)
    existing = data.get("models") or []
    if any(isinstance(m, dict) and m.get("id") == model.id for m in existing):
        raise DuplicateModelError(f"模型 id 已存在: {model.id}")
    existing.append(model.model_dump(exclude_none=True))
    data["models"] = existing
    _write_yaml(path, data)


def remove_model(model_id: str, models_path: Path | str | None = None) -> None:
    path = Path(models_path) if models_path else _DEFAULT_CUSTOM_MODELS_PATH
    data = _read_yaml(path)
    existing = data.get("models") or []
    new_list = [m for m in existing if not (isinstance(m, dict) and m.get("id") == model_id)]
    if len(new_list) == len(existing):
        raise ModelNotFoundError(f"模型 id 不存在: {model_id}")
    data["models"] = new_list
    _write_yaml(path, data)


# ========== Framework API ==========


def load_custom_frameworks(
    frameworks_path: Path | str | None = None,
) -> list[Framework]:
    path = Path(frameworks_path) if frameworks_path else _DEFAULT_CUSTOM_FRAMEWORKS_PATH
    return _load_items_from(path, Framework, "frameworks")


def load_all_frameworks(
    built_in_path: Path | str = "config/thinking_models/frameworks.yaml",
    custom_path: Path | str | None = None,
) -> list[Framework]:
    built_in = _load_items_from(Path(built_in_path), Framework, "frameworks")
    custom = load_custom_frameworks(custom_path)
    by_id: dict[str, Framework] = {f.id: f for f in built_in}
    for f in custom:
        by_id[f.id] = f
    return list(by_id.values())


def add_framework(
    framework: Framework, frameworks_path: Path | str | None = None
) -> None:
    _validate_id(framework.id)
    path = Path(frameworks_path) if frameworks_path else _DEFAULT_CUSTOM_FRAMEWORKS_PATH
    data = _read_yaml(path)
    existing = data.get("frameworks") or []
    if any(isinstance(f, dict) and f.get("id") == framework.id for f in existing):
        raise DuplicateModelError(f"framework id 已存在: {framework.id}")
    existing.append(framework.model_dump(exclude_none=True))
    data["frameworks"] = existing
    _write_yaml(path, data)


def remove_framework(
    framework_id: str, frameworks_path: Path | str | None = None
) -> None:
    path = Path(frameworks_path) if frameworks_path else _DEFAULT_CUSTOM_FRAMEWORKS_PATH
    data = _read_yaml(path)
    existing = data.get("frameworks") or []
    new_list = [
        f for f in existing
        if not (isinstance(f, dict) and f.get("id") == framework_id)
    ]
    if len(new_list) == len(existing):
        raise ModelNotFoundError(f"framework id 不存在: {framework_id}")
    data["frameworks"] = new_list
    _write_yaml(path, data)


class CustomModelStore:
    """model YAML 文件的增删改查封装"""

    def __init__(self, models_path: Path | str | None = None) -> None:
        self.path = Path(models_path) if models_path else _DEFAULT_CUSTOM_MODELS_PATH

    def list_ids(self) -> list[str]:
        return [m.id for m in load_custom_only(self.path)]

    def list_all(self) -> list[ThinkingModel]:
        return load_custom_only(self.path)

    def add(self, model: ThinkingModel) -> None:
        add_model(model, self.path)

    def remove(self, model_id: str) -> None:
        remove_model(model_id, self.path)

    def get(self, model_id: str) -> ThinkingModel:
        for m in load_custom_only(self.path):
            if m.id == model_id:
                return m
        raise ModelNotFoundError(f"模型 id 不存在: {model_id}")


__all__ = [
    "CustomModelStore",
    "DuplicateError",
    "DuplicateModelError",
    "ModelNotFoundError",
    "NotFoundError",
    "add_framework",
    "add_model",
    "load_all_frameworks",
    "load_all_models",
    "load_custom_frameworks",
    "load_custom_only",
    "remove_framework",
    "remove_model",
]

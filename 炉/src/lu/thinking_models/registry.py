"""思想模型 + 框架的加载与查询

支持：
- 从 YAML 加载 12 模型
- 从 YAML 加载 4 框架
- 按 id 查询
- 迭代
- 错误：缺失 id 抛 KeyError
"""
from __future__ import annotations

from pathlib import Path

from lu.config.loader import ThinkingModel, Framework, load_thinking_models


class ThinkingModelRegistry:
    def __init__(self, models: list[ThinkingModel]) -> None:
        self._by_id: dict[str, ThinkingModel] = {m.id: m for m in models}
        self._all: list[ThinkingModel] = list(models)

    @classmethod
    def from_yaml(cls, path: Path | str) -> "ThinkingModelRegistry":
        config = load_thinking_models(path)
        return cls(config.models)

    def __len__(self) -> int:
        return len(self._all)

    def __iter__(self):
        return iter(self._all)

    def get(self, model_id: str) -> ThinkingModel:
        if model_id not in self._by_id:
            raise KeyError(f"ThinkingModel 不存在: {model_id}")
        return self._by_id[model_id]

    def list_all(self) -> list[ThinkingModel]:
        return list(self._all)


class FrameworkRegistry:
    def __init__(self, frameworks: list[Framework]) -> None:
        self._by_id: dict[str, Framework] = {f.id: f for f in frameworks}
        self._all: list[Framework] = list(frameworks)

    @classmethod
    def from_yaml(cls, path: Path | str) -> "FrameworkRegistry":
        config = load_thinking_models(path)
        return cls(config.frameworks)

    def __len__(self) -> int:
        return len(self._all)

    def __iter__(self):
        return iter(self._all)

    def get(self, framework_id: str) -> Framework:
        if framework_id not in self._by_id:
            raise KeyError(f"Framework 不存在: {framework_id}")
        return self._by_id[framework_id]

    def list_all(self) -> list[Framework]:
        return list(self._all)


DEFAULT_MODELS_PATH = "config/thinking_models/models.yaml"
DEFAULT_FRAMEWORKS_PATH = "config/thinking_models/frameworks.yaml"


def load_default_registries() -> tuple[ThinkingModelRegistry, FrameworkRegistry]:
    return (
        ThinkingModelRegistry.from_yaml(DEFAULT_MODELS_PATH),
        FrameworkRegistry.from_yaml(DEFAULT_FRAMEWORKS_PATH),
    )

"""YAML 配置加载器

- StyleProfile: 用户风格画像（v1 本地 YAML）
- ThinkingModelsConfig: 思想模型 + 框架（v1 本地 YAML）
- 统一异常：ConfigLoadError（包装 IO / parse / validate 错误）
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


class ConfigLoadError(Exception):
    """配置文件加载失败"""


class ForbiddenTerm(BaseModel):
    term: str
    severity: str = "medium"
    replacement: str | None = None


class SocraticStopSignal(BaseModel):
    typical_rounds: float = 3.0
    saturation_keywords: list[str] = Field(
        default_factory=lambda: ["够了", "差不多了", "先这样"]
    )
    auto_stop_enabled: bool = False
    sample_count: int = 0


class StyleProfile(BaseModel):
    version: int = 1
    voice: str | None = None
    forbidden: list[ForbiddenTerm] = Field(default_factory=list)
    socratic_stop_signal: SocraticStopSignal = Field(default_factory=SocraticStopSignal)

    @field_validator("forbidden", mode="before")
    @classmethod
    def _normalize_forbidden(cls, v: Any) -> Any:
        if not isinstance(v, list):
            return v
        normalized = []
        for item in v:
            if isinstance(item, str):
                normalized.append({"term": item})
            elif isinstance(item, dict):
                normalized.append(item)
            else:
                normalized.append(item)
        return normalized


class ThinkingModel(BaseModel):
    id: str
    name: str
    definition: str
    use_when: str | None = None
    example: str | None = None
    prompt_hint: str | None = None
    avoid: str | None = None


class Framework(BaseModel):
    id: str
    name: str
    strategy: str
    model_ids: list[str]
    trigger_keywords: list[str] = Field(default_factory=list)


class ThinkingModelsConfig(BaseModel):
    version: int = 1
    models: list[ThinkingModel] = Field(default_factory=list)
    frameworks: list[Framework] = Field(default_factory=list)


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ConfigLoadError(f"配置文件不存在: {path}")
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        raise ConfigLoadError(f"读取失败: {path}: {e}") from e
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        raise ConfigLoadError(f"YAML 解析失败: {path}: {e}") from e
    if not isinstance(data, dict):
        raise ConfigLoadError(f"YAML 顶层必须是 mapping: {path}")
    return data


def load_style_profile(path: Path | str) -> StyleProfile:
    p = Path(path)
    data = _read_yaml(p)
    try:
        return StyleProfile.model_validate(data)
    except Exception as e:
        raise ConfigLoadError(f"StyleProfile 校验失败: {p}: {e}") from e


def load_thinking_models(path: Path | str) -> ThinkingModelsConfig:
    p = Path(path)
    data = _read_yaml(p)
    try:
        return ThinkingModelsConfig.model_validate(data)
    except Exception as e:
        raise ConfigLoadError(f"ThinkingModelsConfig 校验失败: {p}: {e}") from e

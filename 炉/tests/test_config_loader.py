"""ConfigLoader 测试：YAML 配置 → pydantic 模型

参考 04-DATA-MODEL.md 第 3 节配置态模型。
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from lu.config.loader import (
    ConfigLoadError,
    ForbiddenTerm,
    StyleProfile,
    SocraticStopSignal,
    load_style_profile,
    load_thinking_models,
)


@pytest.fixture
def style_profile_yaml(tmp_path: Path) -> Path:
    data = {
        "version": 1,
        "voice": "犀利一针见血",
        "forbidden": [
            {"term": "赋能", "severity": "high", "replacement": "帮助"},
            {"term": "在这个时代", "severity": "medium", "replacement": "这两年"},
            "让我们来看看",  # 简写形式
        ],
        "socratic_stop_signal": {
            "typical_rounds": 3.0,
            "saturation_keywords": ["够了", "差不多了", "先这样"],
            "auto_stop_enabled": False,
            "sample_count": 12,
        },
    }
    path = tmp_path / "style_profile.yaml"
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return path


@pytest.fixture
def thinking_models_yaml(tmp_path: Path) -> Path:
    data = {
        "version": 1,
        "models": [
            {
                "id": "first_principles",
                "name": "第一性原理",
                "definition": "回到事物最基本的真理",
                "use_when": "需要打破常规",
                "example": "用物理学看用户体验",
            },
            {
                "id": "5why",
                "name": "5Why",
                "definition": "连问 5 个为什么",
                "use_when": "诊断根因",
            },
        ],
        "frameworks": [
            {
                "id": "problem_decomposition",
                "name": "问题解构",
                "strategy": "chain",
                "model_ids": ["first_principles", "5why", "occam_razor"],
                "trigger_keywords": ["为什么", "怎么回事"],
            },
        ],
    }
    path = tmp_path / "thinking_models.yaml"
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return path


class TestLoadStyleProfile:
    def test_load_full_profile(self, style_profile_yaml: Path):
        profile = load_style_profile(style_profile_yaml)

        assert profile.version == 1
        assert profile.voice == "犀利一针见血"

    def test_forbidden_term_objects(self, style_profile_yaml: Path):
        profile = load_style_profile(style_profile_yaml)

        assert len(profile.forbidden) == 3
        assert profile.forbidden[0].term == "赋能"
        assert profile.forbidden[0].severity == "high"
        assert profile.forbidden[0].replacement == "帮助"

    def test_forbidden_term_shorthand_normalized(self, style_profile_yaml: Path):
        profile = load_style_profile(style_profile_yaml)

        short = profile.forbidden[2]
        assert short.term == "让我们来看看"
        assert short.severity == "medium"  # 默认值
        assert short.replacement is None

    def test_socratic_stop_signal(self, style_profile_yaml: Path):
        profile = load_style_profile(style_profile_yaml)

        assert profile.socratic_stop_signal.typical_rounds == 3.0
        assert profile.socratic_stop_signal.auto_stop_enabled is False
        assert profile.socratic_stop_signal.sample_count == 12
        assert "够了" in profile.socratic_stop_signal.saturation_keywords


class TestLoadStyleProfileDefaults:
    def test_minimal_profile_uses_defaults(self, tmp_path: Path):
        path = tmp_path / "style_profile.yaml"
        path.write_text(yaml.safe_dump({"version": 1}), encoding="utf-8")

        profile = load_style_profile(path)

        assert profile.version == 1
        assert profile.voice is None
        assert profile.forbidden == []
        assert profile.socratic_stop_signal.typical_rounds == 3.0
        assert profile.socratic_stop_signal.auto_stop_enabled is False

    def test_missing_file_raises(self, tmp_path: Path):
        with pytest.raises(ConfigLoadError, match="不存在"):
            load_style_profile(tmp_path / "nonexistent.yaml")

    def test_malformed_yaml_raises(self, tmp_path: Path):
        path = tmp_path / "bad.yaml"
        path.write_text("invalid: : :", encoding="utf-8")

        with pytest.raises(ConfigLoadError, match="解析失败"):
            load_style_profile(path)


class TestLoadThinkingModels:
    def test_load_models(self, thinking_models_yaml: Path):
        config = load_thinking_models(thinking_models_yaml)

        assert config.version == 1
        assert len(config.models) == 2
        assert config.models[0].id == "first_principles"
        assert config.models[0].name == "第一性原理"
        assert config.models[1].use_when == "诊断根因"

    def test_load_frameworks(self, thinking_models_yaml: Path):
        config = load_thinking_models(thinking_models_yaml)

        assert len(config.frameworks) == 1
        fw = config.frameworks[0]
        assert fw.id == "problem_decomposition"
        assert fw.strategy == "chain"
        assert fw.model_ids == ["first_principles", "5why", "occam_razor"]
        assert "为什么" in fw.trigger_keywords

    def test_missing_file_raises(self, tmp_path: Path):
        with pytest.raises(ConfigLoadError, match="不存在"):
            load_thinking_models(tmp_path / "nope.yaml")

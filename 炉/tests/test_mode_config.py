"""Mode config + 模式化 Orchestrator 测试

验证：
- 3 模式（social/create/recreate）各自走正确的步
- mode 切换行为正确
- 续跑 mode 不匹配报错
- step_configs 顺序符合规范
"""
from __future__ import annotations

import pytest

from lu.config.loader import SocraticStopSignal, StyleProfile
from lu.pipeline.mode_config import (
    MODE_CONFIGS,
    MODE_CREATE,
    MODE_RECREATE,
    MODE_SOCIAL,
    VALID_MODES,
    get_mode_config,
)
from lu.pipeline.orchestrator import Orchestrator
from lu.state.machine import RunState
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


class TestModeConfig:
    def test_valid_modes(self) -> None:
        assert set(VALID_MODES) == {"social", "create", "recreate"}

    def test_get_mode_config_social(self) -> None:
        cfgs = get_mode_config("social")
        assert cfgs is MODE_SOCIAL
        assert len(cfgs) == 5

    def test_get_mode_config_create(self) -> None:
        cfgs = get_mode_config("create")
        assert cfgs is MODE_CREATE
        assert len(cfgs) == 8

    def test_get_mode_config_recreate(self) -> None:
        cfgs = get_mode_config("recreate")
        assert cfgs is MODE_RECREATE
        assert len(cfgs) == 7

    def test_get_mode_config_invalid_raises(self) -> None:
        with pytest.raises(ValueError, match="未知 mode"):
            get_mode_config("foo")

    def test_social_last_state_is_completed(self) -> None:
        assert MODE_SOCIAL[-1].state is RunState.COMPLETED

    def test_create_last_state_is_completed(self) -> None:
        assert MODE_CREATE[-1].state is RunState.COMPLETED

    def test_recreate_last_state_is_completed(self) -> None:
        assert MODE_RECREATE[-1].state is RunState.COMPLETED

    def test_social_states(self) -> None:
        states = [c.state for c in MODE_SOCIAL]
        assert states == [
            RunState.STEP1_DONE,
            RunState.STEP3_DONE,
            RunState.STEP5_DONE,
            RunState.STEP6_DONE,
            RunState.COMPLETED,
        ]

    def test_create_states(self) -> None:
        states = [c.state for c in MODE_CREATE]
        assert states == [
            RunState.STEP1_DONE,
            RunState.STEP2_DONE,
            RunState.STEP3_DONE,
            RunState.STEP4_DONE,
            RunState.STEP5_DONE,
            RunState.STEP6_DONE,
            RunState.STEP7_DONE,
            RunState.COMPLETED,
        ]

    def test_recreate_states(self) -> None:
        states = [c.state for c in MODE_RECREATE]
        assert states == [
            RunState.STEP1_DONE,
            RunState.STEP2_DONE,
            RunState.STEP3_DONE,
            RunState.STEP5_DONE,
            RunState.STEP6_DONE,
            RunState.STEP7_DONE,
            RunState.COMPLETED,
        ]

    def test_social_skips_socratic(self) -> None:
        states = [c.state for c in MODE_SOCIAL]
        assert RunState.STEP2_DONE not in states

    def test_recreate_skips_gap(self) -> None:
        states = [c.state for c in MODE_RECREATE]
        assert RunState.STEP4_DONE not in states


class TestOrchestratorModeInit:
    def test_default_mode_is_create(self) -> None:
        sp = StyleProfile(socratic_stop_signal=SocraticStopSignal(saturation_keywords=["x"], typical_rounds=2))
        fr = FrameworkRegistry([])
        mr = ThinkingModelRegistry([])
        orch = Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr)
        assert orch.mode == "create"

    def test_invalid_mode_raises(self) -> None:
        sp = StyleProfile(socratic_stop_signal=SocraticStopSignal(saturation_keywords=["x"], typical_rounds=2))
        fr = FrameworkRegistry([])
        mr = ThinkingModelRegistry([])
        with pytest.raises(ValueError, match="未知 mode"):
            Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr, mode="foo")

    def test_step_configs_set_correctly(self) -> None:
        sp = StyleProfile(socratic_stop_signal=SocraticStopSignal(saturation_keywords=["x"], typical_rounds=2))
        fr = FrameworkRegistry([])
        mr = ThinkingModelRegistry([])
        for mode in VALID_MODES:
            orch = Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr, mode=mode)
            assert orch.step_configs is MODE_CONFIGS[mode]

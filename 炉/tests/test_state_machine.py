"""RunState 状态机测试

参考 02-ARCHITECTURE.md 第 4 节：
- CREATED → STEP1_DONE → ... → STEP7_DONE → COMPLETED
- 任意状态 → FAILED
- COMPLETED / FAILED 是终态

v3 P0 多模式：social/create/recreate 各自只走部分状态，由 mode_config 决定。
"""
from __future__ import annotations

import pytest

from lu.state.machine import RunState, can_transition, next_state, validate_transition


class TestRunStateEnum:
    def test_has_10_states(self):
        assert len(RunState) == 10

    def test_values_match_spec(self):
        assert RunState.CREATED.value == "created"
        assert RunState.STEP1_DONE.value == "step1_done"
        assert RunState.STEP2_DONE.value == "step2_done"
        assert RunState.STEP3_DONE.value == "step3_done"
        assert RunState.STEP4_DONE.value == "step4_done"
        assert RunState.STEP5_DONE.value == "step5_done"
        assert RunState.STEP6_DONE.value == "step6_done"
        assert RunState.STEP7_DONE.value == "step7_done"
        assert RunState.COMPLETED.value == "completed"
        assert RunState.FAILED.value == "failed"


class TestCanTransition:
    def test_sequential_steps_allowed(self):
        assert can_transition(RunState.CREATED, RunState.STEP1_DONE)
        assert can_transition(RunState.STEP1_DONE, RunState.STEP2_DONE)
        assert can_transition(RunState.STEP2_DONE, RunState.STEP3_DONE)
        assert can_transition(RunState.STEP3_DONE, RunState.STEP4_DONE)
        assert can_transition(RunState.STEP4_DONE, RunState.STEP5_DONE)
        assert can_transition(RunState.STEP5_DONE, RunState.STEP6_DONE)
        assert can_transition(RunState.STEP6_DONE, RunState.STEP7_DONE)
        assert can_transition(RunState.STEP7_DONE, RunState.COMPLETED)

    def test_skip_step_blocked(self):
        assert not can_transition(RunState.CREATED, RunState.STEP2_DONE)
        assert not can_transition(RunState.STEP1_DONE, RunState.STEP3_DONE)
        assert not can_transition(RunState.STEP3_DONE, RunState.STEP5_DONE)
        assert not can_transition(RunState.STEP5_DONE, RunState.STEP7_DONE)

    def test_any_to_failed_allowed(self):
        for state in RunState:
            if state in (RunState.COMPLETED, RunState.FAILED):
                continue
            assert can_transition(state, RunState.FAILED), f"{state} → FAILED 应允许"

    def test_terminal_states_blocked(self):
        for terminal in (RunState.COMPLETED, RunState.FAILED):
            for target in RunState:
                if target is terminal:
                    continue
                assert not can_transition(terminal, target), (
                    f"{terminal} → {target} 应被禁止"
                )

    def test_backward_blocked(self):
        assert not can_transition(RunState.STEP2_DONE, RunState.STEP1_DONE)
        assert not can_transition(RunState.STEP7_DONE, RunState.CREATED)


class TestNextState:
    def test_sequential_next(self):
        assert next_state(RunState.CREATED) == RunState.STEP1_DONE
        assert next_state(RunState.STEP1_DONE) == RunState.STEP2_DONE
        assert next_state(RunState.STEP5_DONE) == RunState.STEP6_DONE
        assert next_state(RunState.STEP6_DONE) == RunState.STEP7_DONE
        assert next_state(RunState.STEP7_DONE) == RunState.COMPLETED

    def test_terminal_returns_none(self):
        assert next_state(RunState.COMPLETED) is None
        assert next_state(RunState.FAILED) is None


class TestValidateTransition:
    def test_valid_transition_does_not_raise(self):
        validate_transition(RunState.CREATED, RunState.STEP1_DONE)

    def test_invalid_transition_raises(self):
        with pytest.raises(ValueError, match="不允许"):
            validate_transition(RunState.CREATED, RunState.STEP3_DONE)

    def test_failed_transition_message_includes_states(self):
        with pytest.raises(ValueError) as exc_info:
            validate_transition(RunState.COMPLETED, RunState.STEP1_DONE)
        msg = str(exc_info.value)
        assert "completed" in msg
        assert "step1_done" in msg

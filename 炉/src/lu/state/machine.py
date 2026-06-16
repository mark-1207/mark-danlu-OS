"""RunState 状态机

参考 02-ARCHITECTURE.md 第 4 节：
- CREATED → STEP1_DONE → ... → STEP6_DONE → COMPLETED
- 任意状态 → FAILED
- COMPLETED / FAILED 是终态
"""
from __future__ import annotations

from enum import Enum


class RunState(str, Enum):
    CREATED = "created"
    STEP1_DONE = "step1_done"
    STEP2_DONE = "step2_done"
    STEP3_DONE = "step3_done"
    STEP4_DONE = "step4_done"
    STEP5_DONE = "step5_done"
    STEP6_DONE = "step6_done"
    COMPLETED = "completed"
    FAILED = "failed"


_SEQUENTIAL: dict[RunState, RunState] = {
    RunState.CREATED: RunState.STEP1_DONE,
    RunState.STEP1_DONE: RunState.STEP2_DONE,
    RunState.STEP2_DONE: RunState.STEP3_DONE,
    RunState.STEP3_DONE: RunState.STEP4_DONE,
    RunState.STEP4_DONE: RunState.STEP5_DONE,
    RunState.STEP5_DONE: RunState.STEP6_DONE,
    RunState.STEP6_DONE: RunState.COMPLETED,
}

_TERMINAL: frozenset[RunState] = frozenset({RunState.COMPLETED, RunState.FAILED})


def can_transition(from_state: RunState, to_state: RunState) -> bool:
    if from_state in _TERMINAL:
        return False
    if to_state is RunState.FAILED:
        return True
    return _SEQUENTIAL.get(from_state) is to_state


def next_state(current: RunState) -> RunState | None:
    if current in _TERMINAL:
        return None
    return _SEQUENTIAL.get(current)


def validate_transition(from_state: RunState, to_state: RunState) -> None:
    if not can_transition(from_state, to_state):
        raise ValueError(
            f"状态机不允许的状态转换: {from_state.value} → {to_state.value}"
        )

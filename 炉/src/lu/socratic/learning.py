"""3 阶段学习：决定何时停止苏格拉底追问

参考 D-008 + 99-LESSONS-LEARNED P14
- 阶段 1（0-30 样本）：靠用户说停
- 阶段 2（30-100 样本）：系统提示 + 用户决定
- 阶段 3（100+ 样本）：自动判断
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from lu.config.loader import SocraticStopSignal


class LearningPhase(str, Enum):
    PHASE1 = "phase1_user_decides"
    PHASE2 = "phase2_suggest"
    PHASE3 = "phase3_auto"


PHASE1_THRESHOLD = 30
PHASE2_THRESHOLD = 100


@dataclass(frozen=True)
class StopDecision:
    action: str
    reason: str


def current_phase(signal: SocraticStopSignal) -> LearningPhase:
    n = signal.sample_count
    if n < PHASE1_THRESHOLD:
        return LearningPhase.PHASE1
    if n < PHASE2_THRESHOLD:
        return LearningPhase.PHASE2
    return LearningPhase.PHASE3


def should_stop(
    signal: SocraticStopSignal,
    rounds: int,
    user_says_stop: bool,
) -> bool:
    if user_says_stop:
        return True

    phase = current_phase(signal)
    if phase in (LearningPhase.PHASE1, LearningPhase.PHASE2):
        return False

    if not signal.auto_stop_enabled:
        return False

    return rounds >= signal.typical_rounds


def should_suggest_stop(signal: SocraticStopSignal, rounds: int) -> bool:
    phase = current_phase(signal)
    if phase is not LearningPhase.PHASE2:
        return False
    return rounds >= signal.typical_rounds

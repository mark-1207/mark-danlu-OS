"""Socratic Learner：阶段 2-3 学习机制

v2 简化：启发式而非 ML
- 阶段 1（<30 样本）：不预测，用户决定
- 阶段 2（30-100 样本）：高 user_stop 比例 → 建议停
- 阶段 3（100+ 样本）：高 user_stop 比例 + rounds >= typical → 自动停
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from lu.config.loader import SocraticStopSignal
from lu.socratic.sample_store import SampleStore


PHASE1_THRESHOLD = 30
PHASE2_THRESHOLD = 100
SUGGEST_THRESHOLD = 0.5
AUTO_THRESHOLD = 0.7


class LearningPhase(str, Enum):
    PHASE1 = "phase1_user_decides"
    PHASE2 = "phase2_suggest"
    PHASE3 = "phase3_auto"


@dataclass(frozen=True)
class StopPrediction:
    action: str  # "suggest" / "auto"
    reason: str


class SocraticLearner:
    """Socratic 阶段判定 + 自动停止决策"""

    def __init__(self, sample_store: SampleStore) -> None:
        self.store = sample_store

    def phase(self) -> LearningPhase:
        n = self.store.count()
        if n < PHASE1_THRESHOLD:
            return LearningPhase.PHASE1
        if n < PHASE2_THRESHOLD:
            return LearningPhase.PHASE2
        return LearningPhase.PHASE3


def _user_stop_ratio(samples) -> float:
    """在某个 rounds 数处 user_says_stop 的比例"""
    if not samples:
        return 0.0
    stops = sum(1 for s in samples if s.user_says_stop)
    return stops / len(samples)


def predict_should_stop(
    sample_store: SampleStore,
    signal: SocraticStopSignal,
    current_rounds: int,
) -> StopPrediction | None:
    """根据当前样本和轮数预测是否应停

    返回 None = 阶段 1，让用户决定
    返回 StopPrediction = 阶段 2/3，给出建议/自动
    """
    learner = SocraticLearner(sample_store)
    phase = learner.phase()

    if phase is LearningPhase.PHASE1:
        return None

    # 阶段 2 / 3：基于历史样本
    samples = sample_store.read_all()
    # 仅用 current_rounds 附近的样本
    nearby = [s for s in samples if abs(s.rounds - current_rounds) <= 1]
    ratio = _user_stop_ratio(nearby)
    enough_rounds = current_rounds >= signal.typical_rounds

    if phase is LearningPhase.PHASE2:
        if ratio >= SUGGEST_THRESHOLD and enough_rounds:
            return StopPrediction(
                action="suggest",
                reason=f"历史 {int(ratio * 100)}% 样本在 {current_rounds} 轮停（阶段 2 建议）",
            )
        return None

    # PHASE3
    if ratio >= AUTO_THRESHOLD and enough_rounds:
        return StopPrediction(
            action="auto",
            reason=f"历史 {int(ratio * 100)}% 样本在 {current_rounds} 轮停（阶段 3 自动）",
        )
    return None


__all__ = ["LearningPhase", "SocraticLearner", "StopPrediction", "predict_should_stop"]

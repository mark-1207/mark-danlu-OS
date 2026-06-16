"""socratic/learning.py 测试 — 3 阶段学习机制

参考 D-008 + 99-LESSONS-LEARNED P14
- 阶段 1（0-30 样本）：靠用户说停
- 阶段 2（30-100 样本）：系统提示 + 用户决定
- 阶段 3（100+ 样本）：自动判断
"""
from __future__ import annotations

import pytest

from lu.config.loader import SocraticStopSignal
from lu.socratic.learning import (
    LearningPhase,
    StopDecision,
    current_phase,
    should_stop,
    should_suggest_stop,
)


class TestCurrentPhase:
    def test_phase1_under_30(self):
        assert current_phase(SocraticStopSignal(sample_count=0)) == LearningPhase.PHASE1
        assert current_phase(SocraticStopSignal(sample_count=15)) == LearningPhase.PHASE1
        assert current_phase(SocraticStopSignal(sample_count=29)) == LearningPhase.PHASE1

    def test_phase2_between_30_and_100(self):
        assert current_phase(SocraticStopSignal(sample_count=30)) == LearningPhase.PHASE2
        assert current_phase(SocraticStopSignal(sample_count=50)) == LearningPhase.PHASE2
        assert current_phase(SocraticStopSignal(sample_count=99)) == LearningPhase.PHASE2

    def test_phase3_above_100(self):
        assert current_phase(SocraticStopSignal(sample_count=100)) == LearningPhase.PHASE3
        assert current_phase(SocraticStopSignal(sample_count=200)) == LearningPhase.PHASE3


class TestShouldStop:
    def test_phase1_user_always_decides(self):
        signal = SocraticStopSignal(sample_count=10)
        assert should_stop(signal, rounds=2, user_says_stop=True) is True
        assert should_stop(signal, rounds=2, user_says_stop=False) is False
        assert should_stop(signal, rounds=10, user_says_stop=False) is False

    def test_phase2_user_says_stop(self):
        signal = SocraticStopSignal(sample_count=50)
        assert should_stop(signal, rounds=3, user_says_stop=True) is True
        assert should_stop(signal, rounds=3, user_says_stop=False) is False

    def test_phase3_auto_stop_when_saturated(self):
        signal = SocraticStopSignal(
            sample_count=150,
            typical_rounds=3.0,
            auto_stop_enabled=True,
        )
        assert should_stop(signal, rounds=3, user_says_stop=False) is True
        assert should_stop(signal, rounds=4, user_says_stop=False) is True

    def test_phase3_continue_below_threshold(self):
        signal = SocraticStopSignal(
            sample_count=150,
            typical_rounds=5.0,
            auto_stop_enabled=True,
        )
        assert should_stop(signal, rounds=2, user_says_stop=False) is False

    def test_phase3_disabled_falls_back_to_user(self):
        signal = SocraticStopSignal(
            sample_count=150,
            typical_rounds=3.0,
            auto_stop_enabled=False,
        )
        assert should_stop(signal, rounds=3, user_says_stop=False) is False
        assert should_stop(signal, rounds=3, user_says_stop=True) is True

    def test_user_stop_overrides_anything(self):
        signal = SocraticStopSignal(
            sample_count=200,
            typical_rounds=3.0,
            auto_stop_enabled=True,
        )
        assert should_stop(signal, rounds=1, user_says_stop=True) is True


class TestShouldSuggestStop:
    def test_phase1_no_suggestion(self):
        signal = SocraticStopSignal(sample_count=10, typical_rounds=3.0)
        assert should_suggest_stop(signal, rounds=3) is False

    def test_phase2_suggests_around_typical(self):
        signal = SocraticStopSignal(sample_count=50, typical_rounds=3.0)
        assert should_suggest_stop(signal, rounds=3) is True
        assert should_suggest_stop(signal, rounds=2) is False
        assert should_suggest_stop(signal, rounds=4) is True

    def test_phase3_does_not_suggest(self):
        signal = SocraticStopSignal(
            sample_count=150,
            typical_rounds=3.0,
            auto_stop_enabled=True,
        )
        assert should_suggest_stop(signal, rounds=3) is False


class TestStopDecision:
    def test_stop_decision_dataclass(self):
        d = StopDecision(action="stop", reason="user_says")
        assert d.action == "stop"
        assert d.reason == "user_says"

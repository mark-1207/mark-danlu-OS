"""socratic/engine.py 测试 — 苏格拉底追问主循环

参考 02-ARCHITECTURE 2.2 + D-004 + D-008
"""
from __future__ import annotations

import json

import pytest

from lu.config.loader import SocraticStopSignal
from lu.socratic.engine import SocraticEngine, SocraticResult
from lu.socratic.output import RefinedProposition


def _good_llm_response() -> str:
    return json.dumps(
        {
            "surface": "AI 对内容创作者的影响",
            "underlying": "算法经济逼着创作者写低质内容",
            "audience": "自媒体创作者",
            "style_recommendation": {
                "voice": "犀利一针见血",
                "tone": "批判性",
                "examples": ["参考 mark 的反共识文风"],
            },
            "contrarian_candidates": [
                {"point": "AI 不是问题，平台才是", "rationale": "反共识 1"},
            ],
            "framework_candidates": [
                {
                    "framework_id": "problem_decomposition",
                    "name": "问题解构",
                    "rationale": "拆解三角关系",
                },
            ],
            "risks": ["限流风险"],
            "falsifiability": "若 AI 让创作者收入翻倍则命题失效",
        },
        ensure_ascii=False,
    )


def _good_answers() -> dict[str, str]:
    return {
        "Q1": "我想讨论 AI 对自媒体创作者收入的影响",
        "Q2": "因为很多创作者被算法逼着写低质内容",
        "Q3": "给独立创作者 + 内容质量敏感的用户",
        "Q4": "犀利一针见血",
        "Q5": "我朋友小王，从月入 5 万掉到 8000",
        "Q6": "反过来说，AI 其实是创作者的最佳杠杆",
    }


class TestSocraticEngineBasic:
    def test_runs_through_all_6_questions(self):
        answers = _good_answers()
        asked: list[str] = []

        def ask_user(q: str) -> str:
            asked.append(q)
            for qid, ans in answers.items():
                if qid in q:
                    return ans
            return ""

        def ask_yes_no(prompt: str) -> bool:
            return False

        def llm_call(prompt: str) -> str:
            return _good_llm_response()

        engine = SocraticEngine(
            proposition="AI 时代内容创作者",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=llm_call,
        )
        result = engine.run()

        assert isinstance(result, SocraticResult)
        assert result.refined_proposition.surface == "AI 对内容创作者的影响"
        assert len(result.history) == 6

    def test_returns_refined_proposition(self):
        answers = _good_answers()

        engine = SocraticEngine(
            proposition="X",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=lambda q: next(iter(answers.values())),
            ask_yes_no=lambda p: False,
            llm_call=lambda p: _good_llm_response(),
        )
        result = engine.run()
        assert isinstance(result.refined_proposition, RefinedProposition)


class TestSocraticEngineEarlyStop:
    def test_user_says_stop_terminates_early(self):
        counter = {"n": 0}

        def ask_user(q: str) -> str:
            counter["n"] += 1
            return "够了"

        def ask_yes_no(prompt: str) -> bool:
            return True  # 用户确认"够了"

        def llm_call(prompt: str) -> str:
            return _good_llm_response()

        engine = SocraticEngine(
            proposition="X",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=llm_call,
        )
        result = engine.run()

        assert counter["n"] <= 3
        assert isinstance(result.refined_proposition, RefinedProposition)
        assert result.early_stopped is True

    def test_phase3_auto_stop(self):
        counter = {"n": 0}

        def ask_user(q: str) -> str:
            counter["n"] += 1
            return "明确且具体的回答，应该不需要追问"

        def ask_yes_no(prompt: str) -> bool:
            return False

        def llm_call(prompt: str) -> str:
            return _good_llm_response()

        signal = SocraticStopSignal(
            sample_count=200,
            typical_rounds=3.0,
            auto_stop_enabled=True,
        )
        engine = SocraticEngine(
            proposition="X",
            signal=signal,
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=llm_call,
        )
        result = engine.run()

        assert counter["n"] <= 3
        assert result.early_stopped is True


class TestSocraticEngineFollowup:
    def test_vague_answer_triggers_followup(self):
        counter = {"n": 0}

        def ask_user(q: str) -> str:
            counter["n"] += 1
            if counter["n"] == 1:
                return "嗯"  # Q1 含糊 → 触发追问
            return "我想讨论 AI 对自媒体创作者收入的影响"  # 追问后回答

        def ask_yes_no(prompt: str) -> bool:
            return True  # 同意追问

        engine = SocraticEngine(
            proposition="X",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=lambda p: _good_llm_response(),
        )
        result = engine.run()

        assert counter["n"] >= 7  # 6 问 + 至少 1 个追问
        followup_qs = [q for q, _ in result.history if "更具体" in q]
        assert len(followup_qs) >= 1

    def test_skip_followup_option(self):
        counter = {"n": 0}

        def ask_user(q: str) -> str:
            counter["n"] += 1
            return "明确回答"

        def ask_yes_no(prompt: str) -> bool:
            return False  # 拒绝追问

        engine = SocraticEngine(
            proposition="X",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=lambda p: _good_llm_response(),
        )
        result = engine.run()
        assert counter["n"] == 6


class TestSocraticResult:
    def test_result_has_history(self):
        engine = SocraticEngine(
            proposition="X",
            signal=SocraticStopSignal(sample_count=10),
            ask_user=lambda q: "明确回答",
            ask_yes_no=lambda p: False,
            llm_call=lambda p: _good_llm_response(),
        )
        result = engine.run()

        assert hasattr(result, "history")
        assert hasattr(result, "refined_proposition")
        assert hasattr(result, "early_stopped")
        assert hasattr(result, "rounds_completed")
        assert result.rounds_completed == 6

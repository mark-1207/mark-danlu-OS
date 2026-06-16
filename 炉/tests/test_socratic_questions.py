"""socratic/questions.py 测试

6 个固定问题（Q1-Q6）+ 动态追问触发器
参考 02-ARCHITECTURE 2.2 + D-004
"""
from __future__ import annotations

import pytest

from lu.socratic.questions import (
    QUESTION_TEMPLATES,
    Question,
    TriggerRule,
    next_question,
    should_followup,
)


class TestQuestionTemplates:
    def test_has_6_questions(self):
        assert len(QUESTION_TEMPLATES) == 6

    def test_questions_are_sequential(self):
        ids = [q.id for q in QUESTION_TEMPLATES]
        assert ids == ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]

    def test_themes_match_spec(self):
        expected_themes = [
            "命题浅层",
            "底层逻辑",
            "潜在诉求",
            "风格倾向",
            "具体案例",
            "反共识候选",
        ]
        actual = [q.theme for q in QUESTION_TEMPLATES]
        assert actual == expected_themes

    def test_each_question_has_prompt(self):
        for q in QUESTION_TEMPLATES:
            assert q.prompt
            assert len(q.prompt) > 5

    def test_each_question_has_triggers(self):
        for q in QUESTION_TEMPLATES:
            assert isinstance(q.dynamic_triggers, list)
            assert len(q.dynamic_triggers) >= 1


class TestShouldFollowup:
    def test_clear_answer_no_followup(self):
        q = QUESTION_TEMPLATES[0]
        rule = q.dynamic_triggers[0]
        clear_answer = "我想讨论的是 X 命题的 Y 方面"
        assert not should_followup(clear_answer, rule)

    def test_vague_answer_triggers_followup(self):
        q1 = QUESTION_TEMPLATES[0]
        trigger = next(t for t in q1.dynamic_triggers if "具体" in t.followup)
        assert should_followup("嗯", trigger)
        assert should_followup("没想好", trigger)

    def test_rule_can_be_skipped(self):
        rule = TriggerRule(
            id="test",
            condition="placeholder",
            followup="placeholder",
            skippable=True,
        )
        assert rule.skippable is True


class TestNextQuestion:
    def test_first_question(self):
        q = next_question(0)
        assert q is not None
        assert q.id == "Q1"

    def test_sequential(self):
        assert next_question(1).id == "Q2"  # type: ignore[union-attr]
        assert next_question(3).id == "Q4"  # type: ignore[union-attr]
        assert next_question(5).id == "Q6"  # type: ignore[union-attr]

    def test_past_last_returns_none(self):
        assert next_question(6) is None
        assert next_question(10) is None

    def test_negative_returns_none(self):
        assert next_question(-1) is None

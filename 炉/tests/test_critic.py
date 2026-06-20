"""Critic 测试：刺客/裂缝/分身"""
from __future__ import annotations

import json

import pytest

from lu.critic import (
    CritiqueIssue,
    assassin_prompt,
    crack_prompt,
    parse_critique_response,
    run_all_critics,
    run_assassin,
    run_crack,
    run_twin,
    twin_prompt,
)


class TestPrompts:
    def test_assassin_prompt(self) -> None:
        p = assassin_prompt("title", "content")
        assert "反对" in p
        assert "title" in p
        assert "content" in p

    def test_crack_prompt(self) -> None:
        p = crack_prompt("title", "content")
        assert "逻辑漏洞" in p
        assert "title" in p

    def test_twin_prompt(self) -> None:
        p = twin_prompt("title", "content", "audience")
        assert "目标读者" in p
        assert "audience" in p


class TestParse:
    def test_parse_array(self) -> None:
        raw = json.dumps([
            {"type": "assassin", "target_section": "thinking", "issue": "x", "suggestion": "y"}
        ])
        result = parse_critique_response(raw, "assassin")
        assert len(result) == 1
        assert result[0].type == "assassin"
        assert result[0].target_section == "thinking"
        assert result[0].issue == "x"

    def test_parse_dict_with_issues(self) -> None:
        raw = json.dumps({
            "issues": [
                {"type": "crack", "target_section": "case", "issue": "漏洞"}
            ]
        })
        result = parse_critique_response(raw, "crack")
        assert len(result) == 1
        assert result[0].type == "crack"

    def test_parse_code_fence(self) -> None:
        raw = "```json\n" + json.dumps([
            {"type": "twin", "target_section": "hook", "issue": "假"}
        ]) + "\n```"
        result = parse_critique_response(raw, "twin")
        assert len(result) == 1
        assert result[0].target_section == "hook"

    def test_parse_invalid_json_returns_empty(self) -> None:
        result = parse_critique_response("not json", "assassin")
        assert result == []

    def test_parse_missing_fields_uses_defaults(self) -> None:
        raw = json.dumps([{"issue": "only issue"}])
        result = parse_critique_response(raw, "crack")
        assert result[0].type == "crack"  # critic_type 参数
        assert result[0].target_section == "thinking"  # 默认
        assert result[0].issue == "only issue"


class TestRunCritics:
    def test_run_assassin(self) -> None:
        def llm(prompt: str) -> str:
            assert "反对" in prompt
            return json.dumps([
                {"type": "assassin", "target_section": "thinking", "issue": "反驳点", "suggestion": "加证据"}
            ])
        issues = run_assassin("t", "c", llm)
        assert len(issues) == 1
        assert issues[0].type == "assassin"

    def test_run_crack(self) -> None:
        def llm(prompt: str) -> str:
            assert "逻辑漏洞" in prompt
            return json.dumps([
                {"type": "crack", "target_section": "case", "issue": "数据无来源", "suggestion": "加数据"}
            ])
        issues = run_crack("t", "c", llm)
        assert issues[0].issue == "数据无来源"

    def test_run_twin(self) -> None:
        def llm(prompt: str) -> str:
            assert "audience-X" in prompt
            return json.dumps([
                {"type": "twin", "target_section": "hook", "issue": "太装", "suggestion": "更朴实"}
            ])
        issues = run_twin("t", "c", "audience-X", llm)
        assert issues[0].issue == "太装"

    def test_run_all_critics_calls_llm_3_times(self) -> None:
        calls: list[str] = []

        def llm(prompt: str) -> str:
            calls.append(prompt)
            return json.dumps([{"type": "x", "target_section": "y", "issue": "i"}])

        issues = run_all_critics("t", "c", "aud", llm)
        assert len(calls) == 3  # assassin + crack + twin
        assert len(issues) == 3

    def test_run_all_critics_mixed_responses(self) -> None:
        """3 个 critic 可能返回 0-N 条 issue，混合后总数正确"""
        def llm(prompt: str) -> str:
            if "反对" in prompt:
                return json.dumps([{"type": "a", "target_section": "t", "issue": "i1"}])  # 1 条
            if "逻辑漏洞" in prompt:
                return "not json"  # 0 条
            return json.dumps([{"type": "t", "target_section": "t", "issue": "i2"},
                               {"type": "t", "target_section": "c", "issue": "i3"}])  # 2 条
        issues = run_all_critics("t", "c", "aud", llm)
        assert len(issues) == 3

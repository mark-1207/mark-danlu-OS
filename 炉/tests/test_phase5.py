"""Phase 5 测试：Prism + Gap + InteractiveTUIDecision"""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Section,
    SectionRole,
)
from lu.cli.interactive_decision import InteractiveTUIDecision, _is_tty
from lu.gap.analyzer import Gap, analyze_gaps, build_gap_prompt, parse_gap_response
from lu.pipeline.tui_decision import AutoTUIDecision
from lu.socratic.output import ContrarianPoint, RefinedProposition, StyleRecommendation
from lu.title.prism import (
    DIMENSIONS,
    PrismResult,
    TitleCandidate,
    generate_prism_titles,
    parse_prism_response,
)


def _refined(
    *,
    surface: str = "AI 杠杆者反思",
    underlying: str = "用 AI 把时间杠杆化",
    audience: str = "内容创作者",
    contrarian: list[ContrarianPoint] | None = None,
    falsifiability: str = "若 AI 工具让创作者收入翻倍，则命题失效",
) -> RefinedProposition:
    return RefinedProposition.model_construct(
        surface=surface,
        underlying=underlying,
        audience=audience,
        style_recommendation=StyleRecommendation.model_construct(
            voice="mark", tone="casual", examples=[]
        ),
        contrarian_candidates=contrarian or [],
        framework_candidates=[],
        risks=[],
        falsifiability=falsifiability,
    )


def _blueprint(*, with_contrarian_falsifiability: bool = True) -> Blueprint:
    return Blueprint.model_construct(
        proposition="X",
        stance="立场",
        framework="problem_decomposition",
        framework_output={},
        audience="内容创作者",
        core_anti_consensus="反共识",
        cases=[],
        data=[],
        quotes=[],
        forbidden=[],
        sections=[
            Section.model_construct(
                role=SectionRole.HOOK,
                must_have=[], word_limit=120,
                style_hint="h", thinking_model_hint=None,
                content=None, self_confidence=None,
            ),
            Section.model_construct(
                role=SectionRole.ANTI_CONSENSUS,
                must_have=[], word_limit=300,
                style_hint="a", thinking_model_hint=None,
                content=None, self_confidence=None,
            ),
            Section.model_construct(
                role=SectionRole.CASE,
                must_have=[], word_limit=400,
                style_hint="c", thinking_model_hint=None,
                content=None, self_confidence=None,
            ),
            Section.model_construct(
                role=SectionRole.THINKING,
                must_have=[], word_limit=500,
                style_hint="t", thinking_model_hint=None,
                content=None, self_confidence=None,
            ),
            Section.model_construct(
                role=SectionRole.CLOSING,
                must_have=[], word_limit=150,
                style_hint="k", thinking_model_hint=None,
                content=None, self_confidence=None,
            ),
        ],
        anti_ai_anchors=AntiAIAnchors.model_construct(forbidden_list=[]),
    )


# ========== Prism tests ==========


class TestPrismParse:
    def test_parse_json_with_titles(self) -> None:
        raw = json.dumps({
            "titles": [
                {"dim": "view", "text": "观点 1"},
                {"dim": "view", "text": "观点 2"},
                {"dim": "data", "text": "数据 1"},
                {"dim": "contrarian", "text": "反共识 1"},
            ]
        })
        result = parse_prism_response(raw, n_per_dim=3)
        assert len(result.candidates) == 4
        assert result.candidates[0].dimension == "view"
        assert result.candidates[0].text == "观点 1"

    def test_parse_code_fence(self) -> None:
        raw = "```json\n" + json.dumps({
            "titles": [{"dim": "view", "text": "t"}]
        }) + "\n```"
        result = parse_prism_response(raw)
        assert result.candidates[0].text == "t"

    def test_parse_invalid_json_falls_back(self) -> None:
        result = parse_prism_response("not json at all")
        # 解析失败时回退到占位（用原文前 60 字符）
        assert len(result.candidates) == 1
        assert "not json" in result.candidates[0].text

    def test_parse_empty_returns_empty(self) -> None:
        result = parse_prism_response(json.dumps({"titles": []}))
        # 空时回退到占位
        assert len(result.candidates) == 1

    def test_by_dimension(self) -> None:
        result = PrismResult(candidates=[
            TitleCandidate("view", "v1"),
            TitleCandidate("view", "v2"),
            TitleCandidate("data", "d1"),
        ])
        assert len(result.by_dimension("view")) == 2
        assert len(result.by_dimension("data")) == 1


class TestPrismGenerate:
    def test_calls_llm_and_parses(self) -> None:
        captured: list[str] = []

        def llm(prompt: str) -> str:
            captured.append(prompt)
            return json.dumps({
                "titles": [
                    {"dim": "view", "text": "t1"},
                    {"dim": "data", "text": "t2"},
                    {"dim": "case", "text": "t3"},
                    {"dim": "contrarian", "text": "t4"},
                ]
            }, ensure_ascii=False)

        result = generate_prism_titles("test prop", llm, n_per_dim=1)
        assert len(result.candidates) == 4
        assert all(isinstance(c, TitleCandidate) for c in result.candidates)
        assert "test prop" in captured[0]
        assert "4 维" in captured[0]

    def test_dimensions_defined(self) -> None:
        assert set(DIMENSIONS) == {"view", "data", "case", "contrarian"}


# ========== Gap tests ==========


class TestGapHeuristic:
    def test_missing_contrarian(self) -> None:
        refined = _refined(contrarian=[])  # 空反共识
        bp = _blueprint()
        gaps = analyze_gaps(refined, bp, llm_call=None)
        # heuristic 至少发现 1 条 thinking 缺口
        assert any("反共识" in g.missing for g in gaps)

    def test_missing_falsifiability(self) -> None:
        refined = _refined(falsifiability="")
        bp = _blueprint()
        gaps = analyze_gaps(refined, bp, llm_call=None)
        assert any("可证伪" in g.missing for g in gaps)

    def test_no_llm_returns_only_heuristic(self) -> None:
        refined = _refined(contrarian=[])
        bp = _blueprint()
        gaps = analyze_gaps(refined, bp, llm_call=None)
        # 全部来自启发式（无 LLM 调用）
        assert all(isinstance(g, Gap) for g in gaps)


class TestGapLLM:
    def test_llm_extends_heuristic(self) -> None:
        refined = _refined(contrarian=[])
        bp = _blueprint()

        def llm(prompt: str) -> str:
            return json.dumps({
                "gaps": [
                    {"section": "data", "missing": "数据点", "suggestion": "搜索 AI 工资数据"},
                ]
            })

        gaps = analyze_gaps(refined, bp, llm_call=llm)
        # 启发式 + LLM 合并
        kinds = {g.section for g in gaps}
        assert "data" in kinds
        assert "thinking" in kinds  # 启发式

    def test_llm_invalid_json_falls_back(self) -> None:
        refined = _refined(contrarian=[])
        bp = _blueprint()

        def llm(prompt: str) -> str:
            return "not json"

        gaps = analyze_gaps(refined, bp, llm_call=llm)
        # LLM 失败，回退到启发式
        assert len(gaps) > 0

    def test_parse_gap_response_basic(self) -> None:
        raw = json.dumps({
            "gaps": [
                {"section": "case", "missing": "m", "suggestion": "s"},
            ]
        })
        result = parse_gap_response(raw)
        assert len(result) == 1
        assert result[0].section == "case"


# ========== InteractiveTUIDecision tests ==========


class TestInteractiveTUIDecision:
    def test_fallback_when_not_tty(self) -> None:
        """非 TTY 环境回退到 AutoTUIDecision 行为"""
        with patch("lu.cli.interactive_decision._is_tty", return_value=False):
            decision = InteractiveTUIDecision()
            # 任何 decide 方法应返回 accepted=True（auto fallback 行为）
            assert decision.decide_step3_title(["A", "B", "C"]).accepted is True
            assert decision.decide_step7_polish({"overall_passed": True}).accepted is True

    def test_init_with_auto_fallback_false_raises(self) -> None:
        with patch("lu.cli.interactive_decision._is_tty", return_value=False):
            with pytest.raises(RuntimeError):
                InteractiveTUIDecision(auto_fallback=False)

    def test_step3_returns_selected_title(self) -> None:
        """在 TTY 环境下模拟选 2 号"""
        with patch("lu.cli.interactive_decision._is_tty", return_value=True):
            with patch("lu.cli.interactive_decision._can_use_rich", return_value=True):
                with patch("rich.prompt.Prompt.ask", return_value="2"):
                    decision = InteractiveTUIDecision()
                    result = decision.decide_step3_title(["t1", "t2", "t3"])
                    assert result.modified_value == "t2"

    def test_step3_custom_title(self) -> None:
        with patch("lu.cli.interactive_decision._is_tty", return_value=True):
            with patch("lu.cli.interactive_decision._can_use_rich", return_value=True):
                with patch("rich.prompt.Prompt.ask", return_value="我的自定义标题"):
                    decision = InteractiveTUIDecision()
                    result = decision.decide_step3_title(["t1", "t2"])
                    assert result.modified_value == "我的自定义标题"

    def test_step3_out_of_range(self) -> None:
        """选 5 但只有 3 个候选 → 当作自定义标题"""
        with patch("lu.cli.interactive_decision._is_tty", return_value=True):
            with patch("lu.cli.interactive_decision._can_use_rich", return_value=True):
                with patch("rich.prompt.Prompt.ask", return_value="5"):
                    decision = InteractiveTUIDecision()
                    result = decision.decide_step3_title(["t1", "t2", "t3"])
                    # "5" 不是数字 + 越界 → 当作自定义
                    assert result.modified_value == "5"

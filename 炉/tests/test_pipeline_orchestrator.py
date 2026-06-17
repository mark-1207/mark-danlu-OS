"""Pipeline Orchestrator 端到端测试

参考 docs/02-ARCHITECTURE.md 第 2 节 + docs/04-DATA-MODEL.md 2.2 Context
- 端到端 mock LLM 跑通 7 步
- 验证 Context 聚合所有步骤产出
- 验证状态机推进
"""
from __future__ import annotations

import json
from typing import Callable

import pytest

from lu.blueprint.models import Blueprint
from lu.config.loader import StyleProfile
from lu.draft.models import Draft
from lu.pipeline.models import Context
from lu.pipeline.orchestrator import Orchestrator
from lu.polish.models import QualityReport
from lu.sediment.models import Harvested
from lu.socratic.engine import SocraticResult
from lu.socratic.output import RefinedProposition
from lu.state.machine import RunState
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


# ---------- 辅助：构造 mock LLM + socratic 回调 ----------


def _make_refined_dict() -> dict:
    return {
        "surface": "AI 牛马陷阱",
        "underlying": "用 AI 但没拿到红利",
        "audience": "互联网运营/产品",
        "style_recommendation": {
            "voice": "犀利直接",
            "tone": "锋利",
            "examples": [],
        },
        "contrarian_candidates": [
            {"point": "AI 不会让你变贵，只会让你的工作变便宜", "rationale": "反常识"},
        ],
        "framework_candidates": [
            {"framework_id": "problem_decomposition", "name": "问题解构", "rationale": "主"},
        ],
        "risks": ["过度乐观"],
        "falsifiability": "如果 AI 提效但工资涨则证伪",
    }


def _make_blueprint_dict() -> dict:
    return {
        "proposition": "AI 牛马陷阱",
        "stance": "用 AI 不等于赚更多",
        "audience": "互联网运营/产品",
        "core_anti_consensus": "用 AI 不会让你更值钱",
        "cases": [
            {"title": "朋友A", "summary": "运营 2 年高强度用 LLM 工资未涨"},
        ],
        "data": [
            {"statement": "30% 工作可被自动化", "source": "McKinsey 2025"},
        ],
        "quotes": [
            {"text": "AI 是杠杆，不是工资", "author": "Sam Altman"},
        ],
        "forbidden": ["赋能", "在这个时代"],
    }


def _make_section_json(content: str) -> str:
    return json.dumps({"content": content, "self_confidence": 0.9}, ensure_ascii=False)


def _make_score_json(score: float = 8.0) -> str:
    return json.dumps({"score": score, "details": {"rationale": "ok"}, "suggestions": []})


def _make_suggestion_json(text: str = "修复建议") -> str:
    return json.dumps({"suggestion": text}, ensure_ascii=False)


def _make_harvest_json() -> str:
    return json.dumps(
        {
            "cases": [{"title": "朋友A", "summary": "..."}],
            "quotes": [{"text": "AI 是杠杆", "author": "Sam"}],
            "insights": [{"text": "杠杆不增工资", "source": "草稿", "tags": []}],
            "contrarian_points": [
                {"point": "杠杆者思维", "rationale": "反共识"},
            ],
        },
        ensure_ascii=False,
    )


def _make_mock_llm() -> Callable[[str], str]:
    """mock LLM：根据 prompt 类型返回对应的 JSON

    简化策略：用 prompt 中的关键词识别阶段。
    """
    refined_json = json.dumps(_make_refined_dict(), ensure_ascii=False)
    blueprint_json = json.dumps(_make_blueprint_dict(), ensure_ascii=False)

    counter = {"n": 0}

    def llm(prompt: str) -> str:
        counter["n"] += 1
        # Step 2: 苏格拉底产出（8 项 JSON）
        if "8 项 JSON" in prompt or "RefinedProposition" in prompt:
            return refined_json
        # Step 3 框架策略输出（思想模型 prompt 有【思想模型】）
        if "【思想模型" in prompt:
            return f"模型输出 {counter['n']}"
        # Step 3 蓝图设计（蓝图字段 JSON）
        if "蓝图字段 JSON" in prompt:
            return blueprint_json
        # Step 5 段位生成（content + self_confidence）
        if '"content"' in prompt and "self_confidence" in prompt:
            return _make_section_json(f"段位内容 {counter['n']}")
        # Step 6 维度评分（score + details + suggestions）
        if "score" in prompt and "details" in prompt:
            return _make_score_json(8.0)
        # Step 6 修复建议（suggestion）
        if "修复建议" in prompt:
            return _make_suggestion_json()
        # Step 7 沉淀提取
        if "内容资产提取器" in prompt or "cases" in prompt and "quotes" in prompt:
            return _make_harvest_json()
        # 兜底：返回 refined_json
        return refined_json

    return llm


def _make_ask_user() -> Callable[[str], str]:
    """mock 用户输入：循环 6 个非停词答案"""
    answers = [
        "我想讨论 AI 在工作中的实际影响",
        "因为很多人学了 AI 但没赚到钱",
        "互联网运营和产品经理",
        "犀利直接",
        "我朋友 A 是运营 2 年高强度用 LLM 但工资没涨",
        "反过来说，大多数人以为 AI 能涨工资，但实际上它把工作变得便宜",
    ]
    counter = {"i": 0}

    def ask(prompt: str) -> str:
        a = answers[counter["i"] % len(answers)]
        counter["i"] += 1
        return a

    return ask


def _make_ask_yes_no() -> Callable[[str], bool]:
    """mock 用户 yes/no：永远 yes（不触发早停）"""
    def ask(prompt: str) -> bool:
        return True
    return ask


@pytest.fixture
def registries() -> tuple[ThinkingModelRegistry, FrameworkRegistry]:
    return (
        ThinkingModelRegistry(models=[]),
        FrameworkRegistry(frameworks=[]),
    )


@pytest.fixture
def style() -> StyleProfile:
    return StyleProfile(voice="犀利直接")


# ---------- TDD red → green 测试 ----------


class TestOrchestratorEndToEnd:
    def test_runs_all_seven_steps_and_returns_context(
        self,
        registries: tuple[ThinkingModelRegistry, FrameworkRegistry],
        style: StyleProfile,
    ) -> None:
        models, frameworks = registries
        # 给 frameworks 一个 problem_decomposition 框架，否则 selector 抛 KeyError
        from lu.config.loader import Framework
        frameworks = FrameworkRegistry(
            frameworks=[
                Framework(
                    id="problem_decomposition",
                    name="问题解构",
                    strategy="chain",
                    model_ids=["first_principles"],
                    trigger_keywords=[],
                ),
            ]
        )
        # 给 models 一个 first_principles 模型
        from lu.config.loader import ThinkingModel
        models = ThinkingModelRegistry(
            models=[
                ThinkingModel(
                    id="first_principles",
                    name="第一性原理",
                    definition="回归基本事实",
                    use_when="复杂问题",
                ),
            ]
        )

        orch = Orchestrator(
            style_profile=style,
            model_registry=models,
            framework_registry=frameworks,
        )
        ctx = orch.run(
            proposition="AI 牛马陷阱",
            llm_call=_make_mock_llm(),
            ask_user=_make_ask_user(),
            ask_yes_no=_make_ask_yes_no(),
        )

        assert isinstance(ctx, Context)
        assert ctx.proposition_cleaned == "AI 牛马陷阱"
        assert isinstance(ctx.refined_proposition, RefinedProposition)
        assert isinstance(ctx.blueprint, Blueprint)
        assert isinstance(ctx.draft, Draft)
        assert isinstance(ctx.quality_report, QualityReport)
        assert isinstance(ctx.harvested, Harvested)
        assert ctx.state == RunState.COMPLETED

    def test_context_persists_all_step_outputs(
        self,
        style: StyleProfile,
    ) -> None:
        from lu.config.loader import Framework, ThinkingModel
        models = ThinkingModelRegistry(
            models=[
                ThinkingModel(id="first_principles", name="第一性原理", definition="d"),
            ]
        )
        frameworks = FrameworkRegistry(
            frameworks=[
                Framework(
                    id="problem_decomposition",
                    name="问题解构",
                    strategy="chain",
                    model_ids=["first_principles"],
                    trigger_keywords=[],
                ),
            ]
        )

        orch = Orchestrator(
            style_profile=style,
            model_registry=models,
            framework_registry=frameworks,
        )
        ctx = orch.run(
            proposition="AI 牛马陷阱",
            llm_call=_make_mock_llm(),
            ask_user=_make_ask_user(),
            ask_yes_no=_make_ask_yes_no(),
        )

        # Step 1: proposition_cleaned
        assert ctx.proposition_cleaned
        # Step 2: refined_proposition
        assert ctx.refined_proposition.surface
        # Step 3: blueprint
        assert ctx.blueprint.proposition
        assert ctx.blueprint.sections, "Blueprint 应有 sections"
        # Step 4: selected_sections（与 blueprint.sections 同源）
        assert ctx.selected_sections
        # Step 5: draft
        assert ctx.draft.title
        assert len(ctx.draft.sections) >= 1
        # Step 6: quality_report
        assert ctx.quality_report.temperature.name == "温度"
        # Step 7: harvested
        assert ctx.style_profile_snapshot is not None


class TestOrchestratorFailureHandling:
    def test_section_choice_can_be_empty(
        self,
        style: StyleProfile,
    ) -> None:
        """section_choice=None 时默认用核心 5 段"""
        from lu.config.loader import Framework, ThinkingModel
        models = ThinkingModelRegistry(
            models=[
                ThinkingModel(id="first_principles", name="第一性原理", definition="d"),
            ]
        )
        frameworks = FrameworkRegistry(
            frameworks=[
                Framework(
                    id="problem_decomposition",
                    name="问题解构",
                    strategy="chain",
                    model_ids=["first_principles"],
                    trigger_keywords=[],
                ),
            ]
        )

        orch = Orchestrator(
            style_profile=style,
            model_registry=models,
            framework_registry=frameworks,
        )
        ctx = orch.run(
            proposition="AI 牛马陷阱",
            llm_call=_make_mock_llm(),
            ask_user=_make_ask_user(),
            ask_yes_no=_make_ask_yes_no(),
        )
        # 核心 5 段
        assert len(ctx.selected_sections) == 5

    def test_llm_call_invoked_for_every_step(
        self,
        style: StyleProfile,
    ) -> None:
        from lu.config.loader import Framework, ThinkingModel
        models = ThinkingModelRegistry(
            models=[
                ThinkingModel(id="first_principles", name="第一性原理", definition="d"),
            ]
        )
        frameworks = FrameworkRegistry(
            frameworks=[
                Framework(
                    id="problem_decomposition",
                    name="问题解构",
                    strategy="chain",
                    model_ids=["first_principles"],
                    trigger_keywords=[],
                ),
            ]
        )

        call_count = {"n": 0}

        def counting_llm(prompt: str) -> str:
            call_count["n"] += 1
            return _make_mock_llm()(prompt)

        orch = Orchestrator(
            style_profile=style,
            model_registry=models,
            framework_registry=frameworks,
        )
        orch.run(
            proposition="AI 牛马陷阱",
            llm_call=counting_llm,
            ask_user=_make_ask_user(),
            ask_yes_no=_make_ask_yes_no(),
        )

        # 苏格拉底(1) + 思想模型(1) + 蓝图(1) + 段位*N + 评分(9) + 沉淀(1)
        # 段位=5 段，所以总 LLM 调用应远大于 5
        assert call_count["n"] >= 5 + 1 + 1 + 1 + 9

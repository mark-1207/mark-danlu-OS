"""Orchestrator 续跑测试

- 模拟已完成 Step 3，续跑从 Step 4 开始
- 续跑后 context.json 反映最终状态
- --from-step 小于已保存 state 时报错
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lu.config.loader import Framework, StyleProfile, ThinkingModel
from lu.pipeline.models import Context
from lu.pipeline.orchestrator import Orchestrator
from lu.state.machine import RunState
from lu.store.file_store import FileStore
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


def _make_registries() -> tuple[ThinkingModelRegistry, FrameworkRegistry]:
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
    return models, frameworks


def _echo_llm(prompt: str) -> str:
    if "蓝图字段 JSON" in prompt:
        return json.dumps(
            {
                "proposition": "p",
                "stance": "s",
                "audience": "a",
                "core_anti_consensus": "c",
                "cases": [],
                "data": [],
                "quotes": [],
                "forbidden": [],
            },
            ensure_ascii=False,
        )
    if '"content"' in prompt and "self_confidence" in prompt:
        return json.dumps({"content": "占位", "self_confidence": 0.5})
    if "score" in prompt and "details" in prompt:
        return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
    if "修复建议" in prompt:
        return json.dumps({"suggestion": "建议"})
    if "内容资产提取器" in prompt:
        return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
    return json.dumps(
        {
            "surface": "s",
            "underlying": "u",
            "audience": "a",
            "style_recommendation": {"voice": "v", "tone": "t", "examples": []},
            "contrarian_candidates": [],
            "framework_candidates": [],
            "risks": [],
            "falsifiability": "",
        },
        ensure_ascii=False,
    )


def _echo_user() -> "callable":
    answers = ["a1", "a2", "a3", "a4", "a5", "a6"]
    i = {"n": 0}

    def ask(prompt: str) -> str:
        a = answers[i["n"] % len(answers)]
        i["n"] += 1
        return a

    return ask


def _echo_yes_no() -> "callable":
    def ask(prompt: str) -> bool:
        return True
    return ask


def _build_ctx_to(state: RunState, file_store: FileStore) -> Context:
    """跑一次完整 run，把 state 强制改到目标（用于模拟中间状态）"""
    models, frameworks = _make_registries()
    orch = Orchestrator(
        style_profile=StyleProfile(),
        model_registry=models,
        framework_registry=frameworks,
    )
    ctx = orch.run(
        proposition="AI 牛马陷阱",
        llm_call=_echo_llm,
        ask_user=_echo_user(),
        ask_yes_no=_echo_yes_no(),
        file_store=file_store,
    )
    # 强制改到中间状态，模拟"只完成到某步"
    ctx.state = state
    file_store.save(ctx.run_id, "context", ctx)
    return ctx


class TestOrchestratorResume:
    def test_resume_from_step_4_uses_existing_context(
        self, tmp_path: Path
    ) -> None:
        store = FileStore(tmp_path)
        original = _build_ctx_to(RunState.STEP3_DONE, store)
        run_id = original.run_id

        models, frameworks = _make_registries()
        orch = Orchestrator(
            style_profile=StyleProfile(),
            model_registry=models,
            framework_registry=frameworks,
        )

        ctx = orch.run(
            proposition="AI 牛马陷阱",
            llm_call=_echo_llm,
            ask_user=_echo_user(),
            ask_yes_no=_echo_yes_no(),
            file_store=store,
            resume_run_id=run_id,
            from_step=RunState.STEP4_DONE,
        )

        # 续跑应复用原 run_id
        assert ctx.run_id == run_id
        # 最终完成
        assert ctx.state == RunState.COMPLETED
        # blueprint 来自原 ctx（不应被重跑覆盖）
        assert ctx.blueprint is not None
        assert ctx.blueprint.sections

    def test_resume_without_runs_dir_raises(self) -> None:
        """无 file_store 时 resume 应报错"""
        models, frameworks = _make_registries()
        orch = Orchestrator(
            style_profile=StyleProfile(),
            model_registry=models,
            framework_registry=frameworks,
        )

        with pytest.raises(ValueError):
            orch.run(
                proposition="AI 牛马陷阱",
                llm_call=_echo_llm,
                ask_user=_echo_user(),
                ask_yes_no=_echo_yes_no(),
                file_store=None,
                resume_run_id="2026-01-01_test",
                from_step=RunState.STEP4_DONE,
            )

    def test_resume_from_step_before_saved_raises(self, tmp_path: Path) -> None:
        """from_step 小于已保存 state 时报错"""
        store = FileStore(tmp_path)
        _build_ctx_to(RunState.STEP5_DONE, store)
        # 找一个存在的 run_id
        runs = list(tmp_path.iterdir())
        assert runs
        run_id = runs[0].name

        models, frameworks = _make_registries()
        orch = Orchestrator(
            style_profile=StyleProfile(),
            model_registry=models,
            framework_registry=frameworks,
        )

        with pytest.raises(ValueError):
            orch.run(
                proposition="AI 牛马陷阱",
                llm_call=_echo_llm,
                ask_user=_echo_user(),
                ask_yes_no=_echo_yes_no(),
                file_store=store,
                resume_run_id=run_id,
                from_step=RunState.STEP2_DONE,
            )

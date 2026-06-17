"""Orchestrator 持久化测试

- 传入 FileStore 后每步生成 context.json
- run_id 生成规则
- 不传 FileStore 时行为与 v1.0 一致
"""
from __future__ import annotations

import json
from pathlib import Path

from lu.config.loader import Framework, StyleProfile, ThinkingModel
from lu.pipeline.models import Context
from lu.pipeline.orchestrator import Orchestrator
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
    # 苏格拉底 / 思想模型 / 兜底
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


class TestOrchestratorPersistence:
    def test_creates_run_directory_and_context_file(self, tmp_path: Path) -> None:
        store = FileStore(tmp_path)
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
        )

        assert ctx.run_id
        run_dir = tmp_path / ctx.run_id
        context_file = run_dir / "context.json"
        assert context_file.is_file()

        # 可反序列化
        loaded = Context.model_validate_json(context_file.read_text(encoding="utf-8"))
        assert loaded.proposition_cleaned == "AI 牛马陷阱"
        assert loaded.state.value == "completed"

    def test_optional_file_store_keeps_v1_behavior(self, tmp_path: Path) -> None:
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
            file_store=None,
        )

        assert ctx.run_id is None or ctx.run_id == ""
        # 未创建 runs 目录
        assert not any(tmp_path.iterdir())

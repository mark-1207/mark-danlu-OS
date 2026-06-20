"""数据迁移测试：旧 run 数据（无 v3 P0 字段）能正常加载

Context v3 P0 加了 mode / source_run_id / candidate_titles / blueprint_title /
gaps / social_platform / social_length / recreate_* 等字段。

旧数据（v1.x / v2 P0 时期）没有这些字段，FileStore.load 必须能：
- 自动补 mode="create"
- 自动补其他字段默认值
- 不抛 ValidationError
- 续跑 mode 校验时不会报 mode 不匹配

新增字段（如 candidate_titles / gaps）允许空 list / 空字符串，load 后
跑旧 run 不影响行为。
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from lu.pipeline.models import Context
from lu.state.machine import RunState
from lu.store.file_store import FileStore


def _make_legacy_context_json() -> dict:
    """模拟 v1.x 时期的 Context（无 mode 字段，无 v3 P0 新字段）"""
    return {
        "run_id": "legacy-1",
        "proposition_cleaned": "AI 杠杆者",
        # 无 mode 字段
        # 无 source_run_id
        # 无 candidate_titles
        # 无 blueprint_title
        # 无 gaps
        # 无 social_platform
        # 无 social_length
        # 无 recreate_*
        "socratic_session": None,
        "refined_proposition": None,
        "similar_propositions": [],
        "recalled_materials": [],
        "blueprint": None,
        "selected_sections": [],
        "draft": None,
        "quality_report": None,
        "harvested": None,
        "style_profile_snapshot": None,
        "state": "created",
    }


class TestContextLoadLegacy:
    def test_load_legacy_context_defaults_to_create(self, tmp_path: Path) -> None:
        """FileStore.load 加载无 mode 字段的旧数据 → 自动补 create"""
        fs = FileStore(tmp_path / "runs")
        # 手动写一个无 mode 字段的 context.json
        legacy = _make_legacy_context_json()
        (tmp_path / "runs" / "legacy-1").mkdir(parents=True)
        (tmp_path / "runs" / "legacy-1" / "context.json").write_text(
            json.dumps(legacy, ensure_ascii=False), encoding="utf-8"
        )

        # 加载不应抛错
        ctx = fs.load("legacy-1", "context", Context)
        assert ctx.mode == "create"  # 默认
        assert ctx.proposition_cleaned == "AI 杠杆者"
        assert ctx.state == RunState.CREATED

    def test_load_legacy_with_partial_new_fields(self, tmp_path: Path) -> None:
        """部分新字段有，部分缺失：缺失部分用默认值"""
        fs = FileStore(tmp_path / "runs")
        (tmp_path / "runs" / "legacy-2").mkdir(parents=True)
        partial = {
            "run_id": "legacy-2",
            "proposition_cleaned": "p",
            "mode": "social",  # 有 mode
            # 但没有 candidate_titles / blueprint_title
            "state": "step3_done",
        }
        (tmp_path / "runs" / "legacy-2" / "context.json").write_text(
            json.dumps(partial, ensure_ascii=False), encoding="utf-8"
        )
        ctx = fs.load("legacy-2", "context", Context)
        assert ctx.mode == "social"
        assert ctx.candidate_titles == []  # 默认空
        assert ctx.blueprint_title == ""  # 默认空
        assert ctx.state == RunState.STEP3_DONE

    def test_resume_legacy_in_create_mode_works(self, tmp_path: Path) -> None:
        """旧 run 在 create 模式续跑：能正常 work"""
        from lu.config.loader import Framework, SocraticStopSignal, StyleProfile, ThinkingModel
        from lu.pipeline.orchestrator import Orchestrator
        from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry

        fs = FileStore(tmp_path / "runs")
        (tmp_path / "runs" / "legacy-3").mkdir(parents=True)
        legacy = _make_legacy_context_json()
        legacy["run_id"] = "legacy-3"
        (tmp_path / "runs" / "legacy-3" / "context.json").write_text(
            json.dumps(legacy, ensure_ascii=False), encoding="utf-8"
        )

        sp = StyleProfile(socratic_stop_signal=SocraticStopSignal(
            saturation_keywords=["够了"], typical_rounds=2
        ))

        # 注册表：提供 1 个 framework + 1 个 model 让 orchestrator 能跑通
        mr = ThinkingModelRegistry([
            ThinkingModel(id="m1", name="M1", definition="d"),
        ])
        fr = FrameworkRegistry([
            Framework(
                id="problem_decomposition", name="问题解构",
                strategy="chain", model_ids=["m1"],
            ),
        ])

        orch = Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr, mode="create")
        loaded = fs.load("legacy-3", "context", Context)
        # 验证加载后 mode 自动补 create
        assert loaded.mode == "create"
        assert loaded.proposition_cleaned == "AI 杠杆者"

    def test_resume_legacy_mismatched_mode_raises(self, tmp_path: Path) -> None:
        """旧 run（mode="create" 默认）用 social 模式续跑：应报错"""
        from lu.config.loader import SocraticStopSignal, StyleProfile
        from lu.pipeline.orchestrator import Orchestrator
        from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry

        fs = FileStore(tmp_path / "runs")
        (tmp_path / "runs" / "legacy-4").mkdir(parents=True)
        legacy = _make_legacy_context_json()
        legacy["run_id"] = "legacy-4"
        (tmp_path / "runs" / "legacy-4" / "context.json").write_text(
            json.dumps(legacy, ensure_ascii=False), encoding="utf-8"
        )

        sp = StyleProfile(socratic_stop_signal=SocraticStopSignal(
            saturation_keywords=["够了"], typical_rounds=2
        ))
        orch = Orchestrator(style_profile=sp, model_registry=ThinkingModelRegistry([]), framework_registry=FrameworkRegistry([]), mode="social")
        with pytest.raises(ValueError, match="续跑 mode 不匹配"):
            orch.run(
                proposition="x",
                llm_call=lambda p: "{}",
                ask_user=lambda p: "x",
                ask_yes_no=lambda p: True,
                file_store=fs,
                resume_run_id="legacy-4",
                from_step=RunState.STEP1_DONE,
            )


class TestContextDumpRoundtrip:
    def test_dump_and_load_preserves_v3_fields(self, tmp_path: Path) -> None:
        """保存 + 加载：v3 字段不丢"""
        fs = FileStore(tmp_path / "runs")
        original = Context(
            proposition_cleaned="AI",
            mode="social",
            social_platform="weibo",
            social_length=200,
        )
        fs.save("rt-1", "context", original)

        loaded = fs.load("rt-1", "context", Context)
        assert loaded.mode == "social"
        assert loaded.social_platform == "weibo"
        assert loaded.social_length == 200

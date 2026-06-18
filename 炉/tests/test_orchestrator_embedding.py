"""Orchestrator embedding 集成测试

- run() 接受 embedding_hook 可选参数
- 不传 hook 时行为完全不变（向后兼容）
- 传 hook 时：
  - Step 2 后写入 proposition
  - Step 2 后检查相似命题
  - Step 3 前召回素材
  - Step 7 后写入 harvested materials
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from lu.config.loader import SocraticStopSignal, StyleProfile
from lu.embedding.chain import EmbeddingChain
from lu.embedding.hook import EmbeddingHook
from lu.embedding.index import EmbeddingIndex
from lu.embedding.types import EmbeddingResult
from lu.pipeline.orchestrator import Orchestrator
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


def _echo_chain_with_dim(dim: int) -> EmbeddingChain:
    """每个 text 返回不同 embedding（hash 模拟），但同一 text 总是返回同一 vec"""
    cache: dict[str, list[float]] = {}

    def _p(text: str) -> EmbeddingResult:
        if text not in cache:
            # 用 hash 生成稳定的伪随机向量
            h = hash(text) & 0xFFFFFFFF
            v = []
            for i in range(dim):
                v.append(((h >> (i % 32)) & 0xFF) / 128.0 - 1.0)
            cache[text] = v
        return EmbeddingResult(embedding=list(cache[text]), model="m", tokens=len(text))

    return EmbeddingChain([_p])


def _stub_ask_user(answers: list[str]):
    """stub 追问用户：每个 question 顺序消费一个答案"""
    it = iter(answers)

    def ask(q: str) -> str:
        try:
            return next(it)
        except StopIteration:
            return "够了"

    return ask


def _stub_ask_yes_no(ans: bool = False):
    def ask(p: str) -> bool:
        return ans

    return ask


def _empty_style_profile() -> StyleProfile:
    return StyleProfile(
        tone="casual",
        pacing="medium",
        structure="linear",
        forbidden=[],
        must_have=[],
        socratic_stop_signal=SocraticStopSignal(
            saturation_keywords=["够了", "差不多了"],
            typical_rounds=2,
        ),
    )


def _empty_frameworks() -> FrameworkRegistry:
    from lu.config.loader import Framework, ThinkingModel
    from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry

    model = ThinkingModel(id="m1", name="M1", definition="d")
    framework = Framework(
        id="problem_decomposition",
        name="问题解构",
        strategy="chain",
        model_ids=["m1"],
    )
    return FrameworkRegistry([framework]), ThinkingModelRegistry([model])


def _echo_llm(prompt: str) -> str:
    """stub LLM：根据 prompt 形态返回不同 JSON"""
    # 蓝图设计器 prompt（含 "stance" / "audience"）
    if "stance" in prompt and "audience" in prompt:
        return json.dumps({
            "proposition": "X",
            "stance": "y",
            "audience": "z",
            "core_anti_consensus": "",
            "contrarian_points": [],
            "cases": [],
            "data": [],
            "quotes": [],
            "forbidden": [],
        })
    # 苏格拉底追问 → 产出 RefinedProposition
    if "falsifiability" in prompt or "可证伪" in prompt:
        return json.dumps({
            "surface": "AI 杠杆者反思",
            "underlying": "用 AI 把时间杠杆化",
            "audience": "内容创作者",
            "style_recommendation": {
                "voice": "mark",
                "tone": "casual",
                "examples": [],
            },
            "contrarian_candidates": [],
            "framework_candidates": [],
            "risks": [],
            "falsifiability": "",
        })
    # 思想模型执行
    if "M1" in prompt or "模型" in prompt and "执行" in prompt:
        return "framework output text"
    # 草稿生成
    if "草稿" in prompt or "draft" in prompt.lower():
        return "草稿正文：杠杆者故事..."
    # 质检
    if "维度" in prompt or "评分" in prompt:
        return json.dumps({
            "draft_title": "x",
            "dimensions": [{"name": "d1", "score": 8.0, "passed": True, "details": "ok"}],
            "overall_score": 8.0,
            "overall_passed": True,
        })
    # 沉淀
    if "案例" in prompt or "金句" in prompt or "洞察" in prompt:
        return json.dumps({
            "cases": [{"title": "C1", "summary": "case-1"}],
            "quotes": [{"text": "quote-1"}],
            "insights": [{"text": "insight-1"}],
            "forbidden_candidates": [],
        })
    return "{}"


def _stub_harvested() -> Any:
    from lu.blueprint.models import Case, Quote
    from lu.sediment.models import Harvested, Insight

    return Harvested(
        cases=[Case(title="C1", summary="case-1")],
        quotes=[Quote(text="quote-1")],
        insights=[Insight(text="insight-1")],
        forbidden_candidates=[],
    )


def _stub_scorer() -> Any:
    """patch 掉 orchestrator 内部的 scorer/harvester/updater 让其用 stub"""
    from lu.blueprint.models import AntiAIAnchors
    from lu.polish.models import DimensionScore, FixSuggestion, QualityReport
    from lu.socratic.output import RefinedProposition

    def fake_score(draft, blueprint, llm):
        dim = lambda n: DimensionScore(name=n, score=8.0, passed=True, details={"note": "ok"})
        return QualityReport(
            temperature=dim("temperature"),
            heat=dim("heat"),
            depth=dim("depth"),
            thickness=dim("thickness"),
            emotion_curve=dim("emotion_curve"),
            knowledge_transfer=dim("knowledge_transfer"),
            viewpoint_sharpness=dim("viewpoint_sharpness"),
            thinking_model_application=dim("thinking_model_application"),
            factual_accuracy=dim("factual_accuracy"),
        )

    def fake_suggest(report, llm):
        return []

    def fake_extract(draft, refined, llm):
        return _stub_harvested()

    from lu.sediment.style_updater import StyleUpdater

    def fake_update(harvested, profile):
        return profile.model_copy()

    return fake_score, fake_suggest, fake_extract, fake_update


def _run_with_stubs(
    proposition: str, *, hook: EmbeddingHook | None = None
) -> Any:
    """跑一个最小可用的 orchestrator.run（用 patch 替换有副作用的子模块）"""
    from unittest.mock import patch
    from lu.pipeline.orchestrator import Orchestrator
    from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry
    from lu.config.loader import Framework, ThinkingModel

    model = ThinkingModel(id="m1", name="M1", definition="d")
    framework = Framework(
        id="problem_decomposition",
        name="问题解构",
        strategy="chain",
        model_ids=["m1"],
    )
    model_reg = ThinkingModelRegistry([model])
    fw_reg = FrameworkRegistry([framework])

    fake_score, fake_suggest, fake_extract, fake_update = _stub_scorer()

    orch = Orchestrator(
        style_profile=_empty_style_profile(),
        model_registry=model_reg,
        framework_registry=fw_reg,
    )

    with (
        patch("lu.pipeline.orchestrator.QualityScorer.score", side_effect=fake_score),
        patch("lu.pipeline.orchestrator.FixSuggester.suggest", side_effect=fake_suggest),
        patch("lu.pipeline.orchestrator.Harvester.extract", side_effect=fake_extract),
        patch("lu.pipeline.orchestrator.StyleUpdater.update", side_effect=fake_update),
    ):
        ctx = orch.run(
            proposition=proposition,
            llm_call=_echo_llm,
            ask_user=_stub_ask_user(["a", "够了"]),
            ask_yes_no=_stub_ask_yes_no(False),
            section_choice=None,
            file_store=None,
            embedding_hook=hook,
        )
    return ctx


class TestOrchestratorEmbeddingBackwardCompat:
    def test_no_hook_runs_without_error(self) -> None:
        """不传 hook：行为不变（v1.x 兼容）"""
        ctx = _run_with_stubs("AI 杠杆者反思")
        assert ctx.refined_proposition is not None
        assert ctx.blueprint is not None
        assert ctx.draft is not None


class TestOrchestratorEmbeddingIntegration:
    def test_records_proposition_after_step2(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain_with_dim(8),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        _run_with_stubs("AI 杠杆者反思", hook=hook)
        assert prop_idx.count() == 1
        recs = prop_idx.read_all()
        assert recs[0].text == "AI 杠杆者反思"
        assert recs[0].kind == "proposition"

    def test_warns_on_similar_proposition(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        chain = _echo_chain_with_dim(8)
        # 用 chain 算 embedding（与运行时一致）
        pre_emb = chain.embed("AI 杠杆者反思").embedding
        prop_idx.add(
            id="r-prev",
            kind="proposition",
            text="AI 杠杆者反思",
            embedding=pre_emb,
            source="r-prev",
        )
        hook = EmbeddingHook(
            chain=chain,
            proposition_index=prop_idx,
            material_index=mat_idx,
            similar_threshold=0.5,
        )
        ctx = _run_with_stubs("AI 杠杆者反思", hook=hook)
        # 应该至少找到 1 个相似
        assert len(ctx.similar_propositions) >= 1
        assert ctx.similar_propositions[0].run_id == "r-prev"

    def test_recall_injects_into_blueprint(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        chain = _echo_chain_with_dim(8)
        # 用 chain 算 embedding（与运行时一致）
        mat_emb = chain.embed("历史案例-杠杆者故事").embedding
        mat_idx.add(
            id="m1",
            kind="case",
            text="历史案例-杠杆者故事",
            embedding=mat_emb,
            source="run-prev",
        )
        hook = EmbeddingHook(
            chain=chain,
            proposition_index=prop_idx,
            material_index=mat_idx,
            recall_top_k=3,
            recall_threshold=-1.0,  # echo chain 算出的不是真相似度，降到 -1 全收
        )
        ctx = _run_with_stubs("杠杆者故事续集", hook=hook)
        assert len(ctx.recalled_materials) >= 1
        assert ctx.recalled_materials[0].text == "历史案例-杠杆者故事"

    def test_records_materials_after_step7(self, tmp_path: Path) -> None:
        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=_echo_chain_with_dim(8),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        _run_with_stubs("AI 杠杆者反思", hook=hook)
        # 至少 1 case + 1 quote + 1 insight = 3
        assert mat_idx.count() == 3
        recs = mat_idx.read_all()
        kinds = {r.kind for r in recs}
        assert kinds == {"case", "quote", "insight"}

    def test_chain_failure_does_not_block(self, tmp_path: Path) -> None:
        """chain 全失败时：orchestrator 仍能跑完，不抛错"""
        from lu.llm.errors import LLMError

        def _fail(text: str) -> EmbeddingResult:
            raise LLMError("network down", code="SERVER")

        prop_idx = EmbeddingIndex(tmp_path / "props.jsonl")
        mat_idx = EmbeddingIndex(tmp_path / "mats.jsonl")
        hook = EmbeddingHook(
            chain=EmbeddingChain([_fail]),
            proposition_index=prop_idx,
            material_index=mat_idx,
        )
        ctx = _run_with_stubs("AI 杠杆者反思", hook=hook)
        # 流程跑完
        assert ctx.blueprint is not None
        # 索引没写入
        assert prop_idx.count() == 0
        assert mat_idx.count() == 0
        # 相似检测无结果
        assert ctx.similar_propositions == []
        # 召回无结果
        assert ctx.recalled_materials == []


class TestContextFields:
    def test_recalled_materials_default_empty(self) -> None:
        """Context 默认 recalled_materials/similar_propositions 是空 list"""
        from lu.pipeline.models import Context
        ctx = Context(proposition_cleaned="x")
        assert ctx.recalled_materials == []
        assert ctx.similar_propositions == []

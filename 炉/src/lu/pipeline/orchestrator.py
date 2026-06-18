"""Orchestrator：7 步流程串联

参考 docs/02-ARCHITECTURE.md 第 2 节 + docs/04-DATA-MODEL.md 2.2
- Step 1：命题输入
- Step 2：苏格拉底追问 → refined_proposition
- Step 3：蓝图设计（framework 选择 + 策略 + 蓝图生成 + 锚点）
- Step 4：段位选择
- Step 5：草稿生成
- Step 6：打磨质检
- Step 7：沉淀回写
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from lu.blueprint.anchors import AnchorPool
from lu.blueprint.designer import BlueprintDesigner
from lu.blueprint.models import Blueprint
from lu.blueprint.sections import SectionSelector
from lu.config.loader import StyleProfile
from lu.draft.generator import DraftGenerator
from lu.embedding.hook import EmbeddingHook
from lu.pipeline.models import Context
from lu.polish.quality_scorer import QualityScorer
from lu.polish.suggester import FixSuggester
from lu.sediment.harvester import Harvester
from lu.sediment.style_updater import StyleUpdater
from lu.socratic.engine import SocraticEngine
from lu.state.machine import RunState, validate_transition
from lu.store.file_store import FileStore
from lu.thinking_models.framework_selector import DEFAULT_FRAMEWORK_ID, select_framework
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry
from lu.thinking_models.strategies import get_strategy


_LLMCall = Callable[[str], str]
_AskUser = Callable[[str], str]
_AskYesNo = Callable[[str], bool]


@dataclass
class Orchestrator:
    """7 步流程编排器

    注入：
    - style_profile: 风格画像
    - model_registry: 思想模型注册表
    - framework_registry: 思想框架注册表

    run() 串联 7 步，返回完整 Context。
    """

    style_profile: StyleProfile
    model_registry: ThinkingModelRegistry
    framework_registry: FrameworkRegistry

    def run(
        self,
        proposition: str,
        llm_call: _LLMCall,
        *,
        ask_user: _AskUser | None = None,
        ask_yes_no: _AskYesNo | None = None,
        section_choice: list[str] | None = None,
        file_store: FileStore | None = None,
        resume_run_id: str | None = None,
        from_step: RunState | None = None,
        embedding_hook: "EmbeddingHook | None" = None,
    ) -> Context:
        # 续跑初始化
        if resume_run_id is not None:
            if file_store is None:
                raise ValueError("续跑需要 file_store（--resume 需配合 --runs-dir）")
            ctx = file_store.load(resume_run_id, "context", Context)
            if from_step is None:
                raise ValueError("续跑需要指定 from_step")
            if _state_index(ctx.state) > _state_index(from_step):
                raise ValueError(
                    f"from_step ({from_step.value}) 早于已保存 state ({ctx.state.value})"
                )
            # 把 state 改到 from_step，让后续从 from_step 开始
            ctx.state = from_step
            self._persist(ctx, file_store)
        else:
            ctx = Context(proposition_cleaned=proposition.strip())
            if file_store is not None:
                ctx.run_id = _generate_run_id(ctx.proposition_cleaned)
            if from_step is not None and _state_index(from_step) < 0:
                raise ValueError(f"非法的 from_step: {from_step}")

        # Step 1 → STEP1_DONE
        if _state_index(ctx.state) < _state_index(RunState.STEP1_DONE):
            ctx.state = RunState.STEP1_DONE
            self._persist(ctx, file_store)

        # Step 2: 苏格拉底追问
        if _state_index(ctx.state) < _state_index(RunState.STEP2_DONE):
            if ask_user is None or ask_yes_no is None:
                raise ValueError("Step 2 苏格拉底追问需要 ask_user 和 ask_yes_no 回调")
            socratic_engine = SocraticEngine(
                proposition=ctx.proposition_cleaned,
                signal=self.style_profile.socratic_stop_signal,
                ask_user=ask_user,
                ask_yes_no=ask_yes_no,
                llm_call=llm_call,
            )
            socratic_result = socratic_engine.run()
            ctx.socratic_session = socratic_result
            ctx.refined_proposition = socratic_result.refined_proposition
            ctx.state = RunState.STEP2_DONE
            self._persist(ctx, file_store)

            # v2 P0：embedding 相似检测 + 命题记录
            if embedding_hook is not None:
                ctx.similar_propositions = embedding_hook.find_similar(
                    ctx.proposition_cleaned
                )
                embedding_hook.record_proposition(
                    ctx.proposition_cleaned, run_id=ctx.run_id
                )

        # Step 3: 蓝图设计
        if _state_index(ctx.state) < _state_index(RunState.STEP3_DONE):
            framework = self._select_framework_safe(ctx.proposition_cleaned)
            strategy = get_strategy(framework.strategy)
            models = [self.model_registry.get(mid) for mid in framework.model_ids]
            fw_result = strategy(
                models=models,
                proposition=ctx.proposition_cleaned,
                llm_call=llm_call,
            )
            framework_output = _collect_strategy_output(fw_result)
            anchors = AnchorPool.build(ctx.refined_proposition, framework_output)

            # v2 P0：召回相关素材注入蓝图 prompt
            recalled: list = []
            if embedding_hook is not None and ctx.refined_proposition is not None:
                recalled = embedding_hook.recall_materials(ctx.proposition_cleaned)
                ctx.recalled_materials = recalled

            designer = BlueprintDesigner(llm_call=llm_call)
            raw_blueprint = designer.design(
                refined=ctx.refined_proposition,
                framework_id=framework.id,
                framework_output=framework_output,
                recalled_materials=recalled,
            )
            with_anchors = raw_blueprint.model_copy(
                update={"anti_ai_anchors": anchors}
            )
            with_sections = SectionSelector.select(with_anchors, section_choice or [])
            with_must_have = with_sections.model_copy(
                update={"sections": AnchorPool.assign(anchors, with_sections.sections)}
            )
            ctx.blueprint = with_must_have
            ctx.selected_sections = list(with_must_have.sections)
            ctx.state = RunState.STEP3_DONE
            self._persist(ctx, file_store)

        # Step 4: 段位选择（已完成在 Step 3 中）
        if _state_index(ctx.state) < _state_index(RunState.STEP4_DONE):
            ctx.state = RunState.STEP4_DONE
            self._persist(ctx, file_store)

        # Step 5: 草稿生成
        if _state_index(ctx.state) < _state_index(RunState.STEP5_DONE):
            generator = DraftGenerator(llm_call=llm_call)
            ctx.draft = generator.generate(ctx.blueprint, self.style_profile)
            ctx.state = RunState.STEP5_DONE
            self._persist(ctx, file_store)

        # Step 6: 打磨质检
        if _state_index(ctx.state) < _state_index(RunState.STEP6_DONE):
            scorer = QualityScorer()
            report = scorer.score(ctx.draft, ctx.blueprint, llm_call)
            FixSuggester.suggest(report, llm_call)
            ctx.quality_report = report
            ctx.state = RunState.STEP6_DONE
            self._persist(ctx, file_store)

        # Step 7: 沉淀回写
        if _state_index(ctx.state) < _state_index(RunState.COMPLETED):
            harvested = Harvester.extract(ctx.draft, ctx.refined_proposition, llm_call)
            updated_profile = StyleUpdater.update(harvested, self.style_profile)
            ctx.harvested = harvested
            ctx.style_profile_snapshot = updated_profile

            # v2 P0：把 harvested 写入素材索引
            if embedding_hook is not None:
                source_id = ctx.run_id or "unknown"
                embedding_hook.record_materials(harvested, source=source_id)

            ctx.state = RunState.COMPLETED
            self._persist(ctx, file_store)

        validate_transition(RunState.STEP6_DONE, RunState.COMPLETED)

        return ctx

    def _persist(self, ctx: Context, file_store: FileStore | None) -> None:
        if file_store is None or not ctx.run_id:
            return
        file_store.save(ctx.run_id, "context", ctx)

    def _select_framework_safe(self, proposition: str):
        try:
            return select_framework(proposition, self.framework_registry)
        except KeyError:
            if DEFAULT_FRAMEWORK_ID in self.framework_registry:
                return self.framework_registry.get(DEFAULT_FRAMEWORK_ID)
            raise


def _collect_strategy_output(result) -> dict:
    """把 StrategyResult.outputs 序列化成 dict 喂给蓝图设计器"""
    return {out.model_id: out.output for out in result.outputs}


def _generate_run_id(proposition: str) -> str:
    """生成 run_id: YYYY-MM-DD_<slug>"""
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = re.sub(r"[^\w一-鿿]+", "_", proposition).strip("_")
    slug = slug[:40] or "untitled"
    return f"{date}_{slug}"


_STATE_ORDER = [
    RunState.CREATED,
    RunState.STEP1_DONE,
    RunState.STEP2_DONE,
    RunState.STEP3_DONE,
    RunState.STEP4_DONE,
    RunState.STEP5_DONE,
    RunState.STEP6_DONE,
    RunState.COMPLETED,
    RunState.FAILED,
]


def _state_index(state: RunState) -> int:
    """返回 state 在 7 步流程中的位置（用于续跑时比较）"""
    try:
        return _STATE_ORDER.index(state)
    except ValueError:
        return -1

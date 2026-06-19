"""Orchestrator：流程编排器

支持 3 种模式（social / create / recreate），由 Mode 配置决定走哪些步。
每种模式的步定义见 lu.pipeline.mode_config.MODE_CONFIGS。

函数约束：每个函数 < 30 行；复杂逻辑拆成小函数。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from lu.blueprint.anchors import AnchorPool
from lu.blueprint.designer import BlueprintDesigner
from lu.blueprint.sections import SectionSelector
from lu.config.loader import StyleProfile
from lu.draft.generator import DraftGenerator
from lu.embedding.hook import EmbeddingHook
from lu.pipeline.mode_config import VALID_MODES, get_mode_config
from lu.pipeline.models import Context
from lu.pipeline.tui_decision import AutoTUIDecision, TUIDecision
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
    """流程编排器

    mode 决定 7 步流程如何执行：
    - "social": 全自动，4 步简化
    - "create": 原创，8 步全流程（TUI 介入）
    - "recreate": 二创，5 步简化（少数决策点）
    """

    style_profile: StyleProfile
    model_registry: ThinkingModelRegistry
    framework_registry: FrameworkRegistry
    mode: str = "create"

    def __post_init__(self) -> None:
        if self.mode not in VALID_MODES:
            raise ValueError(f"未知 mode: {self.mode}，可选: {VALID_MODES}")
        self.step_configs = get_mode_config(self.mode)

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
        embedding_hook: EmbeddingHook | None = None,
        recreate_args: dict | None = None,
        social_args: dict | None = None,
        tui_decision: TUIDecision | None = None,
    ) -> Context:
        """主入口：按 mode 走对应步骤"""
        ctx = self._init_context(
            proposition=proposition,
            file_store=file_store,
            resume_run_id=resume_run_id,
            from_step=from_step,
        )
        decision = tui_decision or AutoTUIDecision()

        for step_cfg in self.step_configs:
            if _state_index(ctx.state) >= _state_index(step_cfg.state):
                continue
            ctx = self._dispatch_step(
                ctx=ctx,
                step_cfg=step_cfg,
                llm_call=llm_call,
                ask_user=ask_user,
                ask_yes_no=ask_yes_no,
                section_choice=section_choice,
                file_store=file_store,
                embedding_hook=embedding_hook,
                recreate_args=recreate_args,
                social_args=social_args,
                decision=decision,
            )
            ctx.state = step_cfg.state
            self._persist(ctx, file_store)

        self._validate_final_transition()
        return ctx

    def _validate_final_transition(self) -> None:
        """验证最后一个 state → COMPLETED 合法（按 mode 不同跳过不同步）"""
        if len(self.step_configs) < 2:
            return
        last = self.step_configs[-1].state
        prev = self.step_configs[-2].state
        if last is not RunState.COMPLETED:
            return
        # mode 允许的状态序列：prev → COMPLETED 在 step_configs 序列里
        # 接受此转换（不强制走完所有 8 步）
        states = [c.state for c in self.step_configs]
        if prev in states and states[-1] is RunState.COMPLETED:
            return
        validate_transition(prev, RunState.COMPLETED)

    def _init_context(
        self,
        *,
        proposition: str,
        file_store: FileStore | None,
        resume_run_id: str | None,
        from_step: RunState | None,
    ) -> Context:
        """初始化或续跑加载 Context"""
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
            if ctx.mode != self.mode:
                raise ValueError(
                    f"续跑 mode 不匹配: ctx.mode={ctx.mode} != orchestrator.mode={self.mode}"
                )
            ctx.state = from_step
            self._persist(ctx, file_store)
            return ctx

        ctx = Context(proposition_cleaned=proposition.strip(), mode=self.mode)
        if file_store is not None:
            ctx.run_id = _generate_run_id(ctx.proposition_cleaned)
        if from_step is not None and _state_index(from_step) < 0:
            raise ValueError(f"非法的 from_step: {from_step}")
        return ctx

    def _dispatch_step(
        self,
        *,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        ask_user: _AskUser | None,
        ask_yes_no: _AskYesNo | None,
        section_choice: list[str] | None,
        file_store: FileStore | None,
        embedding_hook: EmbeddingHook | None,
        recreate_args: dict | None,
        social_args: dict | None,
        decision: TUIDecision,
    ) -> Context:
        """按 state 路由到对应 step handler"""
        handler = _STEP_HANDLERS[step_cfg.state]
        return handler(
            self,
            ctx=ctx,
            step_cfg=step_cfg,
            llm_call=llm_call,
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            section_choice=section_choice,
            file_store=file_store,
            embedding_hook=embedding_hook,
            recreate_args=recreate_args,
            social_args=social_args,
            decision=decision,
        )

    def _step1(
        self,
        ctx: Context,
        step_cfg,
        recreate_args: dict | None,
        social_args: dict | None,
        **_,
    ) -> Context:
        """Step 1：命题输入（按 mode 分支）"""
        variant = step_cfg.prompt_variant
        if variant == "recreate_input":
            return _input_recreate(ctx, recreate_args)
        if variant == "social":
            return _input_social(ctx, social_args)
        return _input_create(ctx)

    def _step2(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        ask_user: _AskUser | None,
        ask_yes_no: _AskYesNo | None,
        embedding_hook: EmbeddingHook | None,
        **_,
    ) -> Context:
        """Step 2：苏格拉底追问（按 mode 分支）"""
        if step_cfg.prompt_variant != "full":
            return ctx  # social / recreate 跳过
        if ask_user is None or ask_yes_no is None:
            raise ValueError("Step 2 苏格拉底追问需要 ask_user 和 ask_yes_no 回调")
        return _run_socratic(
            ctx=ctx,
            style_profile=self.style_profile,
            ask_user=ask_user,
            ask_yes_no=ask_yes_no,
            llm_call=llm_call,
            embedding_hook=embedding_hook,
        )

    def _step3(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        embedding_hook: EmbeddingHook | None,
        decision: TUIDecision,
        **_,
    ) -> Context:
        """Step 3：标题生成 (Prism)"""
        if step_cfg.prompt_variant == "recreate_skip":
            return _title_reuse(ctx)
        if step_cfg.prompt_variant == "social_title":
            return _title_social(ctx, llm_call)
        return _title_create(
            ctx=ctx,
            llm_call=llm_call,
            embedding_hook=embedding_hook,
            decision=decision,
        )

    def _step4(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        section_choice: list[str] | None,
        embedding_hook: EmbeddingHook | None,
        decision: TUIDecision,
        **_,
    ) -> Context:
        """Step 4：蓝图设计 + 段位"""
        if step_cfg.prompt_variant != "full":
            return ctx
        return _blueprint_create(
            ctx=ctx,
            llm_call=llm_call,
            section_choice=section_choice,
            embedding_hook=embedding_hook,
            decision=decision,
            framework_registry=self.framework_registry,
            model_registry=self.model_registry,
        )

    def _step5(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        decision: TUIDecision,
        **_,
    ) -> Context:
        """Step 5：Gap 决策"""
        if step_cfg.prompt_variant != "full":
            return ctx
        return _gap_create(ctx=ctx, llm_call=llm_call, decision=decision)

    def _step6(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        section_choice: list[str] | None,
        **_,
    ) -> Context:
        """Step 6：草稿生成"""
        if step_cfg.prompt_variant == "social_short":
            return _draft_social(ctx=ctx, llm_call=llm_call, style_profile=self.style_profile)
        if step_cfg.prompt_variant == "recreate_draft":
            return _draft_recreate(ctx=ctx, llm_call=llm_call, style_profile=self.style_profile)
        return _draft_create(
            ctx=ctx,
            llm_call=llm_call,
            style_profile=self.style_profile,
            section_choice=section_choice,
        )

    def _step7(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        **_,
    ) -> Context:
        """Step 7：质检"""
        if step_cfg.prompt_variant == "social_skip":
            return ctx
        if step_cfg.prompt_variant == "recreate_l1only":
            return _l1_only(ctx)
        return _polish_create(ctx=ctx, llm_call=llm_call)

    def _step8(
        self,
        ctx: Context,
        step_cfg,
        llm_call: _LLMCall,
        embedding_hook: EmbeddingHook | None,
        **_,
    ) -> Context:
        """Step 8：沉淀"""
        if step_cfg.prompt_variant in ("recreate_persist",):
            return ctx
        return _harvest(
            ctx=ctx,
            llm_call=llm_call,
            style_profile=self.style_profile,
            embedding_hook=embedding_hook,
        )

    def _persist(self, ctx: Context, file_store: FileStore | None) -> None:
        if file_store is None or not ctx.run_id:
            return
        file_store.save(ctx.run_id, "context", ctx)


_STEP_HANDLERS = {
    RunState.STEP1_DONE: lambda self, **kw: self._step1(**kw),
    RunState.STEP2_DONE: lambda self, **kw: self._step2(**kw),
    RunState.STEP3_DONE: lambda self, **kw: self._step3(**kw),
    RunState.STEP4_DONE: lambda self, **kw: self._step4(**kw),
    RunState.STEP5_DONE: lambda self, **kw: self._step5(**kw),
    RunState.STEP6_DONE: lambda self, **kw: self._step6(**kw),
    RunState.STEP7_DONE: lambda self, **kw: self._step7(**kw),
    RunState.COMPLETED: lambda self, **kw: self._step8(**kw),
}


# ========== Step helper functions（每个 < 30 行）==========


def _input_create(ctx: Context) -> Context:
    if not ctx.proposition_cleaned:
        raise ValueError("命题不能为空")
    return ctx


def _input_social(ctx: Context, social_args: dict | None) -> Context:
    """social 模式 Step 1：注入平台规则 + 长度"""
    if social_args:
        platform_name = social_args.get("platform", "weibo")
        if platform_name not in ("weibo", "toutiao", "twitter"):
            raise ValueError(
                f"未知 social 平台: {platform_name}，可选: weibo/toutiao/twitter"
            )
        ctx.social_platform = platform_name
        ctx.social_length = social_args.get("length", 300)
    return ctx


def _input_recreate(ctx: Context, recreate_args: dict | None) -> Context:
    if not recreate_args:
        raise ValueError("recreate 模式需要 recreate_args")
    if not (recreate_args.get("from_url") or recreate_args.get("from_file")):
        raise ValueError("recreate 必须提供 --from-url 或 --from-file")
    if not recreate_args.get("instruction"):
        raise ValueError("recreate 必须提供 --instruction 改写指令")
    ctx.recreate_source_text = "TODO: Phase 3 加载原文"
    ctx.recreate_instruction = recreate_args["instruction"]
    if recreate_args.get("from_run_id"):
        ctx.source_run_id = recreate_args["from_run_id"]
    return ctx


def _run_socratic(
    *,
    ctx: Context,
    style_profile: StyleProfile,
    ask_user: _AskUser,
    ask_yes_no: _AskYesNo,
    llm_call: _LLMCall,
    embedding_hook: EmbeddingHook | None,
) -> Context:
    engine = SocraticEngine(
        proposition=ctx.proposition_cleaned,
        signal=style_profile.socratic_stop_signal,
        ask_user=ask_user,
        ask_yes_no=ask_yes_no,
        llm_call=llm_call,
    )
    result = engine.run()
    ctx.socratic_session = result
    ctx.refined_proposition = result.refined_proposition
    if embedding_hook is not None:
        ctx.similar_propositions = embedding_hook.find_similar(ctx.proposition_cleaned)
        embedding_hook.record_proposition(ctx.proposition_cleaned, run_id=ctx.run_id)
    return ctx


def _select_framework_safe(proposition: str, framework_registry: FrameworkRegistry):
    try:
        return select_framework(proposition, framework_registry)
    except KeyError:
        if DEFAULT_FRAMEWORK_ID in framework_registry:
            return framework_registry.get(DEFAULT_FRAMEWORK_ID)
        raise


def _collect_strategy_output(result) -> dict:
    return {out.model_id: out.output for out in result.outputs}


def _run_framework_with_models(
    *,
    framework_registry: FrameworkRegistry,
    model_registry: ThinkingModelRegistry,
    proposition: str,
    llm_call: _LLMCall,
) -> tuple[str, dict]:
    """返回 (framework_id, framework_output)"""
    framework = _select_framework_safe(proposition, framework_registry)
    strategy = get_strategy(framework.strategy)
    models = [model_registry.get(mid) for mid in framework.model_ids]
    fw_result = strategy(models=models, proposition=proposition, llm_call=llm_call)
    return framework.id, _collect_strategy_output(fw_result)


def _title_reuse(ctx: Context) -> Context:
    """recreate 模式：沿用原标题"""
    ctx.blueprint_title = ctx.proposition_cleaned
    return ctx


def _title_social(ctx: Context, llm_call: _LLMCall) -> Context:
    """social 模式：1 维 × 3 = 3 标题候选，自动选最锐

    使用启发式评分（无额外 LLM 调用）：
    - 数字/数据 +2
    - 反问/挑战 +1.5
    - 尖锐词 +1
    - 热点词 +0.5
    - 长度 8-20 字 +0.5
    """
    from lu.social.picker import generate_social_titles, pick_best_title

    candidates = generate_social_titles(
        proposition=ctx.proposition_cleaned,
        llm_call=llm_call,
        n=3,
    )
    ctx.candidate_titles = candidates
    ctx.blueprint_title = pick_best_title(candidates)
    return ctx


def _title_create(
    *,
    ctx: Context,
    llm_call: _LLMCall,
    embedding_hook: EmbeddingHook | None,
    decision: TUIDecision,
) -> Context:
    """create 模式：4 维 × 3 = 12 标题"""
    # TODO Phase 2: 接入 prism.py
    ctx.candidate_titles = [ctx.proposition_cleaned + " (TODO 4x3)"]
    input_result = decision.decide_step3_title(ctx.candidate_titles)
    ctx.blueprint_title = input_result.modified_value or ctx.candidate_titles[0]
    return ctx


def _blueprint_create(
    *,
    ctx: Context,
    llm_call: _LLMCall,
    section_choice: list[str] | None,
    embedding_hook: EmbeddingHook | None,
    decision: TUIDecision,
    framework_registry: FrameworkRegistry,
    model_registry: ThinkingModelRegistry,
) -> Context:
    """create 模式 Step 4：framework + 策略 + 蓝图 + 段位"""
    framework_id, framework_output = _run_framework_with_models(
        framework_registry=framework_registry,
        model_registry=model_registry,
        proposition=ctx.proposition_cleaned,
        llm_call=llm_call,
    )
    anchors = AnchorPool.build(ctx.refined_proposition, framework_output)
    recalled = _recall_materials(embedding_hook, ctx)
    ctx.recalled_materials = recalled
    blueprint = _design_blueprint(
        ctx=ctx,
        framework_id=framework_id,
        framework_output=framework_output,
        recalled_materials=recalled,
        anchors=anchors,
        llm_call=llm_call,
    )
    ctx.blueprint = blueprint
    ctx.selected_sections = list(blueprint.sections)
    return ctx


def _recall_materials(
    embedding_hook: EmbeddingHook | None, ctx: Context
) -> list:
    if embedding_hook is None or ctx.refined_proposition is None:
        return []
    return embedding_hook.recall_materials(ctx.proposition_cleaned)


def _design_blueprint(
    *,
    ctx: Context,
    framework_id: str,
    framework_output: dict,
    recalled_materials: list,
    anchors,
    llm_call: _LLMCall,
):
    designer = BlueprintDesigner(llm_call=llm_call)
    raw = designer.design(
        refined=ctx.refined_proposition,
        framework_id=framework_id,
        framework_output=framework_output,
        recalled_materials=recalled_materials,
    )
    with_anchors = raw.model_copy(update={"anti_ai_anchors": anchors})
    with_sections = SectionSelector.select(with_anchors, [])
    return with_sections.model_copy(
        update={"sections": AnchorPool.assign(anchors, with_sections.sections)}
    )


def _gap_create(
    *, ctx: Context, llm_call: _LLMCall, decision: TUIDecision
) -> Context:
    """create 模式 Step 5：素材缺口分析（Phase 5 接入）"""
    # TODO Phase 5: 接入 gap analyzer
    ctx.gaps = []
    return ctx


def _draft_social(
    *, ctx: Context, llm_call: _LLMCall, style_profile: StyleProfile
) -> Context:
    """social 模式：1 段短文"""
    from lu.social.generator import generate_social_draft
    from lu.social.platforms import get_platform

    platform = get_platform(ctx.social_platform)
    ctx.draft = generate_social_draft(
        proposition=ctx.proposition_cleaned,
        title=ctx.blueprint_title or ctx.proposition_cleaned,
        platform=platform,
        llm_call=llm_call,
        style_profile=style_profile,
    )
    return ctx


def _draft_recreate(
    *, ctx: Context, llm_call: _LLMCall, style_profile: StyleProfile
) -> Context:
    """recreate 模式：5 段重写"""
    # TODO Phase 3: 接入 recreate 草稿生成
    ctx.draft = None
    return ctx


def _draft_create(
    *,
    ctx: Context,
    llm_call: _LLMCall,
    style_profile: StyleProfile,
    section_choice: list[str] | None,
) -> Context:
    """create 模式：5 段草稿（2 段一环修改，Phase 4 TUI）"""
    if ctx.blueprint is None:
        raise ValueError("Step 4 蓝图未生成")
    generator = DraftGenerator(llm_call=llm_call)
    ctx.draft = generator.generate(ctx.blueprint, style_profile)
    return ctx


def _l1_only(ctx: Context) -> Context:
    """recreate 模式：仅 L1 检查，不调 LLM"""
    # TODO: 接入 L1 check
    return ctx


def _polish_create(*, ctx: Context, llm_call: _LLMCall) -> Context:
    """create 模式 Step 7：6 维 + 刺客/裂缝/分身"""
    if ctx.draft is None or ctx.blueprint is None:
        raise ValueError("Step 5 草稿未生成")
    scorer = QualityScorer()
    report = scorer.score(ctx.draft, ctx.blueprint, llm_call)
    FixSuggester.suggest(report, llm_call)
    ctx.quality_report = report
    return ctx


def _harvest(
    *,
    ctx: Context,
    llm_call: _LLMCall,
    style_profile: StyleProfile,
    embedding_hook: EmbeddingHook | None,
) -> Context:
    """Step 8：沉淀"""
    if ctx.draft is None:
        raise ValueError("Step 5 草稿未生成")
    # social 模式无 refined_proposition，harvest 用 proposition 替代
    refined = ctx.refined_proposition
    if refined is None:
        from lu.socratic.output import ContrarianPoint, FrameworkCandidate, RefinedProposition, StyleRecommendation

        refined = RefinedProposition.model_construct(
            surface=ctx.proposition_cleaned,
            underlying=ctx.proposition_cleaned,
            audience="social",
            style_recommendation=StyleRecommendation.model_construct(
                voice="mark", tone="casual", examples=[]
            ),
            contrarian_candidates=[],
            framework_candidates=[],
            risks=[],
            falsifiability="",
        )
    harvested = Harvester.extract(ctx.draft, refined, llm_call)
    updated_profile = StyleUpdater.update(harvested, style_profile)
    ctx.harvested = harvested
    ctx.style_profile_snapshot = updated_profile
    if embedding_hook is not None:
        source_id = ctx.run_id or "unknown"
        embedding_hook.record_materials(harvested, source=source_id)
    return ctx


def _generate_run_id(proposition: str) -> str:
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
    RunState.STEP7_DONE,
    RunState.COMPLETED,
    RunState.FAILED,
]


def _state_index(state: RunState) -> int:
    try:
        return _STATE_ORDER.index(state)
    except ValueError:
        return -1

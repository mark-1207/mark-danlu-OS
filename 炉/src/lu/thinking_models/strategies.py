"""5 种思想模型策略

参考 D-003
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from lu.config.loader import ThinkingModel


@dataclass(frozen=True)
class ModelOutput:
    model_id: str
    output: str


@dataclass
class StrategyContext:
    proposition: str
    route: str | None = None
    extra: dict[str, str] = field(default_factory=dict)


@dataclass
class StrategyResult:
    outputs: list[ModelOutput]


_LLMCall = Callable[[str], str]


def _build_prompt(model: ThinkingModel, proposition: str, extra: str = "") -> str:
    hint = model.prompt_hint or ""
    return (
        f"【思想模型：{model.name}】\n"
        f"【定义】{model.definition}\n"
        f"【使用提示】{hint}\n"
        f"【命题】{proposition}\n"
        f"{extra}"
    ).strip()


def chain(
    models: list[ThinkingModel],
    proposition: str,
    llm_call: _LLMCall,
    ctx: StrategyContext | None = None,
) -> StrategyResult:
    outputs: list[ModelOutput] = []
    accumulated = ""
    for m in models:
        extra = f"【前序输出】\n{accumulated}" if accumulated else ""
        prompt = _build_prompt(m, proposition, extra)
        out = llm_call(prompt)
        outputs.append(ModelOutput(model_id=m.id, output=out))
        accumulated = out
    return StrategyResult(outputs=outputs)


def parallel(
    models: list[ThinkingModel],
    proposition: str,
    llm_call: _LLMCall,
    ctx: StrategyContext | None = None,
) -> StrategyResult:
    outputs: list[ModelOutput] = []
    for m in models:
        prompt = _build_prompt(m, proposition)
        out = llm_call(prompt)
        outputs.append(ModelOutput(model_id=m.id, output=out))
    return StrategyResult(outputs=outputs)


def nested(
    models: list[ThinkingModel],
    proposition: str,
    llm_call: _LLMCall,
    ctx: StrategyContext | None = None,
) -> StrategyResult:
    outputs: list[ModelOutput] = []
    accumulated: list[tuple[str, str]] = []
    for m in models:
        if accumulated:
            extra_parts = [
                f"【前序：{mid}】\n{out}" for mid, out in accumulated
            ]
            extra = "\n\n".join(extra_parts)
        else:
            extra = ""
        prompt = _build_prompt(m, proposition, extra)
        out = llm_call(prompt)
        outputs.append(ModelOutput(model_id=m.id, output=out))
        accumulated.append((m.id, out))
    return StrategyResult(outputs=outputs)


def divergent_then_convergent(
    models: list[ThinkingModel],
    proposition: str,
    llm_call: _LLMCall,
    ctx: StrategyContext | None = None,
) -> StrategyResult:
    if not models:
        return StrategyResult(outputs=[])

    mid = len(models) // 2
    if mid == 0:
        mid = 1

    diverge = models[:mid]
    converge = models[mid:]

    outputs: list[ModelOutput] = []
    diverge_outputs: list[ModelOutput] = []
    for m in diverge:
        prompt = _build_prompt(m, proposition)
        out = llm_call(prompt)
        mo = ModelOutput(model_id=m.id, output=out)
        outputs.append(mo)
        diverge_outputs.append(mo)

    diverge_text = "\n\n".join(
        f"【{o.model_id}】\n{o.output}" for o in diverge_outputs
    )

    converge_outputs: list[ModelOutput] = []
    for m in converge:
        prior = "\n\n".join(
            f"【{o.model_id}】\n{o.output}" for o in converge_outputs
        )
        extra_parts = [f"【发散阶段输出】\n{diverge_text}"]
        if prior:
            extra_parts.append(f"【前序收敛】\n{prior}")
        extra = "\n\n".join(extra_parts)
        prompt = _build_prompt(m, proposition, extra)
        out = llm_call(prompt)
        mo = ModelOutput(model_id=m.id, output=out)
        outputs.append(mo)
        converge_outputs.append(mo)

    return StrategyResult(outputs=outputs)


def condition(
    models: list[ThinkingModel],
    proposition_or_ctx: str | StrategyContext,
    llm_call: _LLMCall,
    ctx: StrategyContext | None = None,
) -> StrategyResult:
    if isinstance(proposition_or_ctx, StrategyContext):
        actual_ctx = proposition_or_ctx
    elif ctx is not None:
        actual_ctx = ctx
    else:
        actual_ctx = StrategyContext(proposition=proposition_or_ctx)

    if not models:
        return StrategyResult(outputs=[])

    route = actual_ctx.route
    target = models[0]
    if route:
        for m in models:
            if m.id == route:
                target = m
                break

    prompt = _build_prompt(target, actual_ctx.proposition)
    out = llm_call(prompt)
    return StrategyResult(outputs=[ModelOutput(model_id=target.id, output=out)])


_STRATEGIES = {
    "chain": chain,
    "parallel": parallel,
    "nested": nested,
    "divergent_then_convergent": divergent_then_convergent,
    "condition": condition,
}


def get_strategy(name: str):
    if name not in _STRATEGIES:
        raise ValueError(f"未知策略: {name}")
    return _STRATEGIES[name]

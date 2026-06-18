"""Mode 配置：social / create / recreate 3 种模式各自的步定义

每个 StepConfig 描述一"步"：
- state: 对应的 RunState
- automatable: True=全自动；False=需 TUI 决策
- requires_llm: 是否调 LLM
- use_embedding: 是否触发 EmbeddingHook
- use_polish_full: True=6维+刺客/裂缝/分身；False=L1 only
- prompt_variant: 传给 step handler 的变体标识
"""
from __future__ import annotations

from dataclasses import dataclass

from lu.state.machine import RunState


@dataclass(frozen=True)
class StepConfig:
    state: RunState
    automatable: bool
    requires_llm: bool
    use_embedding: bool
    use_polish_full: bool
    prompt_variant: str


MODE_SOCIAL: list[StepConfig] = [
    StepConfig(RunState.STEP1_DONE, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="social"),
    StepConfig(RunState.STEP3_DONE, automatable=True, requires_llm=True, use_embedding=False, use_polish_full=False, prompt_variant="social_title"),
    StepConfig(RunState.STEP5_DONE, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="social_skip"),
    StepConfig(RunState.STEP6_DONE, automatable=True, requires_llm=True, use_embedding=False, use_polish_full=False, prompt_variant="social_short"),
    StepConfig(RunState.COMPLETED, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="social_persist"),
]


MODE_CREATE: list[StepConfig] = [
    StepConfig(RunState.STEP1_DONE, automatable=False, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP2_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP3_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP4_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP5_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP6_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="full"),
    StepConfig(RunState.STEP7_DONE, automatable=False, requires_llm=True, use_embedding=True, use_polish_full=True, prompt_variant="full"),
    StepConfig(RunState.COMPLETED, automatable=True, requires_llm=True, use_embedding=False, use_polish_full=False, prompt_variant="full"),
]


MODE_RECREATE: list[StepConfig] = [
    StepConfig(RunState.STEP1_DONE, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="recreate_input"),
    StepConfig(RunState.STEP2_DONE, automatable=True, requires_llm=True, use_embedding=False, use_polish_full=False, prompt_variant="recreate_struct"),
    StepConfig(RunState.STEP3_DONE, automatable=False, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="recreate_direct"),
    StepConfig(RunState.STEP5_DONE, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="recreate_skip"),
    StepConfig(RunState.STEP6_DONE, automatable=True, requires_llm=True, use_embedding=True, use_polish_full=False, prompt_variant="recreate_draft"),
    StepConfig(RunState.STEP7_DONE, automatable=True, requires_llm=False, use_embedding=False, use_polish_full=False, prompt_variant="recreate_l1only"),
    StepConfig(RunState.COMPLETED, automatable=True, requires_llm=True, use_embedding=False, use_polish_full=False, prompt_variant="recreate_persist"),
]


MODE_CONFIGS: dict[str, list[StepConfig]] = {
    "social": MODE_SOCIAL,
    "create": MODE_CREATE,
    "recreate": MODE_RECREATE,
}


VALID_MODES: tuple[str, ...] = ("social", "create", "recreate")


def get_mode_config(mode: str) -> list[StepConfig]:
    if mode not in MODE_CONFIGS:
        raise ValueError(f"未知 mode: {mode}，可选: {VALID_MODES}")
    return MODE_CONFIGS[mode]


__all__ = [
    "MODE_CONFIGS",
    "MODE_CREATE",
    "MODE_RECREATE",
    "MODE_SOCIAL",
    "StepConfig",
    "VALID_MODES",
    "get_mode_config",
]

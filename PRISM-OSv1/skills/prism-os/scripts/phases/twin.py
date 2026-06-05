"""Phase 3.5: 数字分身筛选"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


class TwinPhase(Phase):
    """Phase 3.5: 数字分身 — 思维特征加权筛选"""

    @property
    def name(self) -> str:
        return "twin"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return bool(state.candidates)

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from cognitive_crack import digital_twin_filter, learn_thinking_pattern

        try:
            learn_result = learn_thinking_pattern(state.thesis)
            thinking_pattern = learn_result.get("thinking_pattern", "理性")

            twin_result = digital_twin_filter(state.candidates, thinking_pattern)
            selected = twin_result.get("selected_topics", [])

            return PhaseResult(status="success", data={
                "twin_learn": learn_result,
                "digital_twin": twin_result,
                "twin_selected": selected,
            })
        except Exception as e:
            return PhaseResult(status="success", data={
                "twin_learn": {},
                "digital_twin": {},
                "twin_selected": [],
            }, message=str(e))

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        selected = result.data.get("twin_selected", [])
        print(f"[Phase 3.5] 数字分身筛选: {len(selected)} 个候选", file=sys.stderr)

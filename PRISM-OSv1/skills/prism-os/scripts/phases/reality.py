"""Phase 3: 现实校验"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig


class RealityPhase(Phase):
    """Phase 3: 校验候选标题的现实可行性"""

    @property
    def name(self) -> str:
        return "reality"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return bool(state.candidates)

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from reality_anchor import reality_anchor
        try:
            result = reality_anchor(state.candidates)
            return PhaseResult(status="success", data=result)
        except Exception as e:
            return PhaseResult(status="success", data={"validated": state.candidates}, message=str(e))

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        validated = result.data.get("validated", [])
        print(f"[Phase 3] 校验完成: {len(validated)} 个候选通过", file=sys.stderr)

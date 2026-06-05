"""Phase 4.6: Gap 分析 + 决策点 3"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
from prism_os import _run_gap_decision_loop
import sys


class GapPhase(Phase):
    """Phase 4.6: 素材就绪度分析 + 用户决策"""

    @property
    def name(self) -> str:
        return "gap"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return config.include_phase_4_8 and state.ccos_outline is not None

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from gap_analysis import analyze_gap

        try:
            gap_result = analyze_gap(state.thesis, "")
        except Exception as e:
            return PhaseResult(status="success", data={"gap_analysis": None}, message=str(e))

        # 决策点 3
        decision = "auto_continue"
        if config.interactive:
            decision = _run_gap_decision_loop(state.thesis, gap_result, state.platform)

        if decision == "exit":
            return PhaseResult(
                status="rejected",
                data={"gap_analysis": gap_result, "gap_decision": decision},
                message="用户在决策点 3 退出",
            )

        return PhaseResult(status="success", data={
            "gap_analysis": gap_result,
            "gap_decision": decision,
        })

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        ga = result.data.get("gap_analysis", {})
        if ga:
            score = ga.get("gap_score", 0)
            readiness = ga.get("readiness", 0)
            print(f"[Phase 4.6] Gap: score={score:.2f}, 就绪度={readiness:.0%}", file=sys.stderr)
        if result.status == "rejected":
            print(f"[Phase 4.6] {result.message}", file=sys.stderr)

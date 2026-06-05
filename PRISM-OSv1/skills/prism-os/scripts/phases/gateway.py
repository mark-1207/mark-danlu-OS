"""Phase 1: 苏格拉底网关"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


class GatewayPhase(Phase):
    """Phase 1: 苏格拉底网关 — 熵值判断 + 7 类追问"""

    @property
    def name(self) -> str:
        return "gateway"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return not config.skip_gateway

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from socratic_gateway import socratic_gateway

        gateway_result = socratic_gateway(
            state.thesis,
            user_clarification=config.user_clarification,
        )

        if gateway_result["status"] == "blocked":
            return PhaseResult(
                status="rejected",
                data=gateway_result,
                message="命题熵值过低，被拦截",
            )

        return PhaseResult(status="success", data=gateway_result)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        if result.status == "rejected":
            print(f"[Phase 1] 被拦截: {result.message}", file=sys.stderr)
        else:
            decision = result.data.get("decision", "")
            score = result.data.get("combined_score", 0)
            print(f"[Phase 1] 网关通过: decision={decision}, score={score:.2f}", file=sys.stderr)
            # 展示 HKR
            hkr = result.data.get("hkr", {})
            if hkr:
                print(f"  HKR: H={hkr.get('h', 0):.1f} K={hkr.get('k', 0):.1f} R={hkr.get('r', 0):.1f}", file=sys.stderr)

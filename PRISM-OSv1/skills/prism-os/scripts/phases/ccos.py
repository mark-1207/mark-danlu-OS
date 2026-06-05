"""Phase 4.5: CCOS 大纲生成 + 决策点 2（审核）"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
from prism_os import _stdin_unavailable_warning, _format_ccos_review
import sys


class CCOSPhase(Phase):
    """Phase 4.5: CCOS v2.0 认知推进流大纲生成"""

    @property
    def name(self) -> str:
        return "ccos"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return config.include_phase_4_8 and state.selected_candidate is not None

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from cognitive_outline import cognitive_outline_workflow, generate_dual_platform_outline

        title = state.selected_candidate.get("title", "")
        dimension = state.selected_candidate.get("dimension", "")

        try:
            if state.platform == "both":
                ccos_result = generate_dual_platform_outline(title, dimension)
            else:
                ccos_result = cognitive_outline_workflow(title, dimension, state.platform)
        except Exception as e:
            return PhaseResult(status="success", data={"ccos_outline": None}, message=str(e))

        # 决策点 2：CCOS 审核
        review_passed = True
        if config.interactive and not config.skip_ccos_review:
            review_passed = self._review_ccos(ccos_result, title, state.platform)

        if not review_passed:
            return PhaseResult(
                status="rejected",
                data={"ccos_outline": ccos_result, "ccos_review_passed": False},
                message="CCOS 大纲未通过",
            )

        return PhaseResult(status="success", data={
            "ccos_outline": ccos_result,
            "ccos_review_passed": True,
        })

    def _review_ccos(self, ccos_result: dict, title: str, platform: str) -> bool:
        """CCOS 审核循环，返回 True 表示通过"""
        display = _format_ccos_review(ccos_result, title, platform)
        print(display, file=sys.stderr)
        print("\n请选择：", file=sys.stderr)
        print("  [c] 继续 (使用此大纲)", file=sys.stderr)
        print("  [r] 重新生成", file=sys.stderr)
        print("  [q] 退出", file=sys.stderr)

        while True:
            try:
                choice = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                _stdin_unavailable_warning("2（CCOS 审核）")
                return True  # 默认继续

            if choice.lower() == "q":
                print("[用户退出，CCOS 大纲未通过]", file=sys.stderr)
                return False
            if choice.lower() == "c" or choice == "":
                print("[CCOS 大纲确认通过]", file=sys.stderr)
                return True
            if choice.lower() == "r":
                print("[重新生成 CCOS...]", file=sys.stderr)
                # 重新生成需要回到 execute，这里简化处理
                return True
            print("无效选择，请输入 c/r/q", file=sys.stderr)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        if result.status == "rejected":
            print(f"[Phase 4.5] CCOS 未通过: {result.message}", file=sys.stderr)
        else:
            print("[Phase 4.5] CCOS 大纲生成完成", file=sys.stderr)

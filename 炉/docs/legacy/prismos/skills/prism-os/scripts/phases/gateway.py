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

        # 如果有用户回复，用回复重新跑网关
        if state.user_reply:
            gateway_result = socratic_gateway(
                state.thesis,
                user_clarification=state.user_reply,
            )
            # 无论结果如何都继续（用户已给出答复）
            return PhaseResult(status="success", data=gateway_result)

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

        # need_clarification：返回 need_input，让 Pipeline 暂停
        if gateway_result["status"] == "need_clarification" and config.interactive:
            prompt = self._format_clarification_prompt(gateway_result)
            return PhaseResult(
                status="need_input",
                data=gateway_result,
                prompt=prompt,
                input_type="clarification",
            )

        return PhaseResult(status="success", data=gateway_result)

    def _format_clarification_prompt(self, gateway_result: dict) -> str:
        """格式化苏格拉底问题展示（v1.4 增强：分清追问与方向）"""
        questions = gateway_result.get("questions", [])
        directions = gateway_result.get("directions", [])

        lines = ["\n━━━ 命题需要更清晰 ━━━"]
        lines.append("你的命题触发了澄清（熵值/价值评分不足）。\n")

        # 追问：回答后 AI 重新评估
        if questions:
            lines.append("【追问】回答后让 AI 重新评估（输入对应编号 1-N）:")
            for i, q in enumerate(questions, 1):
                lines.append(f"  {i}. {q}")

        # 方向：直接选一个角度，跳过追问
        if directions:
            if questions:
                lines.append("")  # 空行分隔
            lines.append("【方向】直接选一个切入角度（输入对应编号 1-N，跳过追问）:")
            for i, d in enumerate(directions, 1):
                lines.append(f"  {i}. {d}")

        lines.append("\n━━━━━━━━━━━━━━━━━━━━")
        # 明确列出可选项（用户不再迷茫"我能干啥"）
        lines.append("你的选项：")
        if questions:
            lines.append("  • 输入追问编号 1-N → 回答 + 重新评估")
        if directions:
            lines.append("  • 输入方向编号 1-N → 选角度，跳过追问")
        lines.append("  • skip → 用原命题继续")
        lines.append("  • q → 退出 run")
        return "\n".join(lines)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        if result.status == "rejected":
            print(f"[Phase 1] 被拦截: {result.message}", file=sys.stderr)
        elif result.status == "need_input":
            print(result.prompt, file=sys.stderr)
        else:
            status = result.data.get("status", "")
            score = result.data.get("combined_score", 0)
            hkr = result.data.get("hkr", {})
            hkr_avg = hkr.get("hkr_avg", 0)
            print(f"[Phase 1] 网关: status={status}, score={score:.2f}, HKR={hkr_avg:.2f}", file=sys.stderr)
            if status == "need_clarification":
                print(f"        └─ 决策点 0.5 触发（need_clarification）", file=sys.stderr)

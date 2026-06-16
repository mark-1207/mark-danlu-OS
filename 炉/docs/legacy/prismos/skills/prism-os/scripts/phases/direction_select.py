"""Phase 1.5: 方向选择（v1.1）"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig


class DirectionSelectPhase(Phase):
    """方向选择：网关 pass 后展示 2-3 个方向让用户选，注入 prism。"""

    @property
    def name(self) -> str:
        return "direction_select"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        gw = state.gateway or {}
        return (
            config.interactive
            and gw.get("status") == "ready_for_generation"
            and bool(gw.get("directions"))
        )

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        directions = (state.gateway or {}).get("directions", [])

        if not state.user_reply:
            # 首次：调用 LLM 生成差异说明 + 展示，等用户选
            try:
                from socratic_gateway import generate_direction_differences
                differences = generate_direction_differences(
                    state.thesis or "", directions
                )
            except Exception:
                differences = []
            prompt = self._format_prompt(directions, differences)
            return PhaseResult(
                status="need_input",
                data={"directions": directions, "differences": differences},
                prompt=prompt,
                input_type="direction_select",
            )

        # 解析用户选择
        return self._handle_reply(state, directions)

    def _format_prompt(self, directions: list, differences: list = None) -> str:
        differences = differences or []
        lines = ["\n━━━ 切入方向选择 ━━━"]
        for i, d in enumerate(directions, 1):
            star = " ⭐" if i == 1 else ""  # 默认推荐第一个
            diff = differences[i - 1] if i - 1 < len(differences) else ""
            lines.append(f"  {i}. {d}{star}")
            if diff:
                lines.append(f"     💡 {diff}")
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        lines.append("输入编号 1-{0} → 标题将围绕该角度生成".format(len(directions)))
        lines.append("输入 skip 或直接回车 → 用原命题直接进入标题生成")
        lines.append("输入 q → 退出")
        return "\n".join(lines)

    def _handle_reply(self, state: PipelineState, directions: list) -> PhaseResult:
        reply = (state.user_reply or "").strip().lower()

        # skip / 空 / 无效 → 不设置 direction_selected，继续
        if reply in ("", "skip", "q", "quit"):
            return PhaseResult(status="success", data={"direction_selected": ""})

        try:
            idx = int(reply) - 1
            if 0 <= idx < len(directions):
                state.direction_selected = directions[idx]
                return PhaseResult(
                    status="success",
                    data={"direction_selected": directions[idx]},
                )
        except ValueError:
            pass

        # 无效输入 → 继续（不阻断）
        return PhaseResult(status="success", data={"direction_selected": ""})

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        if result.status == "need_input":
            print(result.prompt, file=sys.stderr)
        elif result.data.get("direction_selected"):
            print(f"[Phase 1.5] 方向已选: {result.data['direction_selected']}",
                  file=sys.stderr)

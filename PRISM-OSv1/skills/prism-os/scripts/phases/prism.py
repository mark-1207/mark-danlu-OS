"""Phase 2: 棱镜引擎 + 决策点 1（标题选择）"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


class PrismPhase(Phase):
    """Phase 2: 生成候选标题 + 用户选择"""

    @property
    def name(self) -> str:
        return "prism"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return state.intent is not None and state.intent.get("trigger")

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from prism_engine import prism_engine

        # 如果有用户回复，解析选择
        if state.user_reply and state.candidates:
            return self._handle_user_reply(state, config)

        prism_result = prism_engine(state.thesis)
        candidates = prism_result.get("candidates", [])

        if not candidates:
            return PhaseResult(status="rejected", data=prism_result, message="无候选标题")

        # HKR 评分
        from socratic_gateway import calculate_hkr
        for c in candidates:
            try:
                c["hkr"] = calculate_hkr(c["title"])
            except Exception:
                c["hkr"] = {"h": 0, "k": 0, "r": 0, "hkr_avg": 0}

        # 标记低分
        for c in candidates:
            hkr_avg = c.get("hkr", {}).get("hkr_avg", 0)
            if hkr_avg < 0.5:
                c["low_hkr"] = True

        # 决策点 1：交互式选择标题
        if config.interactive:
            prompt = self._format_title_prompt(candidates)
            return PhaseResult(
                status="need_input",
                data={"candidates": candidates, "candidates_count": len(candidates)},
                prompt=prompt,
                input_type="title_select",
            )

        # 非交互模式：自动选第一个
        return PhaseResult(status="success", data={
            "candidates": candidates,
            "selected_candidate": candidates[0],
            "user_selected_candidate": False,
        })

    def _handle_user_reply(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        """处理用户对标题选择的回复"""
        reply = state.user_reply.strip()
        candidates = state.candidates

        if reply.lower() == "q":
            return PhaseResult(status="success", data={
                "candidates": candidates,
                "selected_candidate": candidates[0],
                "user_selected_candidate": False,
            })

        if reply == "":
            return PhaseResult(status="success", data={
                "candidates": candidates,
                "selected_candidate": candidates[0],
                "user_selected_candidate": False,
            })

        try:
            idx = int(reply) - 1
            if 0 <= idx < len(candidates):
                return PhaseResult(status="success", data={
                    "candidates": candidates,
                    "selected_candidate": candidates[idx],
                    "user_selected_candidate": True,
                })
        except ValueError:
            pass

        # 无效输入，默认选第一个
        return PhaseResult(status="success", data={
            "candidates": candidates,
            "selected_candidate": candidates[0],
            "user_selected_candidate": False,
        })

    def _format_title_prompt(self, candidates: list) -> str:
        """格式化标题选择提示"""
        lines = ["\n【候选标题列表】"]
        for i, c in enumerate(candidates, 1):
            hkr = c.get("hkr", {})
            hkr_avg = hkr.get("hkr_avg", 0)
            mark = "⚠️" if c.get("low_hkr") else "✓"
            lines.append(f"  {i}. {mark} {c.get('title', '')} (HKR={hkr_avg:.2f})")
        lines.append("请选择标题编号（输入 q 退出，默认第一个）:")
        return "\n".join(lines)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        if result.status == "need_input":
            print(result.prompt, file=sys.stderr)
        else:
            candidates = result.data.get("candidates", [])
            selected = result.data.get("selected_candidate", {})
            user_sel = result.data.get("user_selected_candidate", False)
            mark = "（用户选）" if user_sel else "（默认）"
            print(f"[Phase 2] {len(candidates)} 个候选，选中{mark}: {selected.get('title', '')[:30]}", file=sys.stderr)

"""Phase 2: 棱镜引擎 + 决策点 1（标题选择）"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
from prism_os import _stdin_unavailable_warning
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

        # 决策点 1：用户选标题
        selected, user_selected = self._select_title(candidates, config.interactive)

        return PhaseResult(status="success", data={
            "candidates": candidates,
            "selected_candidate": selected,
            "user_selected_candidate": user_selected,
        })

    def _select_title(self, candidates: list, interactive: bool) -> tuple:
        """选择标题，返回 (selected, user_selected)"""
        if not interactive:
            return candidates[0], False

        # 展示候选
        print("\n【候选标题列表】", file=sys.stderr)
        for i, c in enumerate(candidates, 1):
            hkr = c.get("hkr", {})
            hkr_avg = hkr.get("hkr_avg", 0)
            mark = "⚠️" if c.get("low_hkr") else "✓"
            print(f"  {i}. {mark} {c.get('title', '')} (HKR={hkr_avg:.2f})", file=sys.stderr)
        print("请选择标题编号（输入 q 退出，默认第一个）:", file=sys.stderr)

        while True:
            try:
                choice = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                _stdin_unavailable_warning("1（标题选择）")
                return candidates[0], False

            if choice.lower() == "q":
                print("[用户退出，使用默认第一个候选]", file=sys.stderr)
                return candidates[0], False

            if choice == "":
                return candidates[0], False

            try:
                idx = int(choice) - 1
                if 0 <= idx < len(candidates):
                    return candidates[idx], True
                else:
                    print(f"无效编号，请输入 1-{len(candidates)} 之间的数字", file=sys.stderr)
            except ValueError:
                print("请输入数字或 q", file=sys.stderr)

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        candidates = result.data.get("candidates", [])
        selected = result.data.get("selected_candidate", {})
        print(f"[Phase 2] 生成 {len(candidates)} 个候选，选中: {selected.get('title', '')[:30]}", file=sys.stderr)

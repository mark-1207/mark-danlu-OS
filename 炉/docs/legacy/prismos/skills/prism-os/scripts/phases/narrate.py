"""Narrate: 内容生成 (M1 集成: persona 风格注入)"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


class NarratePhase(Phase):
    """Narrate: 调用 _run_narrate 生成内容（已注入 persona 风格）"""

    @property
    def name(self) -> str:
        return "narrate"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return (config.include_narrate
                and state.status != "rejected"
                and state.ccos_outline is not None
                and not state.ccos_failed)

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from prism_os import _run_narrate
        sys.path.insert(0, str(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
        from persona import load as _load_persona, format_for_narrate

        # CCOS 失败时直接跳过（防御性：should_run 已经过滤）
        if state.ccos_failed:
            return PhaseResult(status="skipped", data={}, message="CCOS 失败，跳过 narrate")

        # 优先使用选中标题
        topic = state.selected_candidate.get("title", state.thesis) if state.selected_candidate else state.thesis

        # M1: 加载 persona 风格
        persona = _load_persona(getattr(config, "persona_name", "default"))
        style = format_for_narrate(persona, state.platform)

        try:
            result = _run_narrate(topic, state.platform, style=style)
            return PhaseResult(status="success", data=result)
        except Exception as e:
            return PhaseResult(status="failed", data={"error": str(e)}, message=str(e))

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        if state.ccos_failed:
            print(f"[Narrate] 跳过: CCOS 失败，无法生成内容", file=sys.stderr)
        elif result.status == "success":
            wc = result.data.get("word_count", 0)
            output_file = result.data.get("output_file", "")
            print(f"[Narrate] 内容生成: {wc} 字", file=sys.stderr)
            if output_file:
                print(f"        输出: {output_file}", file=sys.stderr)
        else:
            print(f"[Narrate] 生成失败: {result.message}", file=sys.stderr)

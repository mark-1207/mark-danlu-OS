"""Phase 3.5: 数字分身筛选 (M1 集成: persona topic_domains)"""
from .base import Phase, PhaseResult, PipelineState, PipelineConfig
import sys


class TwinPhase(Phase):
    """Phase 3.5: 数字分身 — 思维特征加权筛选 + persona topic_domains 过滤"""

    @property
    def name(self) -> str:
        return "twin"

    def should_run(self, state: PipelineState, config: PipelineConfig) -> bool:
        return bool(state.candidates)

    def execute(self, state: PipelineState, config: PipelineConfig) -> PhaseResult:
        from cognitive_crack import learn_and_filter_combined
        sys.path.insert(0, str(__import__("os").path.dirname(__import__("os").path.abspath(__file__))))
        from persona import load as _load_persona, get_topic_domains

        # v1.1: learn + filter 合并为 1 次 LLM 调用
        combined = learn_and_filter_combined(state.candidates)
        learn_result = {
            "thinking_pattern": combined.get("thinking_pattern", ""),
            "dimension_weights": combined.get("dimension_weights", {}),
            "style_keywords": combined.get("style_keywords", []),
            "confidence": combined.get("confidence", 0.0),
            "growth_stage": combined.get("growth_stage", "方法型"),
            "sensitive_directions": combined.get("sensitive_directions", []),
            "worldview": combined.get("worldview", ""),
        }
        twin_result = {
            "selected_topics": combined.get("selected_topics", []),
            "rejected_topics": combined.get("rejected_topics", []),
            "digital_twin_confidence": combined.get("digital_twin_confidence", 0.0),
        }
        selected = twin_result["selected_topics"]
        rejected = twin_result["rejected_topics"]

        # 2) M1: persona topic_domains 过滤（领域内 boost，领域外 demote）
        persona = _load_persona(getattr(config, "persona_name", "default"))
        domains = get_topic_domains(persona)

        for t in selected:
            topic_text = t.get("topic", "")
            t["in_domain"] = bool(domains) and any(d in topic_text for d in domains)
        for t in rejected:
            topic_text = t.get("topic", "")
            t["in_domain"] = bool(domains) and any(d in topic_text for d in domains)

        # 3) 软过滤：领域外 demote 到 rejected（仅在 selected 数量 > 3 时，避免全空）
        if len(selected) > 3:
            in_domain = [t for t in selected if t.get("in_domain")]
            out_of_domain = [t for t in selected if not t.get("in_domain")]
            # 保留所有领域内 + 领域外的 top 1（避免全 demote）
            new_selected = in_domain + out_of_domain[:1]
            demoted = out_of_domain[1:]
            for t in demoted:
                rejected.append(t)
            selected = new_selected

        return PhaseResult(status="success", data={
            "twin_learn": learn_result,
            "digital_twin": twin_result,
            "twin_selected": selected,
            "twin_rejected": rejected,
            "persona_domains": domains,  # M1 透传供后续 phase 用
        })

    def display_result(self, result: PhaseResult, state: PipelineState) -> None:
        import sys
        selected = result.data.get("twin_selected", [])
        before = len(state.candidates) if state.candidates else 0
        after = len(selected)
        rejected = result.data.get("twin_rejected", [])
        domains = result.data.get("persona_domains", [])
        if rejected:
            extra = f"（领域内 boost: {sum(1 for t in selected if t.get('in_domain'))} / 领域外 demote: {sum(1 for t in rejected if not t.get('in_domain'))}）" if domains else ""
            print(f"[Phase 3.5] 数字分身: {before}→{after} 候选{extra}", file=sys.stderr)
            for r in rejected[:3]:
                topic = r.get("topic", "?")[:30]
                reason = r.get("rejection_reason", "?")
                in_d = r.get("in_domain", "?")
                domain_tag = "" if in_d else " [out-of-domain]"
                print(f"        - \"{topic}\"（{reason}）{domain_tag}", file=sys.stderr)
        else:
            print(f"[Phase 3.5] 数字分身: {before}→{after} 候选（无降权）", file=sys.stderr)

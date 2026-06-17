"""Anti-AI 锚点池：从追问产出提取锚点，按段位分配 must_have

参考：
- docs/02-ARCHITECTURE.md 2.3 Step 3 Anti-AI 锚点
- docs/03-MODULE-DESIGN.md 3.3 AnchorPool
"""
from __future__ import annotations

from typing import Any

from lu.blueprint.models import (
    AntiAIAnchors,
    Section,
    SectionRole,
)
from lu.socratic.output import RefinedProposition


class AnchorPool:
    """锚点池：构建 + 段位分配"""

    @staticmethod
    def build(refined: RefinedProposition, framework_output: dict[str, Any]) -> AntiAIAnchors:
        contrarian = [c.point for c in refined.contrarian_candidates if c.point]

        insight_parts: list[str] = []
        if refined.falsifiability:
            insight_parts.append(refined.falsifiability)
        insight_parts.extend(r for r in refined.risks if r)

        return AntiAIAnchors(
            contrarian_anchors=contrarian,
            insight_anchors=insight_parts,
        )

    @staticmethod
    def assign(anchors: AntiAIAnchors, sections: list[Section]) -> list[Section]:
        result: list[Section] = []
        for s in sections:
            must_have: list[str] = []
            role = s.role

            if role is SectionRole.ANTI_CONSENSUS:
                must_have.extend(anchors.contrarian_anchors)
            elif role is SectionRole.CASE:
                must_have.extend(c.summary for c in anchors.case_anchors if c.summary)
            elif role is SectionRole.THINKING:
                must_have.extend(anchors.insight_anchors)
                must_have.extend(q.text for q in anchors.quote_anchors if q.text)
            elif role is SectionRole.HOOK:
                if anchors.contrarian_anchors:
                    must_have.append(anchors.contrarian_anchors[0])
            elif role is SectionRole.DATA:
                must_have.extend(d.statement for d in anchors.data_anchors if d.statement)
            elif role is SectionRole.CLOSING:
                if anchors.quote_anchors:
                    must_have.append(anchors.quote_anchors[0].text)
            elif role is SectionRole.QUOTE:
                must_have.extend(q.text for q in anchors.quote_anchors if q.text)

            result.append(s.model_copy(update={"must_have": must_have}))
        return result
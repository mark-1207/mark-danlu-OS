"""爆款二创 Pipeline

复用 DraftGenerator / QualityScorer / Harvester，绕开苏格拉底追问。
"""
from __future__ import annotations

from typing import Callable

from lu.blueprint.anchors import AnchorPool
from lu.blueprint.designer import BlueprintDesigner
from lu.blueprint.models import Blueprint, Section, SectionRole
from lu.blueprint.sections import SectionSelector
from lu.config.loader import StyleProfile
from lu.draft.generator import DraftGenerator
from lu.polish.quality_scorer import QualityScorer
from lu.sediment.harvester import Harvester
from lu.sediment.models import Harvested
from lu.sediment.style_updater import StyleUpdater
from lu.socratic.output import ContrarianPoint, RefinedProposition
from lu.viral.structure import ArticleStructure, extract_structure


_LLMCall = Callable[[str], str]


def _refined_from_structure(new_proposition: str, structure: ArticleStructure) -> RefinedProposition:
    """把 ArticleStructure 转成 RefinedProposition（绕过苏格拉底）"""
    return RefinedProposition(
        surface=structure.hook or new_proposition,
        underlying=structure.contrarian or f"基于参考文章的二创：{new_proposition}",
        audience="复用参考读者画像",
        style_recommendation=__import__("lu.socratic.output", fromlist=["StyleRecommendation"]).StyleRecommendation(
            voice="犀利直接",
            tone="锋利",
            examples=[],
        ),
        contrarian_candidates=[
            ContrarianPoint(point=s, rationale="参考文章中的反共识信号")
            for s in structure.contrarian_signals
        ] if structure.contrarian_signals else [
            ContrarianPoint(point=structure.contrarian or "反共识", rationale="参考文章核心反共识")
        ],
        framework_candidates=[],
        risks=[],
        falsifiability="",
    )


def remix(
    new_proposition: str,
    reference_text: str,
    llm_call: _LLMCall,
    style: StyleProfile,
    *,
    source_url: str | None = None,
) -> dict:
    """爆款二创主函数

    1. 提取参考文章结构
    2. 构造 RefinedProposition
    3. 跑 blueprint → draft → polish → sediment
    """
    structure = extract_structure(reference_text, llm_call, source_url=source_url)
    refined = _refined_from_structure(new_proposition, structure)

    # 3. 蓝图：直接用 BlueprintDesigner（注入 framework_output = structure fields）
    framework_output = {
        "article_structure": structure.model_dump(),
    }
    designer = BlueprintDesigner(llm_call=llm_call)
    raw_blueprint = designer.design(
        refined=refined,
        framework_id="viral_remix",
        framework_output=framework_output,
    )

    # 4. 锚点 + 段位
    anchors = AnchorPool.build(refined, framework_output)
    with_anchors = raw_blueprint.model_copy(update={"anti_ai_anchors": anchors})

    core_sections = SectionSelector.core_sections()
    final_sections = [
        s.model_copy(update={"must_have": [structure.contrarian] or s.must_have})
        if s.role == SectionRole.ANTI_CONSENSUS else s
        for s in core_sections
    ]
    with_sections = with_anchors.model_copy(update={"sections": final_sections})

    # 5. 草稿
    generator = DraftGenerator(llm_call=llm_call)
    draft = generator.generate(with_sections, style)

    # 6. 质检
    scorer = QualityScorer()
    quality_report = scorer.score(draft, with_sections, llm_call)

    # 7. 沉淀
    harvested = Harvester.extract(draft, refined, llm_call)
    updated_profile = StyleUpdater.update(harvested, style)

    return {
        "structure": structure,
        "refined": refined,
        "blueprint": with_sections,
        "draft": draft,
        "quality_report": quality_report,
        "harvested": harvested,
        "style_profile_snapshot": updated_profile,
    }


__all__ = ["remix"]

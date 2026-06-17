"""段位选择器：核心 5 必选 + 按内容类型推荐可选

参考：
- docs/02-ARCHITECTURE.md 2.3 Step 4
- docs/03-MODULE-DESIGN.md 3.3
"""
from __future__ import annotations

from lu.blueprint.models import Blueprint, Section, SectionRole


# 核心 5 段位：按叙事流顺序固定
_CORE_SECTIONS: list[Section] = [
    Section(
        role=SectionRole.HOOK,
        must_have=[],
        word_limit=120,
        style_hint="短句冲击，3 句话内抓人",
    ),
    Section(
        role=SectionRole.ANTI_CONSENSUS,
        must_have=[],
        word_limit=300,
        style_hint="反共识角度，与大众认知对撞",
    ),
    Section(
        role=SectionRole.CASE,
        must_have=[],
        word_limit=400,
        style_hint="具体故事 / 案例，含细节",
    ),
    Section(
        role=SectionRole.THINKING,
        must_have=[],
        word_limit=500,
        style_hint="层层剥开，思想模型贯穿",
    ),
    Section(
        role=SectionRole.CLOSING,
        must_have=[],
        word_limit=150,
        style_hint="金句收尾，留余韵",
    ),
]


# 内容类型 → 推荐可选段位
_RECOMMENDATIONS: dict[str, list[Section]] = {
    "decision": [
        Section(
            role=SectionRole.ACTION,
            must_have=[],
            word_limit=250,
            style_hint="给出可执行步骤",
        ),
        Section(
            role=SectionRole.REBUTTAL,
            must_have=[],
            word_limit=200,
            style_hint="预判反对意见，先手反驳",
        ),
    ],
    "analysis": [
        Section(
            role=SectionRole.DATA,
            must_have=[],
            word_limit=300,
            style_hint="数据 / 事实支撑",
        ),
    ],
    "perspective": [
        Section(
            role=SectionRole.CONTRAST,
            must_have=[],
            word_limit=250,
            style_hint="对比 / 反差，强化观点",
        ),
    ],
    "story": [
        Section(
            role=SectionRole.SELF_DEPRECATION,
            must_have=[],
            word_limit=150,
            style_hint="自嘲拉近距离",
        ),
        Section(
            role=SectionRole.TWIST,
            must_have=[],
            word_limit=200,
            style_hint="转折 / 反转",
        ),
    ],
    "reflection": [
        Section(
            role=SectionRole.QUOTE,
            must_have=[],
            word_limit=100,
            style_hint="引用经典收束",
        ),
        Section(
            role=SectionRole.PAUSE,
            must_have=[],
            word_limit=100,
            style_hint="留白 / 思考题",
        ),
    ],
}


class SectionSelector:
    """段位选择器

    - core_sections()：固定 5 段
    - recommend(content_type)：按内容类型返回推荐可选段
    - select(blueprint, user_choice)：返回写入 sections 的新 Blueprint
    """

    @staticmethod
    def core_sections() -> list[Section]:
        return [s.model_copy(deep=True) for s in _CORE_SECTIONS]

    @staticmethod
    def recommend(content_type: str) -> list[Section]:
        recs = _RECOMMENDATIONS.get(content_type, [])
        return [s.model_copy(deep=True) for s in recs]

    @staticmethod
    def select(blueprint: Blueprint, user_choice: list[str]) -> Blueprint:
        sections = SectionSelector.core_sections()

        known_optionals: dict[str, Section] = {}
        for recs in _RECOMMENDATIONS.values():
            for s in recs:
                known_optionals[s.role.value] = s

        ordered: list[Section] = []
        used: set[str] = set()
        for choice in user_choice:
            if choice in known_optionals and choice not in used:
                ordered.append(known_optionals[choice].model_copy(deep=True))
                used.add(choice)

        final_sections = sections + ordered

        return blueprint.model_copy(update={"sections": final_sections})
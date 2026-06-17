"""段位 prompt 构建器

注入顺序（参考 docs/03-MODULE-DESIGN.md 3.4）：
1. 风格指纹
2. 必避免列表
3. 本段 must_have
4. 本段 role
5. Anti-AI 锚点池
6. 思想模型注入
"""
from __future__ import annotations

from lu.blueprint.models import Blueprint, Section
from lu.config.loader import StyleProfile


class SectionPromptBuilder:
    """构建单段生成的 prompt"""

    @staticmethod
    def build(section: Section, blueprint: Blueprint, style: StyleProfile) -> str:
        parts: list[str] = []

        # 1. 风格指纹
        parts.append(_style_block(style))

        # 2. 必避免列表（合并 style.forbidden + blueprint.forbidden + anti_ai.forbidden_list）
        forbidden = _collect_forbidden(style, blueprint)
        if forbidden:
            parts.append(f"【必避免】\n" + "\n".join(f"- {t}" for t in forbidden))

        # 3. 本段 must_have
        if section.must_have:
            parts.append(
                f"【本段必须包含的素材】\n"
                + "\n".join(f"- {m}" for m in section.must_have)
            )

        # 4. 本段 role
        parts.append(
            f"【本段角色】\n"
            f"- role: {section.role.value}\n"
            f"- style_hint: {section.style_hint}\n"
            f"- word_limit: {section.word_limit}"
        )

        # 5. Anti-AI 锚点池
        anchors_block = _anchors_block(blueprint.anti_ai_anchors)
        if anchors_block:
            parts.append(anchors_block)

        # 6. 思想模型注入
        if section.thinking_model_hint:
            parts.append(f"【思想模型】\n{section.thinking_model_hint}")

        # 命题上下文
        parts.append(
            f"【文章上下文】\n"
            f"- 命题：{blueprint.proposition}\n"
            f"- 立场：{blueprint.stance}\n"
            f"- 读者：{blueprint.audience}\n"
            f"- 反共识：{blueprint.core_anti_consensus}"
        )

        parts.append(
            "【输出格式】\n"
            "严格 JSON：{\"content\": \"正文文本\", \"self_confidence\": 0.0~1.0}"
        )

        return "\n\n".join(parts)


def _style_block(style: StyleProfile) -> str:
    parts = ["【风格指纹】"]
    if style.voice:
        parts.append(f"- voice: {style.voice}")
    if style.forbidden:
        terms = ", ".join(t.term for t in style.forbidden)
        parts.append(f"- forbidden: {terms}")
    return "\n".join(parts)


def _collect_forbidden(style: StyleProfile, blueprint: Blueprint) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for t in style.forbidden:
        if t.term not in seen:
            result.append(t.term)
            seen.add(t.term)

    for t in blueprint.forbidden:
        if t not in seen:
            result.append(t)
            seen.add(t)

    for t in blueprint.anti_ai_anchors.forbidden_list:
        if t not in seen:
            result.append(t)
            seen.add(t)

    return result


def _anchors_block(anchors) -> str:
    lines: list[str] = ["【Anti-AI 锚点池】"]
    if anchors.case_anchors:
        lines.append("case:")
        for c in anchors.case_anchors:
            lines.append(f"  - {c.title}: {c.summary}")
    if anchors.contrarian_anchors:
        lines.append("contrarian:")
        for c in anchors.contrarian_anchors:
            lines.append(f"  - {c}")
    if anchors.data_anchors:
        lines.append("data:")
        for d in anchors.data_anchors:
            src = f" ({d.source})" if d.source else ""
            lines.append(f"  - {d.statement}{src}")
    if anchors.insight_anchors:
        lines.append("insight:")
        for i in anchors.insight_anchors:
            lines.append(f"  - {i}")
    if anchors.quote_anchors:
        lines.append("quote:")
        for q in anchors.quote_anchors:
            lines.append(f'  - "{q.text}" — {q.author or "匿名"}')

    if len(lines) == 1:
        return ""
    return "\n".join(lines)
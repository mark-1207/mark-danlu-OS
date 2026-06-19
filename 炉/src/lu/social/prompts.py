"""平台 prompt 模板：标题生成 + 草稿生成

按平台生成不同的 prompt，调用方传入 proposition / style / platform 即可。
"""
from __future__ import annotations

from lu.social.platforms import PlatformConfig


def build_title_prompt(
    proposition: str, platform: PlatformConfig, n: int = 3
) -> str:
    """生成 N 个标题候选的 prompt

    social 模式：1 维（观点锐度）× n 个候选
    """
    return f"""你是 mark 的内容策略助手。基于命题生成 {n} 个犀利短标题（{platform.name} 平台）。

【命题】
{proposition}

【平台规则】
- 平台：{platform.name}
- 风格：{platform.tone}
- 字数：标题 ≤ 30 字

【输出格式】
严格 JSON 数组，{n} 个候选，不要 markdown 代码块外的内容。
示例：{{"titles": ["标题1", "标题2", "标题3"]}}
"""


def build_draft_prompt(
    proposition: str,
    title: str,
    platform: PlatformConfig,
    style_profile: dict | None = None,
) -> str:
    """生成单段草稿的 prompt"""
    style_text = ""
    if style_profile:
        forbidden_raw = style_profile.get("forbidden", [])
        forbidden = _normalize_terms(forbidden_raw)
        must_have = _normalize_terms(style_profile.get("must_have", []))
        if forbidden:
            style_text += f"\n- 必避免：{', '.join(forbidden[:10])}"
        if must_have:
            style_text += f"\n- 必包含：{', '.join(must_have[:5])}"

    rules_text = "\n".join(f"- {r}" for r in platform.content_rules)

    return f"""你是 mark。基于命题和标题，撰写一段犀利的 {platform.name} 短内容。

【命题】
{proposition}

【标题】
{title}

【平台规则（必须遵守）】
{rules_text}
{style_text}

【输出格式】
严格 JSON：{{"content": "...", "hashtags": ["tag1", "tag2"]}}
content 是完整正文（1 段，不分多段），hashtags 建议 {platform.hashtag_count} 个。
"""


def _normalize_terms(items: list) -> list[str]:
    """把 ForbiddenTerm / dict / str 混合列表归一化成纯字符串列表"""
    out: list[str] = []
    for item in items:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            t = item.get("term") or item.get("text") or ""
            if t:
                out.append(t)
        else:
            # Pydantic 对象：有 .term 属性
            t = getattr(item, "term", None) or str(item)
            if t:
                out.append(t)
    return out

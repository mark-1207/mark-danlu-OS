#!/usr/bin/env python3
"""
PRISM-OS C1 风格指纹 (M9, v1.1)

从 persona 推导风格指纹（0 LLM），用于：
- narrate prompt 注入"要像什么"
- L5 风格检查（规则化，替代纯"不要做什么"）
"""
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class StyleFingerprint:
    """风格指纹：从 persona 提取的风格约束"""
    style_mentors: List[str] = field(default_factory=list)
    style_keywords: List[str] = field(default_factory=list)
    tone_keywords: List[str] = field(default_factory=list)
    avoid_keywords: List[str] = field(default_factory=list)
    style_prompt_text: str = ""

    @classmethod
    def from_persona(cls, persona: Dict) -> "StyleFingerprint":
        """从 persona dict 构建风格指纹。"""
        style_mentors = persona.get("style_mentors", []) or []
        style_keywords = persona.get("style_keywords", []) or []
        tone_keywords = persona.get("tone_keywords", []) or []
        avoid_keywords = persona.get("avoid_keywords", []) or []

        # 构建 style_prompt_text（纯规则，0 LLM）
        parts = []
        if style_mentors:
            parts.append(f"参考风格：{'、'.join(style_mentors)}")
        if tone_keywords:
            parts.append(f"表达气质：{'、'.join(tone_keywords)}")
        if style_keywords:
            parts.append(f"写作特征：{'、'.join(style_keywords)}")
        if avoid_keywords:
            parts.append(f"禁止使用：{'、'.join(avoid_keywords)}")

        style_prompt_text = "\n".join(parts)

        return cls(
            style_mentors=style_mentors,
            style_keywords=style_keywords,
            tone_keywords=tone_keywords,
            avoid_keywords=avoid_keywords,
            style_prompt_text=style_prompt_text,
        )


@dataclass
class StyleCheck:
    """L5 风格检查结果"""
    matched: List[str] = field(default_factory=list)
    missed: List[str] = field(default_factory=list)
    anti_issues: List[str] = field(default_factory=list)
    score: float = 0.0


def check_style_match(text: str, fingerprint: StyleFingerprint) -> StyleCheck:
    """
    规则化风格检查（L5，0 LLM）。

    修订：子串匹配最小长度 ≥ 2 字符，避免单字误中。
    """
    # 只取 ≥ 2 字符的关键词做匹配
    tone_kws = [kw for kw in fingerprint.tone_keywords if len(kw) >= 2]
    style_kws = [kw for kw in fingerprint.style_keywords if len(kw) >= 2]

    matched = [kw for kw in tone_kws + style_kws if kw in text]
    missed = [kw for kw in tone_kws + style_kws if kw not in text]
    anti_issues = [kw for kw in fingerprint.avoid_keywords if kw in text]

    total = len(tone_kws) + len(style_kws)
    if total == 0:
        score = 0.0
    else:
        score = max(0, len(matched) / total - min(0.3, len(anti_issues) * 0.1))

    return StyleCheck(matched=matched, missed=missed, anti_issues=anti_issues, score=score)


def check_l5_style(text: str, fingerprint: StyleFingerprint) -> Dict:
    """L5 风格检查（返回 dict，方便 quality_check 集成）。"""
    result = check_style_match(text, fingerprint)
    return {
        "matched": result.matched,
        "missed": result.missed,
        "anti_issues": result.anti_issues,
        "score": result.score,
    }


def inject_style_guidance(prompt: str, persona: Dict) -> str:
    """将风格指纹注入 narrate prompt。"""
    fp = StyleFingerprint.from_persona(persona)
    if not fp.style_prompt_text:
        return prompt
    return f"{fp.style_prompt_text}\n\n{prompt}"

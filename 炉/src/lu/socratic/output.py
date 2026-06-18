"""苏格拉底 8 项产出格式化

参考 D-004 + 04-DATA-MODEL 2.3
"""
from __future__ import annotations

import json
import re
from typing import Callable

from pydantic import BaseModel, Field

from lu.socratic.questions import Question


class StyleRecommendation(BaseModel):
    voice: str
    tone: str
    examples: list[str] = Field(default_factory=list)


class ContrarianPoint(BaseModel):
    point: str
    rationale: str


class FrameworkCandidate(BaseModel):
    framework_id: str
    name: str
    rationale: str


class RefinedProposition(BaseModel):
    surface: str
    underlying: str
    audience: str
    style_recommendation: StyleRecommendation
    contrarian_candidates: list[ContrarianPoint]
    framework_candidates: list[FrameworkCandidate]
    risks: list[str]
    falsifiability: str


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def parse_llm_response(raw: str) -> RefinedProposition:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM 输出不是合法 JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValueError("LLM 输出 JSON 顶层必须是 object")
    data = _normalize_refined_payload(data)
    return RefinedProposition.model_validate(data)


def _normalize_refined_payload(data: dict) -> dict:
    """容错：处理真实 LLM 不严格按 schema 输出的情况

    1. 编号 key：{"1": {"surface": ...}} 或 {"1": {"surface": ...}, "2": {...}}
    2. audience 是 dict 而不是 string
    3. style_recommendation.examples 是 string 而不是 list
    4. contrarian_candidates / framework_candidates / risks 是 dict 而不是 list
    """
    if "surface" not in data:
        # 合并编号 key
        merged: dict = {}
        for value in data.values():
            if isinstance(value, dict):
                merged.update(value)
        if merged and "surface" in merged:
            data = merged
        else:
            return data

    # audience: dict -> str
    audience = data.get("audience")
    if isinstance(audience, dict):
        # 优先取常见字段，否则把 dict 拼成字符串
        data["audience"] = (
            audience.get("target_readers")
            or audience.get("description")
            or audience.get("summary")
            or " ".join(str(v) for v in audience.values() if isinstance(v, str))
        )

    # style_recommendation.examples: str -> list
    sr = data.get("style_recommendation")
    if isinstance(sr, dict):
        examples = sr.get("examples")
        if isinstance(examples, str):
            sr["examples"] = [examples] if examples else []

    # contrarian_candidates / framework_candidates / risks: dict -> list
    for key in ("contrarian_candidates", "framework_candidates"):
        value = data.get(key)
        if isinstance(value, dict):
            items: list[dict] = []
            for item in value.values():
                if isinstance(item, dict):
                    items.append(item)
            data[key] = items

    risks = data.get("risks")
    if isinstance(risks, str):
        data["risks"] = [risks] if risks else []
    elif isinstance(risks, dict):
        data["risks"] = [str(v) for v in risks.values() if v]

    return data


def _build_prompt(proposition: str, history: list[tuple[Question, str]]) -> str:
    history_text = "\n".join(
        f"[{q.id} {q.theme}] {answer}" for q, answer in history
    )
    example = json.dumps(
        {
            "surface": "AI 对内容创作者的影响",
            "underlying": "算法经济下个体价值被稀释",
            "audience": "内容创作者、自媒体人",
            "style_recommendation": {
                "voice": "犀利一针见血",
                "tone": "批判性",
                "examples": ["例1", "例2"],
            },
            "contrarian_candidates": [
                {"point": "反共识1", "rationale": "理由1"},
                {"point": "反共识2", "rationale": "理由2"},
            ],
            "framework_candidates": [
                {
                    "framework_id": "problem_decomposition",
                    "name": "问题解构",
                    "rationale": "主选理由",
                },
                {
                    "framework_id": "decision_analysis",
                    "name": "决策分析",
                    "rationale": "备选理由",
                },
            ],
            "risks": ["话题敏感", "论据需数据支撑"],
            "falsifiability": "若 AI 工具让创作者收入翻倍，则命题失效",
        },
        ensure_ascii=False,
        indent=2,
    )
    return f"""你是 mark 的内容策略助手。基于命题和追问对话，输出 8 项 JSON。

【命题】
{proposition}

【对话历史】
{history_text}

【8 项输出】
1. surface: 命题浅层（用户在表面说什么）
2. underlying: 底层逻辑（用户真正想表达什么）
3. audience: 潜在诉求（目标读者 + 他们的诉求）—— 必须是字符串
4. style_recommendation: 风格建议（voice 风格 + tone 语气 + examples 参考例数组）
5. contrarian_candidates: 反共识候选数组，每个含 point + rationale
6. framework_candidates: 思想框架候选数组（1 主 1 备），每个含 framework_id + name + rationale
7. risks: 风险点/边界数组
8. falsifiability: 可证伪性（什么情况下命题会失效）

【输出格式】
严格 JSON，不要 markdown 代码块外的内容。顶层字段必须是 surface / underlying / audience / style_recommendation / contrarian_candidates / framework_candidates / risks / falsifiability，不要嵌套编号。

【示例】
{example}
"""


def build_refined_proposition(
    proposition: str,
    history: list[tuple[Question, str]],
    llm_call: Callable[[str], str],
) -> RefinedProposition:
    prompt = _build_prompt(proposition, history)
    raw = llm_call(prompt)
    return parse_llm_response(raw)

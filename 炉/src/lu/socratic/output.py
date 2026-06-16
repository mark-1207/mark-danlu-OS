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
    return RefinedProposition.model_validate(data)


def _build_prompt(proposition: str, history: list[tuple[Question, str]]) -> str:
    history_text = "\n".join(
        f"[{q.id} {q.theme}] {answer}" for q, answer in history
    )
    return f"""你是 mark 的内容策略助手。基于命题和追问对话，输出 8 项 JSON。

【命题】
{proposition}

【对话历史】
{history_text}

【8 项输出】
1. surface: 命题浅层（用户在表面说什么）
2. underlying: 底层逻辑（用户真正想表达什么）
3. audience: 潜在诉求（目标读者 + 他们的诉求）
4. style_recommendation: 风格建议（voice 风格 + tone 语气 + examples 参考例）
5. contrarian_candidates: 反共识候选（2-3 个，每个含 point + rationale）
6. framework_candidates: 思想框架候选（1 主 1 备，每个含 framework_id + name + rationale）
7. risks: 风险点/边界（数组）
8. falsifiability: 可证伪性（什么情况下命题会失效）

【输出格式】
严格 JSON，不要 markdown 代码块外的内容。
"""


def build_refined_proposition(
    proposition: str,
    history: list[tuple[Question, str]],
    llm_call: Callable[[str], str],
) -> RefinedProposition:
    prompt = _build_prompt(proposition, history)
    raw = llm_call(prompt)
    return parse_llm_response(raw)

"""蓝图设计器：CCOS 14 项 → Blueprint

参考：
- docs/02-ARCHITECTURE.md 2.3 Step 3
- docs/03-MODULE-DESIGN.md 3.3
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

from lu.blueprint.models import AntiAIAnchors, Blueprint, Case, DataPoint, Quote
from lu.socratic.output import RefinedProposition


_LLMCall = Callable[[str], str]


def _strip_code_fence(raw: str) -> str:
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", s, re.DOTALL)
    if m:
        return m.group(1).strip()
    return s


def _parse_blueprint_payload(raw: str) -> dict[str, Any]:
    cleaned = _strip_code_fence(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM 输出不是合法 JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValueError("LLM 输出 JSON 顶层必须是 object")
    return data


def _build_prompt(
    refined: RefinedProposition,
    framework_id: str,
    framework_output: dict[str, Any],
) -> str:
    fw_outputs = json.dumps(framework_output, ensure_ascii=False)
    return f"""你是 mark 的内容蓝图设计师。基于追问产出 + 思想框架输出，输出蓝图字段 JSON。

【追问产出（RefinedProposition）】
{json.dumps(refined.model_dump(), ensure_ascii=False, indent=2)}

【选定框架】
{framework_id}

【框架执行产出】
{fw_outputs}

【9 项基础字段】
1. proposition: 命题陈述
2. stance: 立场
3. audience: 目标读者
4. core_anti_consensus: 核心反共识（一句话）
5. cases: 案例数组，每个含 title + summary（+ 可选 source）
6. data: 数据数组，每个含 statement + source
7. quotes: 金句候选数组，每个含 text + author
8. forbidden: 必避免词列表

【输出格式】
严格 JSON，不要 markdown 代码块外的内容。"""


class BlueprintDesigner:
    """蓝图设计器：注入 LLM 调用，返回 Blueprint"""

    def __init__(self, llm_call: _LLMCall) -> None:
        self.llm_call = llm_call

    def design(
        self,
        refined: RefinedProposition,
        framework_id: str,
        framework_output: dict[str, Any],
    ) -> Blueprint:
        prompt = _build_prompt(refined, framework_id, framework_output)
        raw = self.llm_call(prompt)
        payload = _parse_blueprint_payload(raw)

        cases = [Case(**c) for c in payload.get("cases", []) if isinstance(c, dict)]
        data = [DataPoint(**d) for d in payload.get("data", []) if isinstance(d, dict)]
        quotes = [Quote(**q) for q in payload.get("quotes", []) if isinstance(q, dict)]

        return Blueprint(
            proposition=payload.get("proposition", refined.surface),
            stance=payload.get("stance", refined.underlying),
            framework=framework_id,
            framework_output=framework_output,
            audience=payload.get("audience", refined.audience),
            core_anti_consensus=payload.get("core_anti_consensus", ""),
            cases=cases,
            data=data,
            quotes=quotes,
            forbidden=list(payload.get("forbidden", [])),
            sections=[],
            anti_ai_anchors=AntiAIAnchors(),
        )
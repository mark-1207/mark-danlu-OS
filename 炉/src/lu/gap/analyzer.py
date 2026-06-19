"""Gap 分析：识别蓝图缺什么 + 建议补什么

输入：RefinedProposition + Blueprint
输出：list[Gap]，每条 Gap 含：
- section: 哪个段位（hook/case/thinking 等）
- missing: 缺什么（如"具体数据"、"真实案例"）
- suggestion: 建议补什么（如"搜索'AI 工资'数据"或"手动补充"）
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Callable

from lu.blueprint.models import Blueprint, SectionRole
from lu.socratic.output import RefinedProposition


@dataclass(frozen=True)
class Gap:
    section: str  # "hook" / "case" / "thinking" / ...
    missing: str
    suggestion: str


def _heuristic_gaps(
    refined: RefinedProposition, blueprint: Blueprint
) -> list[Gap]:
    """无 LLM 启发式：基于蓝图结构找出明显缺口"""
    gaps: list[Gap] = []
    section_roles = {s.role for s in blueprint.sections}

    # case 段必须包含具体案例
    if SectionRole.CASE in section_roles and not refined.framework_candidates:
        gaps.append(
            Gap(
                section="case",
                missing="未指定具体案例来源",
                suggestion="手动补充 1-2 个真实案例（你/朋友/公开新闻）",
            )
        )

    # thinking 段需要立场和判断
    if SectionRole.THINKING in section_roles and not refined.contrarian_candidates:
        gaps.append(
            Gap(
                section="thinking",
                missing="未指定反共识点",
                suggestion="追问'大多数人会怎么想？反过来呢？'",
            )
        )

    # data 点不足
    if not refined.falsifiability:
        gaps.append(
            Gap(
                section="thinking",
                missing="无可证伪性",
                suggestion="明确什么情况下命题会失效（数据/趋势/案例）",
            )
        )

    return gaps


def build_gap_prompt(refined: RefinedProposition, blueprint: Blueprint) -> str:
    """构造 Gap 分析 prompt（用于 LLM 深度分析）"""
    return f"""你是 mark 的内容策略助手。基于命题和蓝图，找出"动笔前需要补什么材料"。

【命题】
{refined.surface} / {refined.underlying}

【受众】
{refined.audience}

【蓝图 5 段】
- hook: {blueprint.stance[:80] if blueprint.stance else "开篇钩子"}
- anti_consensus: {blueprint.core_anti_consensus or "反共识"}
- case: 案例段
- thinking: {refined.falsifiability or "可证伪性"}
- closing: 金句收尾

【输出格式】
严格 JSON：{{"gaps": [{{"section": "case", "missing": "缺真实案例", "suggestion": "搜索/手动补充"}}]}}
不要 markdown 代码块外的内容。
"""


def parse_gap_response(raw: str) -> list[Gap]:
    """解析 LLM 返回的 gaps JSON"""
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    raw_gaps = data.get("gaps") if isinstance(data, dict) else []
    if not isinstance(raw_gaps, list):
        return []
    out: list[Gap] = []
    for item in raw_gaps:
        if isinstance(item, dict):
            out.append(
                Gap(
                    section=str(item.get("section", "thinking")),
                    missing=str(item.get("missing", "")),
                    suggestion=str(item.get("suggestion", "")),
                )
            )
    return out


def analyze_gaps(
    refined: RefinedProposition,
    blueprint: Blueprint,
    llm_call: Callable[[str], str] | None = None,
) -> list[Gap]:
    """分析素材缺口

    - 启发式必跑（无 LLM 也能找出明显缺口）
    - LLM 可选：调一次补充启发式没覆盖的缺口
    """
    gaps = _heuristic_gaps(refined, blueprint)
    if llm_call is None:
        return gaps
    try:
        prompt = build_gap_prompt(refined, blueprint)
        llm_gaps = parse_gap_response(llm_call(prompt))
        # 合并：启发式 + LLM，按 section 去重
        seen = {(g.section, g.missing) for g in gaps}
        for g in llm_gaps:
            if (g.section, g.missing) not in seen:
                gaps.append(g)
                seen.add((g.section, g.missing))
    except Exception:
        # LLM 失败时回退到启发式
        pass
    return gaps


__all__ = ["Gap", "analyze_gaps", "build_gap_prompt", "parse_gap_response"]

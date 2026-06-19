"""Prism 标题生成：4 维 × 3 = 12 标题候选

4 维（按 PRISM-OS）：
- view: 观点（直接抛立场）
- data: 数据（用数字/百分比）
- case: 案例（具体故事/人物）
- contrarian: 反共识（与传统观点相反）

每维生成 3 个候选，create 模式让用户选 1（或自己改）。
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Callable


DIMENSIONS: tuple[str, ...] = ("view", "data", "case", "contrarian")


@dataclass(frozen=True)
class TitleCandidate:
    dimension: str
    text: str


@dataclass
class PrismResult:
    candidates: list[TitleCandidate] = field(default_factory=list)

    def by_dimension(self, dim: str) -> list[TitleCandidate]:
        return [c for c in self.candidates if c.dimension == dim]


def build_prompt(proposition: str, n_per_dim: int = 3) -> str:
    """构造 Prism prompt：4 维 × n_per_dim 个候选"""
    total = n_per_dim * len(DIMENSIONS)
    dim_text = "\n".join(
        f"- {d}：生成 {n_per_dim} 个候选（特征：{_dim_hint(d)}）"
        for d in DIMENSIONS
    )
    return f"""你是 mark 的内容策略助手。基于命题生成 {total} 个犀利短标题（4 维 × {n_per_dim}）。

【命题】
{proposition}

【4 维标题要求】
{dim_text}

【输出格式】
严格 JSON：{{"titles": [{{"dim": "view", "text": "标题1"}}, ...]}}
每条 ≤ 30 字，不要 markdown 代码块外的内容。
"""


def _dim_hint(dim: str) -> str:
    return {
        "view": "直接抛立场/观点，开门见山",
        "data": "用数字/百分比/数据点切入",
        "case": "具体故事/人物/事件",
        "contrarian": "反共识，与常见认知相反",
    }[dim]


def parse_prism_response(raw: str, n_per_dim: int = 3) -> PrismResult:
    """解析 LLM 返回的 Prism JSON（容错：markdown 围栏 + 字段缺失）"""
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return PrismResult(candidates=[TitleCandidate(dimension="view", text=text[:60])])

    raw_titles = []
    if isinstance(data, dict):
        raw_titles = data.get("titles") or []
    elif isinstance(data, list):
        raw_titles = data

    candidates: list[TitleCandidate] = []
    for item in raw_titles:
        if isinstance(item, dict):
            dim = str(item.get("dim", item.get("dimension", "view")))
            text_v = str(item.get("text", item.get("title", ""))).strip()
            if text_v:
                candidates.append(TitleCandidate(dimension=dim, text=text_v))
        elif isinstance(item, str):
            candidates.append(TitleCandidate(dimension="view", text=item.strip()))

    # 不足时回退：用命题本身填充
    if not candidates:
        candidates.append(TitleCandidate(dimension="view", text="占位标题"))
    return PrismResult(candidates=candidates)


def generate_prism_titles(
    proposition: str,
    llm_call: Callable[[str], str],
    n_per_dim: int = 3,
) -> PrismResult:
    """生成 4 维 × n_per_dim 个标题候选"""
    prompt = build_prompt(proposition, n_per_dim=n_per_dim)
    raw = llm_call(prompt)
    return parse_prism_response(raw, n_per_dim=n_per_dim)


__all__ = [
    "DIMENSIONS",
    "PrismResult",
    "TitleCandidate",
    "build_prompt",
    "generate_prism_titles",
    "parse_prism_response",
]

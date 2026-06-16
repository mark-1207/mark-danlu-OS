#!/usr/bin/env python3
"""
PRISM-OS A2 维度覆盖分析 (M5, v1.1)

- 广度模式: 4 维 (reversal/benefit_anchor/micro_scene/contrarian)
- 深度模式: 5 archetypes (opinion_assertion/identity_label/scene_suspense/data_counter_ask/story_hook)
- 决策点 1 命令解析: 1-12 / d / r / q
"""
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# 广度模式 4 维（与 prism_engine.DIMENSIONS 一致）
BROAD_DIMENSIONS = ["reversal", "benefit_anchor", "micro_scene", "contrarian"]

# 深度模式 5 原型（与 prism_engine.TITLE_ARCHETYPES 一致）
DEEP_ARCHETYPES = [
    "opinion_assertion",
    "identity_label",
    "scene_suspense",
    "data_counter_ask",
    "story_hook",
]


@dataclass
class CoverageReport:
    """覆盖分析结果"""
    covered: List[str] = field(default_factory=list)
    missing: List[str] = field(default_factory=list)
    coverage_ratio: float = 0.0
    imbalance: bool = False
    min_depth_ok: bool = False
    counts: Dict[str, int] = field(default_factory=dict)


def analyze_coverage(candidates: List[Dict], mode: str = "broad") -> CoverageReport:
    """
    分析候选标题的维度/原型覆盖。

    Args:
        candidates: 标题列表（每项含 dimension 或 based_on 字段）
        mode: "broad"（4 维）或 "deep"（5 原型）

    Returns:
        CoverageReport
    """
    if mode == "broad":
        dimensions = BROAD_DIMENSIONS
        field_name = "dimension"
    else:
        dimensions = DEEP_ARCHETYPES
        field_name = "based_on"

    counts: Dict[str, int] = {}
    for c in candidates:
        d = c.get(field_name, "unknown")
        counts[d] = counts.get(d, 0) + 1

    covered = [d for d in dimensions if counts.get(d, 0) > 0]
    missing = [d for d in dimensions if counts.get(d, 0) == 0]
    coverage_ratio = len(covered) / len(dimensions) if dimensions else 0.0

    # 不平衡：单维 > 50%
    imbalance = bool(counts) and max(counts.values()) > len(candidates) * 0.5

    # 最低覆盖深度：每维 ≥ 1
    min_depth_ok = all(counts.get(d, 0) >= 1 for d in dimensions)

    return CoverageReport(
        covered=covered,
        missing=missing,
        coverage_ratio=coverage_ratio,
        imbalance=imbalance,
        min_depth_ok=min_depth_ok,
        counts=counts,
    )


def parse_coverage_command(cmd: str, num_candidates: int) -> Dict:
    """
    决策点 1 命令解析。

    Args:
        cmd: 用户输入
        num_candidates: 候选总数

    Returns:
        {"action": "select"|"deep"|"regenerate"|"quit"|"error", ...}
    """
    cmd = (cmd or "").strip().lower()

    if cmd in ("q", "quit", "exit"):
        return {"action": "quit"}
    if cmd in ("d", "deep"):
        return {"action": "deep"}
    if cmd in ("r", "regenerate"):
        return {"action": "regenerate"}

    # 数字选择 1-N
    try:
        idx = int(cmd) - 1
        if 0 <= idx < num_candidates:
            return {"action": "select", "index": idx}
        return {"action": "error", "message": f"编号 {cmd} 超出范围（1-{num_candidates}）"}
    except ValueError:
        pass

    if cmd == "":
        return {"action": "error", "message": "空输入"}
    return {"action": "error", "message": f"未知命令: {cmd!r}"}


def regenerate_missing_dimensions(missing: List[str], thesis: str,
                                  identity_role: str = "",
                                  audience: str = "") -> List[Dict]:
    """只为缺失的维度生成标题。复用 prism_engine.generate_dimension_titles。"""
    from prism_engine import generate_dimension_titles

    regenerated = []
    for dim in missing:
        titles = generate_dimension_titles(
            thesis, dim,
            identity_role=identity_role,
            audience=audience,
        )
        regenerated.extend(titles)
    return regenerated

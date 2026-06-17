"""周报：本周写了什么 / 评分趋势 / 沉淀统计 / 下周建议

复用 review 的逻辑但更关注"本周"视角。
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

from lu.feedback.models import Feedback
from lu.pipeline.models import Context


def weekly_report(
    runs: Iterable[Context],
    feedback: Iterable[Feedback],
    period: str = "本周",
) -> str:
    """生成周报 Markdown"""
    runs_list = list(runs)
    feedback_list = list(feedback)

    lines: list[str] = []
    lines.append(f"# 炉 · 周报（{period}）")
    lines.append("")

    total = len(runs_list)
    lines.append(f"## 本周产出")
    lines.append(f"- Run 数：**{total}**")
    if total == 0:
        lines.append("- 暂无 Run")
        lines.append("")
        return "\n".join(lines)

    # 写了什么
    lines.append("### 命题列表")
    for r in runs_list:
        passed = "✅" if (r.quality_report and r.quality_report.overall_passed) else "⚠️"
        lines.append(f"- {passed} {r.proposition_cleaned}")
    lines.append("")

    # 评分趋势
    passed_count = sum(
        1 for r in runs_list
        if r.quality_report and r.quality_report.overall_passed
    )
    rate = passed_count * 100 // total
    lines.append("## 评分趋势")
    lines.append(f"- 通过率：**{rate}%**（{passed_count}/{total}）")
    lines.append("")

    # 弱维度
    weakest_counts: Counter = Counter()
    for r in runs_list:
        if r.quality_report:
            weakest_counts[r.quality_report.weakest_dimension] += 1
    if weakest_counts:
        lines.append("## 待提升维度")
        for dim, n in weakest_counts.most_common(3):
            lines.append(f"- **{dim}**：{n} 次弱项")
        lines.append("")

    # 沉淀统计
    total_cases = sum(len(r.harvested.cases) for r in runs_list if r.harvested)
    total_quotes = sum(len(r.harvested.quotes) for r in runs_list if r.harvested)
    total_insights = sum(len(r.harvested.insights) for r in runs_list if r.harvested)
    lines.append("## 沉淀统计")
    lines.append(f"- 案例：{total_cases}")
    lines.append(f"- 金句：{total_quotes}")
    lines.append(f"- 洞察：{total_insights}")
    lines.append("")

    # 下周建议
    if weakest_counts:
        top = weakest_counts.most_common(1)[0][0]
        lines.append("## 下周建议")
        lines.append(f"- 重点关注 **{top}** 维度（出现 {weakest_counts[top]} 次弱项）")
    lines.append("")

    return "\n".join(lines)


__all__ = ["weekly_report"]

"""复盘：从历史 runs + feedback 生成 Markdown 报告

- 总 run 数 / 通过率
- 弱维度分布
- forbidden 命中趋势
- 接受/拒绝趋势
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

from lu.feedback.models import Feedback
from lu.pipeline.models import Context


def review(
    runs: Iterable[Context],
    feedback: Iterable[Feedback],
    period: str = "all",
) -> str:
    """生成复盘 Markdown 报告"""
    runs_list = list(runs)
    feedback_list = list(feedback)

    lines: list[str] = []
    lines.append(f"# 炉 · 复盘报告（{period}）")
    lines.append("")

    total = len(runs_list)
    if total == 0:
        lines.append("- 总 Run 数：**0**")
        lines.append("- 暂无数据，建议先跑几个 run")
        lines.append("")
        return "\n".join(lines)

    # 通过率
    passed = sum(
        1 for r in runs_list
        if r.quality_report and r.quality_report.overall_passed
    )
    rate = passed * 100 // total if total else 0
    lines.append(f"- 总 Run 数：**{total}**")
    lines.append(f"- 通过率：**{rate}%**（{passed}/{total}）")
    lines.append("")

    # 弱维度分布
    weakest_counts: Counter = Counter()
    for r in runs_list:
        if r.quality_report:
            weakest_counts[r.quality_report.weakest_dimension] += 1
    if weakest_counts:
        lines.append("## 弱维度分布")
        for dim, n in weakest_counts.most_common():
            lines.append(f"- **{dim}**：{n} 次")
        lines.append("")

    # 反馈接受率
    if feedback_list:
        accepted = sum(1 for f in feedback_list if f.accepted)
        total_fb = len(feedback_list)
        ar = accepted * 100 // total_fb if total_fb else 0
        lines.append("## 反馈接受率")
        lines.append(f"- 接受：**{ar}%**（{accepted}/{total_fb}）")
        lines.append("")

    return "\n".join(lines)


__all__ = ["review"]

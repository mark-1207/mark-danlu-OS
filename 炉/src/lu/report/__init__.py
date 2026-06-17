"""report: 复盘/雷达/周报"""
from __future__ import annotations

from lu.report.radar import PropositionCandidate, suggest_propositions
from lu.report.review import review
from lu.report.weekly import weekly_report

__all__ = [
    "PropositionCandidate",
    "review",
    "suggest_propositions",
    "weekly_report",
]

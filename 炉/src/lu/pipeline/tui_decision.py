"""TUI 决策抽象

每个 step handler 在需要用户决策时调 TUIDecision 的对应方法。
两个实现：
- AutoTUIDecision: 全部接受，跳过用户（CLI 黑盒模式用）
- InteractiveTUIDecision: rich.prompt 交互（Phase 4 实现）
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class TUIInput:
    """TUI 决策输出"""

    accepted: bool
    modified_value: str | None = None


@runtime_checkable
class TUIDecision(Protocol):
    """TUI 决策协议"""

    def decide_step1_input(self, proposition: str) -> TUIInput: ...
    def decide_step2_socratic(self, question: str, answer: str) -> TUIInput: ...
    def decide_step3_title(self, candidates: list[str]) -> TUIInput: ...
    def decide_step4_blueprint(self, blueprint_dict: dict) -> TUIInput: ...
    def decide_step5_gap(self, gaps: list[str]) -> TUIInput: ...
    def decide_step6_draft(self, sections: list[str]) -> TUIInput: ...
    def decide_step7_polish(self, report: dict) -> TUIInput: ...


class AutoTUIDecision:
    """黑盒模式：所有决策自动接受"""

    def decide_step1_input(self, proposition: str) -> TUIInput:
        return TUIInput(accepted=True, modified_value=proposition)

    def decide_step2_socratic(self, question: str, answer: str) -> TUIInput:
        return TUIInput(accepted=True, modified_value=answer)

    def decide_step3_title(self, candidates: list[str]) -> TUIInput:
        first = candidates[0] if candidates else ""
        return TUIInput(accepted=True, modified_value=first)

    def decide_step4_blueprint(self, blueprint_dict: dict) -> TUIInput:
        return TUIInput(accepted=True)

    def decide_step5_gap(self, gaps: list[str]) -> TUIInput:
        return TUIInput(accepted=True)

    def decide_step6_draft(self, sections: list[str]) -> TUIInput:
        return TUIInput(accepted=True)

    def decide_step7_polish(self, report: dict) -> TUIInput:
        return TUIInput(accepted=True)


__all__ = ["AutoTUIDecision", "TUIInput", "TUIDecision"]

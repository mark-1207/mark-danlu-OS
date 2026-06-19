"""InteractiveTUIDecision：rich.prompt 实现 TUI 决策

create 模式 + TUI 标志时使用。覆盖 7 个决策点：
- decide_step1_input: 命题输入确认
- decide_step2_socratic: 苏格拉底每问答完后回溯改/跳过
- decide_step3_title: 12 标题选 1 / 自写
- decide_step4_blueprint: 蓝图 stance/audience 修改
- decide_step5_gap: 缺口决策（搜索词/手动补/跳过）
- decide_step6_draft: 草稿段（2 段一环）编辑
- decide_step7_polish: 质检决定（修/发）

import guard：非 TTY 环境或 rich 不可用时，回退到 AutoTUIDecision。
"""
from __future__ import annotations

import sys
from dataclasses import dataclass

from lu.pipeline.tui_decision import TUIInput


def _is_tty() -> bool:
    """检查是否在 TTY 环境中"""
    try:
        return sys.stdin.isatty() and sys.stdout.isatty()
    except (AttributeError, ValueError):
        return False


def _can_use_rich() -> bool:
    try:
        import rich  # noqa: F401

        return True
    except ImportError:
        return False


class InteractiveTUIDecision:
    """rich.prompt 实现的 TUI 决策（create 模式 TUI 标志启用）"""

    def __init__(self, auto_fallback: bool = True) -> None:
        self._enabled = _is_tty() and _can_use_rich()
        self._auto = auto_fallback
        if not self._enabled and not auto_fallback:
            raise RuntimeError("TUI 不可用（非 TTY 或 rich 未装）")

    def _decline_to_rich_prompt(self) -> bool:
        """非 TTY 模式下回退到 AutoTUIDecision"""
        return not self._enabled and self._auto

    def decide_step1_input(self, proposition: str) -> TUIInput:
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True, modified_value=proposition)
        from rich.prompt import Confirm, Prompt

        Confirm.ask("[bold]接受这个命题？[/bold]", default=True)
        modified = Prompt.ask("[dim]修改（直接回车保持原命题）[/dim]", default=proposition)
        return TUIInput(accepted=True, modified_value=modified or proposition)

    def decide_step2_socratic(self, question: str, answer: str) -> TUIInput:
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True, modified_value=answer)
        from rich.prompt import Confirm, Prompt

        Confirm.ask(f"[dim]{question[:60]}...[/dim] [bold]接受回答？[/bold]", default=True)
        modified = Prompt.ask("[dim]修改回答（直接回车保持）[/dim]", default=answer)
        return TUIInput(accepted=True, modified_value=modified or answer)

    def decide_step3_title(self, candidates: list[str]) -> TUIInput:
        if self._decline_to_rich_prompt():
            first = candidates[0] if candidates else ""
            return TUIInput(accepted=True, modified_value=first)
        from rich.console import Console
        from rich.prompt import Prompt

        console = Console()
        console.print("\n[bold cyan]12 标题候选（4 维 × 3）[/bold cyan]")
        for i, title in enumerate(candidates, 1):
            console.print(f"  [green]{i:2d}.[/green] {title}")
        choice = Prompt.ask(
            "\n[bold]选 1 个标题（输入序号或自己写）[/bold]",
            default="1",
        )
        if choice.isdigit() and 1 <= int(choice) <= len(candidates):
            return TUIInput(accepted=True, modified_value=candidates[int(choice) - 1])
        return TUIInput(accepted=True, modified_value=choice)

    def decide_step4_blueprint(self, blueprint_dict: dict) -> TUIInput:
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True)
        from rich.console import Console
        from rich.prompt import Confirm

        console = Console()
        console.print("\n[bold cyan]蓝图摘要[/bold cyan]")
        for k, v in blueprint_dict.items():
            if isinstance(v, str) and v:
                preview = v[:100] + "..." if len(v) > 100 else v
                console.print(f"  [green]{k}[/green]: {preview}")
        accept = Confirm.ask("\n[bold]接受这个蓝图？[/bold]", default=True)
        return TUIInput(accepted=accept)

    def decide_step5_gap(self, gaps: list[str]) -> TUIInput:
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True)
        from rich.console import Console
        from rich.prompt import Confirm

        console = Console()
        console.print("\n[bold cyan]Gap 决策[/bold cyan]")
        for g in gaps:
            console.print(f"  - {g}")
        accept = Confirm.ask("\n[bold]接受这些 gap 决策（继续动笔）？[/bold]", default=True)
        return TUIInput(accepted=accept)

    def decide_step6_draft(self, sections: list[str]) -> TUIInput:
        """2 段一环：每 2 段一组，编辑后继续"""
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True)
        from rich.console import Console
        from rich.prompt import Confirm

        console = Console()
        console.print(f"\n[bold cyan]2 段一环草稿（共 {len(sections)} 段）[/bold cyan]")
        for i in range(0, len(sections), 2):
            batch = sections[i : i + 2]
            console.print(f"\n[bold]第 {i // 2 + 1} 批：[/bold]")
            for j, s in enumerate(batch):
                preview = s[:200] + "..." if len(s) > 200 else s
                console.print(f"  [green]段 {i + j + 1}[/green]: {preview}")
            Confirm.ask("[bold]接受这批，继续下一批？[/bold]", default=True)
        return TUIInput(accepted=True)

    def decide_step7_polish(self, report: dict) -> TUIInput:
        if self._decline_to_rich_prompt():
            return TUIInput(accepted=True)
        from rich.console import Console
        from rich.prompt import Confirm

        console = Console()
        overall = report.get("overall_passed", False)
        weakest = report.get("weakest_dimension", "未知")
        console.print(
            f"\n[bold cyan]质检结果[/bold cyan]  "
            f"overall_passed={overall}  弱维度=[yellow]{weakest}[/yellow]"
        )
        accept = Confirm.ask("\n[bold]是否接受（直接发）/ 还是回去修？[/bold]", default=True)
        return TUIInput(accepted=accept)


__all__ = ["InteractiveTUIDecision"]

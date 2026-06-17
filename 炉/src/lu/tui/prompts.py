"""TUI 提示回调：把 rich.prompt 包装成 Callable 注入 SocraticEngine

- make_ask_user() -> Callable[[str], str]：调用 Prompt.ask，strip 结果
- make_ask_yes_no() -> Callable[[str], bool]：调用 Confirm.ask
"""
from __future__ import annotations

from typing import Callable

from rich.prompt import Confirm, Prompt


def make_ask_user() -> Callable[[str], str]:
    """构造 ask_user 回调：调用 Prompt.ask，strip 前后空白"""

    def ask(prompt: str) -> str:
        return Prompt.ask(prompt).strip()

    return ask


def make_ask_yes_no() -> Callable[[str], bool]:
    """构造 ask_yes_no 回调：调用 Confirm.ask"""

    def ask(prompt: str) -> bool:
        return bool(Confirm.ask(prompt))

    return ask


__all__ = ["make_ask_user", "make_ask_yes_no"]

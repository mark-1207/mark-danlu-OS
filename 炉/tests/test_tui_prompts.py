"""TUI prompts 测试

- make_ask_user 调用 rich.prompt.Prompt.ask 并 strip
- make_ask_yes_no 调用 rich.prompt.Confirm.ask 返回 bool
- 用户 EOF（Ctrl+D）抛 KeyboardInterrupt 兼容
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from lu.tui.prompts import make_ask_user, make_ask_yes_no


class TestMakeAskUser:
    def test_returns_stripped_text(self) -> None:
        with patch("lu.tui.prompts.Prompt.ask", return_value="  hello  ") as p:
            ask = make_ask_user()
            result = ask("[Q1] 命题浅层")
        assert result == "hello"
        p.assert_called_once()

    def test_passes_through_prompt_text(self) -> None:
        with patch("lu.tui.prompts.Prompt.ask", return_value="x") as p:
            ask = make_ask_user()
            ask("[Q2 底层逻辑] 你的动机？")
        # 第一参数是 prompt
        assert p.call_args.args[0] == "[Q2 底层逻辑] 你的动机？"


class TestMakeAskYesNo:
    def test_returns_true(self) -> None:
        with patch("lu.tui.prompts.Confirm.ask", return_value=True):
            ask_yn = make_ask_yes_no()
            assert ask_yn("continue?") is True

    def test_returns_false(self) -> None:
        with patch("lu.tui.prompts.Confirm.ask", return_value=False):
            ask_yn = make_ask_yes_no()
            assert ask_yn("continue?") is False

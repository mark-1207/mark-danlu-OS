"""TUI 段位选择器测试

- 给定 content_type 和 mock input，返回正确段位列表
- 空输入 = 不选可选段
"""
from __future__ import annotations

from unittest.mock import patch

from lu.blueprint.models import Blueprint, SectionRole
from lu.tui.sections import select_sections_interactive


def _make_blueprint() -> Blueprint:
    return Blueprint(
        proposition="p",
        stance="s",
        framework="problem_decomposition",
        framework_output={},
        audience="a",
        core_anti_consensus="c",
    )


class TestSelectSectionsInteractive:
    def test_default_no_optional_sections(self) -> None:
        """用户直接回车 = 核心 5 段"""
        with patch("lu.tui.sections.Confirm.ask", return_value=False):
            bp = select_sections_interactive(_make_blueprint(), content_type="analysis")
        assert len(bp.sections) == 5  # 核心 5 段

    def test_user_chooses_data_optional(self) -> None:
        """用户在 analysis 模式下选 DATA 可选段"""

        # 第一次 Confirm.ask（"是否添加可选段？"）→ True
        # 第二次 Confirm.ask（"是否加 DATA？"）→ True
        # 第三次（"再加？"）→ False
        with patch("lu.tui.sections.Confirm.ask", side_effect=[True, True, False]):
            bp = select_sections_interactive(_make_blueprint(), content_type="analysis")
        # 核心 5 + DATA = 6
        assert len(bp.sections) == 6
        roles = {s.role for s in bp.sections}
        assert SectionRole.DATA in roles

    def test_blueprint_unchanged(self) -> None:
        """返回新 blueprint，原 blueprint 不变"""
        original = _make_blueprint()
        with patch("lu.tui.sections.Confirm.ask", return_value=False):
            new_bp = select_sections_interactive(original, content_type="perspective")
        assert original.sections == []
        assert len(new_bp.sections) == 5

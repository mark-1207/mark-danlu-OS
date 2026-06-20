"""CLI lu model 子命令测试"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lu.cli.model import build_parser, cmd_add, cmd_list, cmd_remove, main


class TestParser:
    def test_add_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args([
            "add", "--id", "x", "--name", "X", "--definition", "d",
            "--custom-yaml", "/tmp/c.yaml",
        ])
        assert ns.model_action == "add"
        assert ns.id == "x"

    def test_list_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args(["list", "--only-custom"])
        assert ns.model_action == "list"
        assert ns.only_custom is True

    def test_remove_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args(["remove", "--id", "x", "--custom-yaml", "/tmp/c.yaml"])
        assert ns.model_action == "remove"
        assert ns.id == "x"


class TestCmdAdd:
    def test_add_creates_yaml(self, tmp_path: Path) -> None:
        custom = tmp_path / "custom.yaml"
        ns = _parse("add", "--id", "m1", "--name", "M1", "--definition", "d",
                    "--custom-yaml", str(custom))
        rc = cmd_add(ns)
        assert rc == 0
        assert custom.is_file()
        content = custom.read_text(encoding="utf-8")
        assert "m1" in content

    def test_add_duplicate_returns_error(self, tmp_path: Path) -> None:
        custom = tmp_path / "custom.yaml"
        cmd_add(_parse("add", "--id", "dup", "--name", "A", "--definition", "d",
                       "--custom-yaml", str(custom)))
        rc = cmd_add(_parse("add", "--id", "dup", "--name", "B", "--definition", "d",
                            "--custom-yaml", str(custom)))
        assert rc == 2

    def test_add_invalid_id_returns_error(self, tmp_path: Path) -> None:
        ns = _parse("add", "--id", "123-bad", "--name", "X", "--definition", "d",
                    "--custom-yaml", str(tmp_path / "c.yaml"))
        rc = cmd_add(ns)
        assert rc == 2


class TestCmdList:
    def test_list_only_custom(self, tmp_path: Path) -> None:
        custom = tmp_path / "custom.yaml"
        cmd_add(_parse("add", "--id", "a", "--name", "A", "--definition", "d",
                       "--custom-yaml", str(custom)))
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = cmd_list(_parse("list", "--custom-yaml", str(custom), "--only-custom"))
        assert rc == 0
        out = buf.getvalue()
        assert "a" in out
        assert "杠杆者" not in out  # only_custom 模式不显示 built-in

    def test_list_all(self, tmp_path: Path) -> None:
        """list 默认会合并 built-in + custom"""
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = cmd_list(_parse("list"))
        assert rc == 0
        out = buf.getvalue()
        assert "杠杆者" in out  # built-in "杠杆者" 在


class TestCmdRemove:
    def test_remove_existing(self, tmp_path: Path) -> None:
        custom = tmp_path / "custom.yaml"
        cmd_add(_parse("add", "--id", "x", "--name", "X", "--definition", "d",
                       "--custom-yaml", str(custom)))
        rc = cmd_remove(_parse("remove", "--id", "x", "--custom-yaml", str(custom)))
        assert rc == 0
        assert "x" not in custom.read_text(encoding="utf-8")

    def test_remove_nonexistent_returns_error(self, tmp_path: Path) -> None:
        custom = tmp_path / "custom.yaml"
        rc = cmd_remove(_parse("remove", "--id", "nonexistent",
                               "--custom-yaml", str(custom)))
        assert rc == 2


class TestMainDispatch:
    def test_main_add(self, tmp_path: Path) -> None:
        rc = main([
            "add", "--id", "m1", "--name", "M1", "--definition", "d",
            "--custom-yaml", str(tmp_path / "c.yaml"),
        ])
        assert rc == 0


def _parse(*argv: str):
    """用 build_parser 解析参数"""
    return build_parser().parse_args(list(argv))

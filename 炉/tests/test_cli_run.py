"""CLI run 命令烟雾测试"""
from __future__ import annotations

from lu.cli.run import main


class TestCLIRun:
    def test_dry_run_completes_cleanly(self) -> None:
        ret = main(["run", "测试命题", "--dry-run"])
        assert ret == 0

    def test_dry_run_implicit_command(self) -> None:
        ret = main(["测试命题2", "--dry-run"])
        assert ret == 0

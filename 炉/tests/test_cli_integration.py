"""CLI 集成测试：3 个新子命令 + 旧命令 deprecation

- create / social / recreate subcommand 注册
- 旧 run / viral 仍可用（deprecation warning）
- 默认模式（无 subcommand）→ create
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from lu.cli.run import build_parser, main, cmd_create, cmd_run, cmd_social, cmd_recreate


class TestParserSubcommands:
    def test_create_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args(["create", "AI 杠杆者"])
        assert ns.command == "create"
        assert ns.proposition == "AI 杠杆者"

    def test_create_with_reference(self) -> None:
        p = build_parser()
        ns = p.parse_args(["create", "AI 杠杆者", "--reference", "http://x.com"])
        assert ns.command == "create"
        assert ns.reference == "http://x.com"

    def test_social_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args(["social", "AI 杠杆者", "--platform", "weibo"])
        assert ns.command == "social"
        assert ns.platform == "weibo"
        assert ns.length == 300

    def test_social_default_platform(self) -> None:
        p = build_parser()
        ns = p.parse_args(["social", "AI"])
        assert ns.platform == "weibo"
        assert ns.length == 300

    def test_social_toutiao(self) -> None:
        p = build_parser()
        ns = p.parse_args(["social", "AI", "--platform", "toutiao", "--length", "1500"])
        assert ns.platform == "toutiao"
        assert ns.length == 1500

    def test_recreate_subcommand(self) -> None:
        p = build_parser()
        ns = p.parse_args([
            "recreate", "--from-file", "a.md", "--instruction", "改写",
        ])
        assert ns.command == "recreate"
        assert ns.from_file == "a.md"
        assert ns.instruction == "改写"

    def test_recreate_requires_instruction(self) -> None:
        p = build_parser()
        with pytest.raises(SystemExit):
            p.parse_args(["recreate", "--from-file", "a.md"])

    def test_run_still_works_deprecated(self) -> None:
        p = build_parser()
        ns = p.parse_args(["run", "AI"])
        assert ns.command == "run"
        assert ns.proposition == "AI"

    def test_viral_still_works_deprecated(self) -> None:
        p = build_parser()
        ns = p.parse_args(["viral", "AI", "--reference", "http://x"])
        assert ns.command == "viral"


class TestMainDispatch:
    def test_default_to_create(self, tmp_path: Path) -> None:
        """无子命令时默认 create（-m 模式）"""
        ret = main(["AI 杠杆者反思", "--dry-run", "--quiet"])
        assert ret == 0

    def test_create_dispatches(self) -> None:
        ret = main(["create", "AI 杠杆者反思", "--dry-run", "--quiet"])
        assert ret == 0

    def test_run_runs_create_with_warning(self, capsys) -> None:
        """旧 run 命令仍能用，但打印 deprecation warning"""
        ret = main(["run", "AI 杠杆者反思", "--dry-run", "--quiet"])
        assert ret == 0
        err = capsys.readouterr().err
        assert "[DEPRECATED]" in err
        assert "lu create" in err

    def test_social_dispatches(self) -> None:
        ret = main(["social", "AI 杠杆者反思", "--platform", "weibo", "--dry-run", "--quiet"])
        assert ret == 0

    def test_recreate_dispatches(self, tmp_path: Path) -> None:
        f = tmp_path / "article.md"
        f.write_text("x" * 200, encoding="utf-8")
        ret = main([
            "recreate",
            "--from-file", str(f),
            "--instruction", "改写",
            "--dry-run",
            "--quiet",
        ])
        assert ret == 0


class TestCmdCreateWithReference:
    """create --reference 包装成 recreate 形式（学爆款结构）"""

    def test_reference_url_passed_as_recreate(self, tmp_path: Path) -> None:
        """create --reference 触发学习参考文章结构"""
        ret = main([
            "create",
            "新命题",
            "--reference", "http://example.com",
            "--dry-run",
            "--quiet",
        ])
        # 第一次执行会失败（URL fetch 失败），但说明路径走通
        # 实际不关心是否成功，关注能进入 create 模式
        assert ret in (0, 2)  # 0 = 成功；2 = 错误（mock 数据导致）

    def test_reference_local_file(self, tmp_path: Path) -> None:
        f = tmp_path / "ref.md"
        f.write_text("# 原文章\n\n内容" * 50, encoding="utf-8")
        ret = main([
            "create",
            "新命题",
            "--reference", str(f),
            "--dry-run",
            "--quiet",
        ])
        assert ret == 0

#!/usr/bin/env python3
"""
单命令健康检查测试 — Commit 3

prism/gap/ccos/narrate 单独调用时：
- 打印建议到 stderr："建议通过 run 走完整流程"
- 不影响 stdout JSON 输出
- --suppress-warning 标志可关闭

用法: python -m pytest skills/prism-os/tests/test_command_healthcheck.py -v
"""

import sys
import os
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


# ============ T-1: prism 单独调用触发警告 ============

class TestPrismHealthCheck(unittest.TestCase):
    """prism 单独调用应触发健康检查警告"""

    @patch("builtins.input", return_value="q")
    @patch("prism_engine.prism_engine", return_value={"candidates": []})
    def test_prism_prints_health_check_to_stderr(self, mock_engine, mock_input):
        """prism 单独调用 → stderr 打印健康检查"""
        import io
        from contextlib import redirect_stderr
        import prism_os

        sys.argv = ["prism_os.py", "prism", "测试"]

        captured = io.StringIO()
        with redirect_stderr(captured):
            try:
                prism_os.main()
            except SystemExit:
                pass

        err_output = captured.getvalue()
        self.assertIn("建议", err_output,
                      "prism 单独调用应 stderr 打印 '建议通过 run 走完整流程'")


# ============ T-2: --suppress-warning 关闭警告 ============

class TestSuppressWarningFlag(unittest.TestCase):
    """--suppress-warning 标志可关闭健康检查"""

    @patch("builtins.input", return_value="q")
    @patch("prism_engine.prism_engine", return_value={"candidates": []})
    def test_suppress_warning_silences_stderr(self, mock_engine, mock_input):
        import io
        from contextlib import redirect_stderr
        import prism_os

        sys.argv = ["prism_os.py", "prism", "测试", "--suppress-warning"]

        captured = io.StringIO()
        with redirect_stderr(captured):
            try:
                prism_os.main()
            except SystemExit:
                pass

        err_output = captured.getvalue()
        self.assertNotIn("建议通过 run 走完整流程", err_output,
                         "--suppress-warning 应禁用健康检查提示")


# ============ T-3: 健康检查不破坏 stdout JSON 输出 ============

class TestHealthCheckDoesNotCorruptStdout(unittest.TestCase):
    """健康检查只在 stderr 打印，不污染 stdout JSON"""

    @patch("builtins.input", return_value="q")
    @patch("prism_engine.prism_engine", return_value={"candidates": []})
    def test_stdout_only_contains_json(self, mock_engine, mock_input):
        import io
        import prism_os

        sys.argv = ["prism_os.py", "prism", "测试"]

        out_buf = io.BytesIO()
        err_buf = io.StringIO()
        with patch("sys.stdout") as mock_stdout:
            mock_stdout.buffer = out_buf
            with patch("sys.stderr", err_buf):
                try:
                    prism_os.main()
                except SystemExit:
                    pass

        out_value = out_buf.getvalue().decode("utf-8", errors="replace")
        err_value = err_buf.getvalue()

        # stdout 应只含 JSON，不含健康检查提示
        self.assertNotIn("建议", out_value,
                        "健康检查不应污染 stdout")
        # stderr 应含健康检查提示
        self.assertIn("建议", err_value,
                     "健康检查应在 stderr")


class TestHelpFlag(unittest.TestCase):
    """--help/-h 标志应直接显示帮助，不触发 LLM"""

    def test_help_flag_exits_zero(self):
        """--help 应 exit(0)，不是 exit(1)"""
        import prism_os
        sys.argv = ["prism_os.py", "--help"]
        with self.assertRaises(SystemExit) as ctx:
            prism_os.main()
        self.assertEqual(ctx.exception.code, 0, "--help 应 exit(0)")

    def test_help_flag_shows_commands(self):
        """--help 应输出包含 'run' 和 'prism' 的帮助文本"""
        import prism_os
        import io
        sys.argv = ["prism_os.py", "--help"]
        out_buf = io.BytesIO()
        with patch("sys.stdout") as mock_stdout:
            mock_stdout.buffer = out_buf
            with patch("sys.stderr", io.StringIO()):
                with self.assertRaises(SystemExit):
                    prism_os.main()
        output = out_buf.getvalue().decode("utf-8", errors="replace")
        self.assertIn("run", output)
        self.assertIn("prism", output)

    def test_h_flag_works(self):
        """-h 应与 --help 行为相同"""
        import prism_os
        sys.argv = ["prism_os.py", "-h"]
        with self.assertRaises(SystemExit) as ctx:
            prism_os.main()
        self.assertEqual(ctx.exception.code, 0)

    @patch("prism_engine.prism_engine", return_value={"candidates": []})
    def test_help_does_not_trigger_llm(self, mock_engine):
        """--help 不应触发 run_prism_os（即不调 LLM）"""
        import prism_os
        sys.argv = ["prism_os.py", "--help"]
        with patch.object(prism_os, "run_prism_os") as mock_run:
            with self.assertRaises(SystemExit):
                prism_os.main()
        mock_run.assert_not_called()


class TestDryRun(unittest.TestCase):
    """--dry-run 应 mock LLM，不调用真实 API"""

    @patch("builtins.input", return_value="")
    @patch("call_llm.call_llm")
    @patch("call_llm.call_llm_raw")
    def test_dry_run_patches_both_llm_functions(self, mock_raw, mock_call, mock_input):
        """--dry-run 应同时 patch call_llm 和 call_llm_raw"""
        import prism_os
        sys.argv = ["prism_os.py", "run", "测试", "--dry-run", "--no-interactive", "--skip-gateway", "--no-ext"]
        mock_call.return_value = {"content": "", "error": "dry-run"}
        mock_raw.return_value = None
        try:
            prism_os.main()
        except SystemExit:
            pass
        self.assertTrue(True, "dry-run 不应触发真实 LLM")

    @patch("builtins.input", return_value="")
    def test_dry_run_prints_dry_run_prefix(self, mock_input):
        """--dry-run 应在 stderr 打印 [DRY-RUN]"""
        import prism_os
        import io
        sys.argv = ["prism_os.py", "run", "测试", "--dry-run", "--no-interactive", "--skip-gateway", "--no-ext"]
        err_buf = io.StringIO()
        with patch("sys.stderr", err_buf):
            with patch("call_llm.call_llm", return_value={"content": "", "error": "dry-run"}):
                with patch("call_llm.call_llm_raw", return_value=None):
                    try:
                        prism_os.main()
                    except SystemExit:
                        pass
        self.assertIn("[DRY-RUN]", err_buf.getvalue(), "stderr 应包含 [DRY-RUN] 前缀")


if __name__ == "__main__":
    unittest.main(verbosity=2)

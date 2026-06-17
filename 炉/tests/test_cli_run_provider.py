"""CLI provider 参数测试"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from lu.cli.run import main


class TestCLIRunProvider:
    def test_dry_run_without_provider_still_works(self) -> None:
        ret = main(["测试命题", "--dry-run"])
        assert ret == 0

    def test_missing_provider_and_no_dry_run_errors(self) -> None:
        ret = main(["测试命题"])
        assert ret == 2

    def test_openai_provider_reads_env_key(self) -> None:
        with patch("lu.cli.run.OpenAIProvider") as mock_provider:
            mock_provider.return_value = lambda prompt: "echo"
            with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test"}):
                ret = main([
                    "测试命题",
                    "--provider", "openai",
                    "--model", "gpt-4",
                    "--dry-run",  # 仍用 echo LLM 避免真实调用
                ])
        # --dry-run 优先，不应实例化 OpenAIProvider
        mock_provider.assert_not_called()
        assert ret == 0

    def test_openai_provider_requires_api_key(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            ret = main(["测试命题", "--provider", "openai"])
        assert ret == 2

    @pytest.mark.slow
    def test_openai_fake_key_fails_gracefully(self) -> None:
        with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-fake"}):
            ret = main(["测试命题", "--provider", "openai"])
        assert ret == 2

    def test_echo_provider_runs_cleanly(self) -> None:
        ret = main(["测试命题", "--provider", "echo"])
        assert ret == 0

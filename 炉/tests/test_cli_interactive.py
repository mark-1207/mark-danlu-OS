"""CLI interactive 子命令测试"""
from __future__ import annotations

from unittest.mock import patch

from lu.cli.interactive import main as interactive_main
from lu.cli.run import main as run_main


class TestCLIInteractive:
    def test_interactive_dispatches_to_subcommand(self) -> None:
        with patch("lu.cli.run.cmd_interactive", return_value=0) as m:
            ret = run_main(["interactive", "测试"])
        m.assert_called_once()
        assert ret == 0

    def test_interactive_non_tty_errors(self) -> None:
        """非 TTY 环境（如 CI）应优雅退出并提示用 lu run"""
        with patch("lu.cli.interactive.sys.stdin.isatty", return_value=False):
            ret = interactive_main(["测试", "--dry-run"])
        assert ret == 2

    def test_interactive_subcommand_dry_run(self) -> None:
        import json
        refined = json.dumps({
            "surface": "s", "underlying": "u", "audience": "a",
            "style_recommendation": {"voice": "v", "tone": "t", "examples": []},
            "contrarian_candidates": [], "framework_candidates": [],
            "risks": [], "falsifiability": "",
        }, ensure_ascii=False)
        blueprint = json.dumps({
            "proposition": "p", "stance": "s", "audience": "a",
            "core_anti_consensus": "c", "cases": [], "data": [],
            "quotes": [], "forbidden": [],
        }, ensure_ascii=False)

        def llm(prompt: str) -> str:
            if "8 项 JSON" in prompt or "RefinedProposition" in prompt:
                return refined
            if "蓝图字段 JSON" in prompt:
                return blueprint
            if '"content"' in prompt and "self_confidence" in prompt:
                return json.dumps({"content": "x", "self_confidence": 0.5})
            if "score" in prompt and "details" in prompt:
                return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
            if "修复建议" in prompt:
                return json.dumps({"suggestion": "s"})
            if "内容资产提取器" in prompt:
                return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
            if "【思想模型" in prompt:
                return "m"
            return refined

        with patch("lu.cli.interactive.sys.stdin.isatty", return_value=True), \
             patch("lu.tui.prompts.Prompt.ask", return_value="a1"), \
             patch("lu.tui.prompts.Confirm.ask", return_value=True), \
             patch("rich.prompt.Prompt.ask", return_value="analysis"), \
             patch("lu.tui.sections.Confirm.ask", return_value=False), \
             patch("lu.cli.interactive._echo_llm", return_value=llm):
            from lu.config.loader import Framework, ThinkingModel
            from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry
            model_reg = ThinkingModelRegistry(
                models=[ThinkingModel(id="first_principles", name="第一性原理", definition="d")]
            )
            framework_reg = FrameworkRegistry(
                frameworks=[Framework(id="problem_decomposition", name="问题解构", strategy="chain", model_ids=["first_principles"], trigger_keywords=[])]
            )
            with patch("lu.cli.interactive.load_default_registries", return_value=(model_reg, framework_reg)):
                ret = interactive_main(["测试", "--dry-run"])
        assert ret == 0

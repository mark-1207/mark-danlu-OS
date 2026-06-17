"""CLI viral 子命令测试"""
from __future__ import annotations

from pathlib import Path

from lu.cli.run import main as run_main


class TestCLIViral:
    def test_viral_dry_run_with_local_file(self, tmp_path: Path) -> None:
        ref = tmp_path / "ref.md"
        ref.write_text("# 标题\n\n参考文章内容", encoding="utf-8")

        ret = run_main(["viral", "新命题", "--reference", str(ref), "--dry-run"])
        assert ret == 0

    def test_viral_dispatches(self, tmp_path: Path) -> None:
        ref = tmp_path / "ref.md"
        ref.write_text("参考", encoding="utf-8")
        with patch_viral_dispatch():
            ret = run_main(["viral", "x", "--reference", str(ref), "--dry-run"])
        assert ret == 0


def patch_viral_dispatch():
    """辅助：mock viral 内部 LLM 调用"""
    import json
    from unittest.mock import patch

    def llm(_prompt: str = "") -> str:
        if "爆款结构" in _prompt or "核心反共识" in _prompt:
            return json.dumps({
                "hook": "h", "contrarian": "c", "case_summary": "s",
                "thinking_model": "t", "closing_quote": "q",
                "key_terms": [], "contrarian_signals": [],
            }, ensure_ascii=False)
        if "蓝图字段" in _prompt:
            return json.dumps({
                "proposition": "p", "stance": "s", "audience": "a",
                "core_anti_consensus": "c", "cases": [], "data": [],
                "quotes": [], "forbidden": [],
            }, ensure_ascii=False)
        if '"content"' in _prompt and "self_confidence" in _prompt:
            return json.dumps({"content": "x", "self_confidence": 0.5})
        if "score" in _prompt and "details" in _prompt:
            return json.dumps({"score": 7.5, "details": {}, "suggestions": []})
        if "内容资产提取器" in _prompt:
            return json.dumps({"cases": [], "quotes": [], "insights": [], "contrarian_points": []})
        if "【思想模型" in _prompt:
            return "m"
        return "{}"

    from contextlib import ExitStack
    stack = ExitStack()
    stack.enter_context(patch("lu.cli.viral._echo_llm", return_value=llm))
    return stack

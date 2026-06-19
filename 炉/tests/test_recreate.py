"""recreate 模块测试

- loader：URL / file / run_id 三种来源
- directive：4 种方向检测 + 解析
- rewriter：5 段重写 + LLM 容错
- orchestrator 端到端：3 来源 + 改写指令
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from lu.config.loader import SocraticStopSignal, StyleProfile
from lu.draft.models import Draft
from lu.pipeline.orchestrator import Orchestrator
from lu.recreate import (
    RewriteDirection,
    RewriteDirective,
    detect_direction,
    generate_recreate_draft,
    load_from_file,
    load_from_url,
    parse_directive,
)
from lu.recreate.loader import SourceText, load_source, load_from_run_id
from lu.store.file_store import FileStore
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


class TestLoader:
    def test_load_from_file(self, tmp_path: Path) -> None:
        f = tmp_path / "article.md"
        f.write_text("# 标题\n\n第一段内容。\n\n第二段。", encoding="utf-8")
        src = load_from_file(f)
        assert isinstance(src, SourceText)
        assert src.source_kind == "file"
        assert "标题" in src.text
        assert src.title == "article"

    def test_load_from_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError):
            load_from_file("/nonexistent/path.md")

    def test_load_from_url_strips_html(self) -> None:
        html = "<html><head><title>测试标题</title></head><body><script>x</script><p>正文<p>两段</body></html>"
        with patch("httpx.Client.get") as mock_get:
            mock_get.return_value.text = html
            mock_get.return_value.raise_for_status = lambda: None
            src = load_from_url("http://example.com")
        assert "测试标题" in src.title
        assert "正文" in src.text
        assert "x" not in src.text or "正文" in src.text  # script 内容去除
        assert "<script>" not in src.text

    def test_load_source_requires_one(self) -> None:
        with pytest.raises(ValueError, match="必须提供"):
            load_source()

    def test_load_source_rejects_two(self) -> None:
        with pytest.raises(ValueError, match="只能提供一种"):
            load_source(from_url="http://x", from_file="/y")

    def test_load_from_run_id(self, tmp_path: Path) -> None:
        from lu.draft.models import Draft
        from lu.pipeline.models import Context

        fs = FileStore(tmp_path / "runs")
        ctx = Context(
            proposition_cleaned="x",
            run_id="r1",
            draft=Draft(
                title="T",
                sections=[],
                total_word_count=10,
            ),
        )
        fs.save("r1", "context", ctx)
        src = load_from_run_id("r1", fs)
        assert src.source_kind == "run"
        assert "T" in src.text


class TestDirective:
    def test_parse_directive_basic(self) -> None:
        d = parse_directive("改写得更犀利")
        assert d.raw == "改写得更犀利"
        assert d.direction == RewriteDirection.PRESERVE_STANCE  # 默认

    def test_parse_directive_switch_view(self) -> None:
        d = parse_directive("从对立视角重写")
        assert d.direction == RewriteDirection.SWITCH_VIEW

    def test_parse_directive_restructure(self) -> None:
        d = parse_directive("重写结构")
        assert d.direction == RewriteDirection.REWRITE_STRUCT

    def test_parse_directive_free_rewrite(self) -> None:
        d = parse_directive("完全重写")
        assert d.direction == RewriteDirection.REWRITE_FREE

    def test_parse_directive_empty_raises(self) -> None:
        with pytest.raises(ValueError, match="不能为空"):
            parse_directive("")

    def test_detect_direction_default(self) -> None:
        assert detect_direction("some random text") == RewriteDirection.PRESERVE_STANCE


class TestRewriter:
    def test_generate_recreate_draft_basic(self) -> None:
        def llm(prompt: str) -> str:
            return json.dumps({
                "title": "新标题",
                "sections": {
                    "hook": "开篇钩子内容",
                    "anti_consensus": "反共识论点",
                    "case": "具体案例",
                    "thinking": "思考分析",
                    "closing": "收尾",
                },
            }, ensure_ascii=False)

        source = SourceText(
            text="原文章内容" * 50,
            source_kind="file",
            source_id="/tmp/article.md",
            title="原标题",
        )
        directive = RewriteDirective(raw="改写", direction=RewriteDirection.PRESERVE_STANCE)

        draft = generate_recreate_draft(source, directive, llm)
        assert isinstance(draft, Draft)
        assert draft.title == "新标题"
        assert len(draft.sections) == 5
        assert draft.sections[0].role.value == "hook"
        assert draft.sections[1].role.value == "anti_consensus"
        assert "开篇钩子" in draft.sections[0].content

    def test_generate_recreate_draft_handles_code_fence(self) -> None:
        def llm(prompt: str) -> str:
            return "```json\n" + json.dumps({
                "title": "T",
                "sections": {"hook": "x", "anti_consensus": "y", "case": "z", "thinking": "w", "closing": "v"},
            }) + "\n```"

        source = SourceText(text="src" * 50, source_kind="file", source_id="x")
        directive = RewriteDirective(raw="r", direction=RewriteDirection.PRESERVE_STANCE)
        draft = generate_recreate_draft(source, directive, llm)
        assert draft.sections[0].content == "x"

    def test_generate_recreate_draft_invalid_json_raises(self) -> None:
        def llm(prompt: str) -> str:
            return "not json"

        source = SourceText(text="src" * 50, source_kind="file", source_id="x")
        directive = RewriteDirective(raw="r", direction=RewriteDirection.PRESERVE_STANCE)
        with pytest.raises(ValueError, match="不是合法 JSON"):
            generate_recreate_draft(source, directive, llm)


class TestOrchestratorRecreate:
    def _style(self) -> StyleProfile:
        return StyleProfile(
            socratic_stop_signal=SocraticStopSignal(
                saturation_keywords=["够了"], typical_rounds=2
            )
        )

    def _llm(self, rewrite_resp: dict | None = None, struct_resp: dict | None = None):
        def llm(prompt: str) -> str:
            if "5 段长文" in prompt or "新标题" in prompt:
                return json.dumps(rewrite_resp or {
                    "title": "重写标题",
                    "sections": {
                        "hook": "开篇钩子",
                        "anti_consensus": "反共识",
                        "case": "案例",
                        "thinking": "思考",
                        "closing": "收尾",
                    },
                }, ensure_ascii=False)
            if "提取" in prompt or "结构" in prompt:
                return json.dumps(struct_resp or {
                    "hook": "原 hook",
                    "contrarian": "原 contrarian",
                    "case": "原 case",
                    "closing": "原 closing",
                }, ensure_ascii=False)
            return "{}"
        return llm

    def _orch(self) -> Orchestrator:
        sp = self._style()
        fr = FrameworkRegistry([])
        mr = ThinkingModelRegistry([])
        return Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr, mode="recreate")

    def test_recreate_from_file_runs_7_states(self, tmp_path: Path) -> None:
        f = tmp_path / "article.md"
        f.write_text("# 原标题\n\n原文章内容" * 30, encoding="utf-8")
        orch = self._orch()
        ctx = orch.run(
            proposition="重写命题",
            llm_call=self._llm(),
            recreate_args={
                "from_file": str(f),
                "instruction": "改写得更犀利",
            },
        )
        assert ctx.state.value == "completed"
        assert ctx.mode == "recreate"
        assert ctx.draft is not None
        assert len(ctx.draft.sections) == 5
        assert ctx.recreate_source_text != ""
        assert ctx.recreate_direction == "preserve_stance"

    def test_recreate_requires_both_source_and_instruction(self, tmp_path: Path) -> None:
        f = tmp_path / "article.md"
        f.write_text("x" * 200, encoding="utf-8")
        orch = self._orch()
        with pytest.raises(ValueError, match="必须提供.*instruction"):
            orch.run(
                proposition="x",
                llm_call=self._llm(),
                recreate_args={"from_file": str(f)},
            )

    def test_recreate_direction_inference(self, tmp_path: Path) -> None:
        f = tmp_path / "article.md"
        f.write_text("x" * 200, encoding="utf-8")
        orch = self._orch()
        ctx = orch.run(
            proposition="x",
            llm_call=self._llm(),
            recreate_args={"from_file": str(f), "instruction": "换视角重写"},
        )
        assert ctx.recreate_direction == "switch_view"

    def test_recreate_default_no_harvest(self, tmp_path: Path) -> None:
        """recreate 模式：COMPLETED 步的 prompt_variant=recreate_persist 跳过 harvest"""
        f = tmp_path / "article.md"
        f.write_text("x" * 200, encoding="utf-8")
        orch = self._orch()
        ctx = orch.run(
            proposition="x",
            llm_call=self._llm(),
            recreate_args={"from_file": str(f), "instruction": "r"},
        )
        # recreate 不沉淀（原文已存在）
        assert ctx.harvested is None
        # 但有 L1 quality_report
        assert ctx.quality_report is not None

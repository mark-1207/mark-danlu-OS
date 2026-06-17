"""Obsidian 写入器测试

- 写入 harvested cases/quotes/insights
- frontmatter 正确
- 文件名安全化
- vault 路径不存在时创建
"""
from __future__ import annotations

from pathlib import Path

from lu.blueprint.models import Case, Quote
from lu.sediment.models import Harvested, Insight
from lu.sediment.obsidian_writer import ObsidianWriter
from lu.socratic.output import ContrarianPoint


class TestObsidianWriter:
    def test_writes_case_to_atomic_library(self, tmp_path: Path) -> None:
        writer = ObsidianWriter(tmp_path)
        harvested = Harvested(
            cases=[Case(title="朋友A", summary="用 LLM 两年工资没涨")],
        )

        paths = writer.write_harvested(harvested, run_id="2026-06-17_test")

        assert len(paths) == 1
        assert paths[0].is_file()
        text = paths[0].read_text(encoding="utf-8")
        assert "type: case" in text
        assert "source_run: 2026-06-17_test" in text
        assert "朋友A" in text

    def test_writes_quote_to_atomic_library(self, tmp_path: Path) -> None:
        writer = ObsidianWriter(tmp_path)
        harvested = Harvested(
            quotes=[Quote(text="AI 是杠杆", author="Sam")],
        )

        paths = writer.write_harvested(harvested, run_id="2026-06-17_test")

        assert len(paths) == 1
        text = paths[0].read_text(encoding="utf-8")
        assert "type: quote" in text
        assert '"AI 是杠杆"' in text

    def test_writes_insight_to_insight_library(self, tmp_path: Path) -> None:
        writer = ObsidianWriter(tmp_path)
        harvested = Harvested(
            insights=[Insight(text="杠杆不增工资", tags=["杠杆者"])],
        )

        paths = writer.write_harvested(harvested, run_id="2026-06-17_test")

        assert len(paths) == 1
        text = paths[0].read_text(encoding="utf-8")
        assert "type: insight" in text
        assert "洞察库" in str(paths[0])
        assert "原子库" not in str(paths[0])
        assert "杠杆者" in text

    def test_sanitizes_filename(self, tmp_path: Path) -> None:
        writer = ObsidianWriter(tmp_path)
        harvested = Harvested(
            cases=[Case(title="AI: 牛马陷阱？", summary="...")],
        )

        paths = writer.write_harvested(harvested, run_id="r")
        assert "AI_牛马陷阱" in paths[0].name
        assert ":" not in paths[0].name

    def test_skips_empty_harvested(self, tmp_path: Path) -> None:
        writer = ObsidianWriter(tmp_path)
        paths = writer.write_harvested(Harvested(), run_id="r")
        assert paths == []

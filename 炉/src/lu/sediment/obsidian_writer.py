"""Obsidian 写入器

将沉淀产物写入 Obsidian vault：
- cases / quotes → 40_知识库/原子库/
- insights → 40_知识库/洞察库/

参考 legacy: docs/legacy/prismos/skills/rss-hunter/scripts/obsidian_writer.py
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from lu.sediment.models import Harvested


ATOMIC_SUBDIR = "40_知识库/原子库"
INSIGHT_SUBDIR = "40_知识库/洞察库"


class ObsidianWriter:
    """Obsidian vault 写入器"""

    def __init__(self, vault_path: Path | str) -> None:
        self.vault_path = Path(vault_path)

    def write_harvested(
        self,
        harvested: Harvested,
        run_id: str,
        tags: list[str] | None = None,
    ) -> list[Path]:
        """将 Harvested 写入 Obsidian，返回写入的文件路径列表"""
        common_tags = tags or []
        written: list[Path] = []

        for case in harvested.cases:
            path = self._write_case(case, run_id, common_tags)
            written.append(path)

        for quote in harvested.quotes:
            path = self._write_quote(quote, run_id, common_tags)
            written.append(path)

        for insight in harvested.insights:
            path = self._write_insight(insight, run_id, common_tags)
            written.append(path)

        return written

    def _write_case(self, case, run_id: str, tags: list[str]) -> Path:
        title = case.title or "untitled"
        filename = f"Case_{_sanitize_filename(title)}"
        frontmatter = _build_frontmatter(
            type="case",
            source_run=run_id,
            tags=tags,
            created=_today(),
        )
        body = f"# {title}\n\n## 简述\n{case.summary}\n"
        if case.source:
            body += f"\n## 来源\n{case.source}\n"
        return self._save(ATOMIC_SUBDIR, filename, frontmatter, body)

    def _write_quote(self, quote, run_id: str, tags: list[str]) -> Path:
        text = quote.text or "untitled"
        filename = f"Quote_{_sanitize_filename(text[:30])}"
        frontmatter = _build_frontmatter(
            type="quote",
            source_run=run_id,
            tags=tags,
            created=_today(),
            author=quote.author or "匿名",
        )
        body = f'> "{text}"\n\n— {quote.author or "匿名"}\n'
        return self._save(ATOMIC_SUBDIR, filename, frontmatter, body)

    def _write_insight(self, insight, run_id: str, tags: list[str]) -> Path:
        text = insight.text or "untitled"
        filename = f"Insight_{_sanitize_filename(text[:30])}"
        all_tags = list(tags) + list(insight.tags)
        frontmatter = _build_frontmatter(
            type="insight",
            source_run=run_id,
            tags=all_tags,
            created=_today(),
        )
        body = f"# 洞察\n\n{text}\n\n## 来源\n{insight.source}\n"
        return self._save(INSIGHT_SUBDIR, filename, frontmatter, body)

    def _save(self, subdir: str, filename: str, frontmatter: str, body: str) -> Path:
        dir_path = self.vault_path / subdir
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{filename}.md"
        file_path.write_text(f"{frontmatter}\n{body}", encoding="utf-8")
        return file_path


def _sanitize_filename(title: str, max_len: int = 60) -> str:
    # 替换英文非法字符 + 中英文标点/空白
    safe = re.sub(r'[\s<>:"/\\|?*]', "_", title)
    safe = re.sub(r"[，。？！；：""''（）【】、]", "_", safe)
    safe = re.sub(r"_+", "_", safe).strip("_")
    if len(safe) > max_len:
        safe = safe[:max_len].rstrip("_")
    return safe or "untitled"


def _build_frontmatter(**fields) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, list):
            if value:
                items = ", ".join(str(v) for v in value)
                lines.append(f"{key}: [{items}]")
            else:
                lines.append(f"{key}: []")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

"""recreate 原文加载器

从 3 种来源加载原文：
- URL：HTTP fetch + HTML 清洗
- 本地文件：直接读
- run_id：从 FileStore 加载之前 run 的 draft

所有加载器返回 SourceText dataclass，包含原文 + 来源元信息。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from lu.store.file_store import FileStore


@dataclass(frozen=True)
class SourceText:
    """原文 + 来源元信息"""

    text: str
    source_kind: str  # "url" | "file" | "run"
    source_id: str  # URL / 文件路径 / run_id
    title: str = ""


def _strip_html(html: str) -> str:
    """极简 HTML 清洗：去标签 + 折叠空白"""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _extract_title(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ""


def load_from_url(url: str, timeout_sec: float = 15.0) -> SourceText:
    """从 URL 加载原文（HTTP fetch + HTML 清洗）"""
    import httpx

    with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
        response = client.get(url, headers={"User-Agent": "lu-bot/1.0"})
        response.raise_for_status()
        html = response.text

    text = _strip_html(html)
    title = _extract_title(html)
    return SourceText(
        text=text,
        source_kind="url",
        source_id=url,
        title=title,
    )


def load_from_file(path: str | Path) -> SourceText:
    """从本地文件加载原文"""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"文件不存在: {path}")
    text = p.read_text(encoding="utf-8")
    title = p.stem
    return SourceText(
        text=text,
        source_kind="file",
        source_id=str(p.absolute()),
        title=title,
    )


def load_from_run_id(
    run_id: str, file_store: "FileStore"
) -> SourceText:
    """从 FileStore 加载之前 run 的 draft"""
    from lu.draft.models import Draft
    from lu.pipeline.models import Context

    ctx = file_store.load(run_id, "context", Context)
    if ctx.draft is None:
        raise ValueError(f"run {run_id} 没有 draft")
    text = _build_text_from_draft(ctx.draft)
    return SourceText(
        text=text,
        source_kind="run",
        source_id=run_id,
        title=ctx.draft.title,
    )


def _build_text_from_draft(draft) -> str:
    """从 Draft 重建完整文本（标题 + 各段）"""
    parts: list[str] = []
    if draft.title:
        parts.append(f"# {draft.title}\n")
    for section in draft.sections:
        if section.content:
            parts.append(f"\n## {section.role.value}\n\n{section.content}")
    return "\n".join(parts).strip()


def load_source(
    *,
    from_url: str | None = None,
    from_file: str | None = None,
    from_run_id: str | None = None,
    file_store: "FileStore | None" = None,
) -> SourceText:
    """统一入口：3 选 1"""
    sources = [("from_url", from_url), ("from_file", from_file), ("from_run_id", from_run_id)]
    provided = [(k, v) for k, v in sources if v]
    if len(provided) == 0:
        raise ValueError("recreate 必须提供 --from-url / --from-file / --from-run-id 之一")
    if len(provided) > 1:
        raise ValueError(
            f"recreate 只能提供一种来源，但收到: {[k for k, _ in provided]}"
        )
    kind, value = provided[0]
    if kind == "from_url":
        return load_from_url(value)  # type: ignore[arg-type]
    if kind == "from_file":
        return load_from_file(value)  # type: ignore[arg-type]
    if file_store is None:
        raise ValueError("recreate --from-run-id 需要 file_store")
    return load_from_run_id(value, file_store)  # type: ignore[arg-type]


__all__ = [
    "SourceText",
    "load_from_file",
    "load_from_run_id",
    "load_from_url",
    "load_source",
]

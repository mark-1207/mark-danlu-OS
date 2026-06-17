"""参考文章摄入：URL 抓取 + 本地文件

- 不引入 BeautifulSoup（避免依赖）
- HTML 简单去标签：re 去掉 <...>
- 错误：超时 / 不存在 → IngestError
"""
from __future__ import annotations

import re
from pathlib import Path

import httpx


class IngestError(Exception):
    """摄入错误"""


_TAG_RE = re.compile(r"<[^>]+>")
_MULTI_BLANK_RE = re.compile(r"\n\s*\n+")


def _html_to_text(html: str) -> str:
    """简易 HTML → 文本"""
    text = _TAG_RE.sub(" ", html)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = _MULTI_BLANK_RE.sub("\n\n", text)
    return text.strip()


def fetch_url(url: str, timeout: int = 30) -> str:
    """从 URL 抓取文章正文"""
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
    except httpx.TimeoutException as e:
        raise IngestError(f"抓取超时: {url}: {e}") from e
    except httpx.HTTPError as e:
        raise IngestError(f"HTTP 错误: {url}: {e}") from e

    try:
        resp.raise_for_status()
    except Exception as e:
        raise IngestError(f"抓取失败 ({resp.status_code}): {url}") from e

    return _html_to_text(resp.text)


def read_file(path: Path | str) -> str:
    """从本地文件读文章正文"""
    p = Path(path)
    if not p.is_file():
        raise IngestError(f"文件不存在: {p}")
    try:
        return p.read_text(encoding="utf-8")
    except UnicodeDecodeError as e:
        raise IngestError(f"文件不是 UTF-8: {p}: {e}") from e


__all__ = ["IngestError", "fetch_url", "read_file", "_html_to_text"]

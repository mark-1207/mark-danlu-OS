"""参考文章摄入测试

- fetch_url: mock httpx，验证 HTML→text 清理
- read_file: 读 .md / .txt
- 错误：超时 / 不存在
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from lu.ingest.article import IngestError, fetch_url, read_file


class TestFetchUrl:
    def test_parses_html(self) -> None:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = (
            "<html><body><h1>标题</h1>"
            "<p>第一段内容。</p>"
            "<p>第二段内容。</p>"
            "</body></html>"
        )
        mock_resp.raise_for_status = MagicMock()

        with patch("lu.ingest.article.httpx.get", return_value=mock_resp) as g:
            text = fetch_url("https://example.com/x")

        assert "标题" in text
        assert "第一段" in text
        assert "<" not in text  # 标签被清掉
        g.assert_called_once()

    def test_raises_on_http_error(self) -> None:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.raise_for_status.side_effect = Exception("404")
        with patch("lu.ingest.article.httpx.get", return_value=mock_resp):
            with pytest.raises(IngestError):
                fetch_url("https://example.com/404")

    def test_raises_on_timeout(self) -> None:
        import httpx
        with patch("lu.ingest.article.httpx.get", side_effect=httpx.TimeoutException("timeout")):
            with pytest.raises(IngestError):
                fetch_url("https://example.com/slow")


class TestReadFile:
    def test_reads_md(self, tmp_path: Path) -> None:
        p = tmp_path / "art.md"
        p.write_text("# 标题\n\n内容", encoding="utf-8")
        text = read_file(p)
        assert "标题" in text
        assert "内容" in text

    def test_reads_txt(self, tmp_path: Path) -> None:
        p = tmp_path / "art.txt"
        p.write_text("纯文本", encoding="utf-8")
        text = read_file(p)
        assert "纯文本" in text

    def test_raises_on_missing(self, tmp_path: Path) -> None:
        with pytest.raises(IngestError):
            read_file(tmp_path / "nope.md")

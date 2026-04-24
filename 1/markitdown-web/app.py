import subprocess
import tempfile
import os
import re
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse
from starlette.requests import Request
from starlette.formparsers import MultiPartParser

app = FastAPI(title="Markitdown Web")

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)


def convert_markitdown(content: bytes, filename: str, keep_data_uris: bool = False) -> str:
    """Convert file to markdown using markitdown."""
    tmpdir = Path(tempfile.gettempdir())
    file_id = os.urandom(8).hex()
    input_path = tmpdir / f"md_input_{file_id}{Path(filename).suffix}"
    output_path = tmpdir / f"md_output_{file_id}.md"

    # Write input file
    with open(input_path, 'wb') as f:
        f.write(content)

    try:
        args = ["python", "-m", "markitdown", str(input_path), "-o", str(output_path)]
        if keep_data_uris:
            args.append("--keep-data-uris")

        result = subprocess.run(args, capture_output=True, timeout=180)
        if result.returncode != 0:
            error_msg = result.stderr.decode('utf-8', errors='replace') if result.stderr else "markitdown failed"
            raise RuntimeError(f"markitdown error: {error_msg}")

        if output_path.exists():
            raw = output_path.read_bytes()
            return decode_mixed_output(raw)
        raise RuntimeError("markitdown did not produce output file")
    finally:
        try:
            os.unlink(input_path)
        except:
            pass
        try:
            os.unlink(output_path)
        except:
            pass


def decode_mixed_output(data: bytes) -> str:
    """Decode output that may contain GBK encoded Chinese characters.

    GBK uses 2-byte sequences where both bytes have high bits set (0x81-0xFE).
    UTF-8 uses 2-4 byte sequences where continuation bytes are 0x80-0xBF.
    This function tries to detect which encoding was used.
    """
    if not data:
        return ""

    # Count GBK lead bytes (0x81-0xFE appearing at positions 0, 1 mod 2 in suspicious positions)
    # More reliable: try decoding both and pick the better result
    try:
        gbk_result = data.decode('gbk', errors='replace')
        utf8_result = data.decode('utf-8', errors='replace')

        # Count replacement characters - fewer = better encoding
        gbk_replacements = gbk_result.count('\ufffd')
        utf8_replacements = utf8_result.count('\ufffd')

        # If GBK has fewer or no replacements, it's likely GBK
        if gbk_replacements < utf8_replacements:
            return gbk_result
        return utf8_result
    except Exception:
        pass

    # Fallback
    try:
        return data.decode('utf-8', errors='replace')
    except Exception:
        return data.decode('latin-1', errors='replace')


def extract_meta_from_markdown(markdown: str) -> dict:
    """Extract metadata from converted markdown."""
    meta = {
        "title": "",
        "author": "",
        "word_count": 0,
        "reading_time": "",
        "date": "",
        "summary": "",
        "tags": [],
        "cover_image": "",
        "sections": [],
        "language": ""
    }

    lines = markdown.split('\n')
    captured_sections = []
    found_meta_block = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        if stripped.startswith('# ') and not meta["title"]:
            meta["title"] = stripped[2:].strip()
            continue

        if stripped == '---':
            found_meta_block = True
            continue

        if found_meta_block and not meta["summary"] and stripped and len(stripped) > 50:
            if not stripped.startswith('#') and not stripped.startswith('!['):
                if '标签' not in stripped and '来源' not in stripped and '信息' not in stripped:
                    clean_summary = stripped.replace('**', '').replace('*', '').strip()
                    meta["summary"] = clean_summary[:200] + ('...' if len(clean_summary) > 200 else '')
                    continue

        if not meta["word_count"]:
            wc = re.search(r'约\s*(\d+)\s*字', stripped)
            if wc:
                meta["word_count"] = int(wc.group(1))
            elif re.search(r'(\d{4,6})\s*字', stripped):
                match = re.search(r'(\d{4,6})\s*字', stripped)
                if match:
                    meta["word_count"] = int(match.group(1))

        if not meta["reading_time"]:
            rt = re.search(r'阅读[约\s]*(\d+)\s*分钟', stripped)
            if rt:
                meta["reading_time"] = f"约 {rt.group(1)} 分钟"

        if not meta["date"]:
            date_patterns = [
                r'整理日期[:：]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})',
                r'发布[:：]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})',
                r'(\d{4}年\d{1,2}月\d{1,2}日)',
                r'(\d{4}-\d{2}-\d{2})',
            ]
            for pattern in date_patterns:
                m = re.search(pattern, stripped)
                if m:
                    meta["date"] = m.group(1)
                    break

        if not meta["author"] and i > 1 and i < 15:
            if re.match(r'^[a-zA-Z0-9_\u4e00-\u9fa5]{2,30}$', stripped):
                if stripped not in ['原创', '编辑', '来源', '作者'] and not stripped.startswith('#'):
                    meta["author"] = stripped

        if not meta["cover_image"]:
            img = re.search(r'!\[.*?\]\((https?://mmbiz\.qpic\.cn[^\)]+)\)', stripped)
            if img:
                meta["cover_image"] = img.group(1)

        if not meta["tags"]:
            tag_match = re.search(r'标签[:：]\s*(.+)', stripped)
            if tag_match:
                meta["tags"] = [t.strip() for t in re.split(r'[,，]', tag_match.group(1)) if t.strip()]

        if stripped.startswith('## '):
            section_name = stripped[3:].strip()
            if section_name and len(section_name) < 60:
                captured_sections.append(section_name)

    meta["sections"] = captured_sections[:6]
    return meta


@app.get("/", response_class=HTMLResponse)
async def index():
    html = STATIC_DIR / "index.html"
    if html.exists():
        return HTMLResponse(html.read_text(encoding="utf-8"))
    return """<!DOCTYPE html><html><head><title>Markitdown Web</title></head><body><h1>Markitdown Web</h1><p>static/index.html not found</p></body></html>"""


@app.post("/convert/text")
async def convert_text(request: Request):
    """Handle text conversion - uses JSON body to avoid python-multipart # parsing bug."""
    try:
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            body = await request.json()
        else:
            # Fallback: try to parse as JSON anyway (modern clients should send JSON)
            body = await request.json()

        content = body.get("content", "")
        filename = body.get("filename", "input.txt")
        keep_data_uris = body.get("keep_data_uris", False)
        batch = body.get("batch", False)

        if not content:
            raise HTTPException(status_code=400, detail="Content is required")

        result = convert_markitdown(content.encode("utf-8"), filename, keep_data_uris)
        meta = extract_meta_from_markdown(result) if not batch else {}
        return {"success": True, "markdown": result, "filename": filename, "meta": meta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert/file")
async def convert_file(
    file: UploadFile = File(...),
    keep_data_uris: bool = Form(False)
):
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        result = convert_markitdown(content, file.filename or "input", keep_data_uris)
        meta = extract_meta_from_markdown(result)
        return {"success": True, "markdown": result, "filename": file.filename, "meta": meta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/convert/url")
async def convert_url(
    url: str = Form(...),
    keep_data_uris: bool = Form(False),
    batch: bool = Form(False)
):
    import urllib.request, urllib.error

    tmp_path = Path(tempfile.gettempdir()) / f"markitdown_url_{os.urandom(8).hex()}"

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://mp.weixin.qq.com/',
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            tmp_path.write_bytes(content)

        result = convert_markitdown(content, tmp_path.name, keep_data_uris)
        meta = extract_meta_from_markdown(result) if not batch else {}

        url_filename = url.split('/')[-1].split('?')[0] or "url_output"

        return {"success": True, "markdown": result, "filename": url_filename, "meta": meta}
    except urllib.error.URLError as e:
        raise HTTPException(status_code=400, detail=f"URL fetch failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5188)
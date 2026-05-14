#!/usr/bin/env python3
"""
RSS-Hunter Obsidian 写入模块
将 RSS 条目（有裂缝/无裂缝）写入 Obsidian vault

用法:
    from obsidian_writer import write_crack, write_item
"""

import sys
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# ============ 配置 ============

DEFAULT_VAULT_PATH = r"D:\软件\obsidian笔记\内容素材库"
CRACK_SUBDIR = "40_知识库/洞察库/rss-cracks"
ITEM_SUBDIR = "40_知识库/原子库/rss-items"


def _safe_print(text: str):
    """Windows GBK 安全输出"""
    try:
        print(text)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(text.encode("utf-8"))
        sys.stdout.buffer.write(b"\n")


def _get_vault_path() -> Path:
    """获取 Obsidian vault 路径（环境变量优先）"""
    import os
    env_path = os.environ.get("OBSIDIAN_VAULT_PATH")
    if env_path:
        return Path(env_path)
    return Path(DEFAULT_VAULT_PATH)


def _sanitize_filename(title: str, max_len: int = 80) -> str:
    """将标题转为安全文件名"""
    # 移除 Windows 不允许的字符
    safe = re.sub(r'[<>:"/\\|?*]', '', title)
    # 移除换行和多余空格
    safe = re.sub(r'\s+', ' ', safe).strip()
    # 截断
    if len(safe) > max_len:
        safe = safe[:max_len].rstrip()
    return safe or "untitled"


def _build_frontmatter(fields: Dict) -> str:
    """生成 YAML frontmatter"""
    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, list):
            lines.append(f"{key}: [{', '.join(str(v) for v in value)}]")
        elif isinstance(value, float):
            lines.append(f"{key}: {value}")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def write_crack(
    title: str,
    summary: str,
    source: str,
    category: str,
    tags: List[str],
    url: str,
    crack_type: str,
    confidence: float,
    consensus: str,
    reality: str,
    vault_path: Optional[Path] = None,
) -> Optional[Path]:
    """
    将有裂缝的条目写入 Obsidian 洞察库

    Args:
        title: 文章标题
        summary: 摘要内容
        source: 信源名称
        category: 分类
        tags: 标签列表
        url: 原文链接
        crack_type: 裂缝类型
        confidence: 置信度 (0.0-1.0)
        consensus: 共识
        reality: 现实
        vault_path: vault 路径（默认从环境变量或默认值）

    Returns:
        写入的文件路径，失败返回 None
    """
    if vault_path is None:
        vault_path = _get_vault_path()

    # 构建目录
    crack_dir = vault_path / CRACK_SUBDIR
    crack_dir.mkdir(parents=True, exist_ok=True)

    # 构建文件名
    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"{today}-{_sanitize_filename(title)}.md"
    filepath = crack_dir / filename

    # 构建 frontmatter
    frontmatter = _build_frontmatter({
        "source": source,
        "category": category,
        "tags": tags,
        "date": today,
        "url": url,
        "crack_type": crack_type,
        "confidence": confidence,
    })

    # 构建内容
    content = f"""{frontmatter}

# {title}

{summary}

## 认知裂缝
- 共识：{consensus}
- 现实：{reality}
- 裂缝类型：{crack_type}
- 置信度：{confidence * 100:.0f}%
"""

    try:
        filepath.write_text(content, encoding="utf-8")
        _safe_print(f"[写入] 裂缝 → {filepath.name}")
        return filepath
    except Exception as e:
        _safe_print(f"[Error] 写入失败 {filepath}: {e}")
        return None


def write_item(
    title: str,
    summary: str,
    source: str,
    category: str,
    tags: List[str],
    url: str,
    vault_path: Optional[Path] = None,
) -> Optional[Path]:
    """
    将无裂缝的条目写入 Obsidian 原子库

    Args:
        title: 文章标题
        summary: 摘要内容
        source: 信源名称
        category: 分类
        tags: 标签列表
        url: 原文链接
        vault_path: vault 路径（默认从环境变量或默认值）

    Returns:
        写入的文件路径，失败返回 None
    """
    if vault_path is None:
        vault_path = _get_vault_path()

    # 构建目录
    item_dir = vault_path / ITEM_SUBDIR
    item_dir.mkdir(parents=True, exist_ok=True)

    # 构建文件名
    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"{today}-{_sanitize_filename(title)}.md"
    filepath = item_dir / filename

    # 构建 frontmatter
    frontmatter = _build_frontmatter({
        "source": source,
        "category": category,
        "tags": tags,
        "date": today,
        "url": url,
    })

    # 构建内容
    content = f"""{frontmatter}

# {title}

{summary}
"""

    try:
        filepath.write_text(content, encoding="utf-8")
        _safe_print(f"[写入] 普通 → {filepath.name}")
        return filepath
    except Exception as e:
        _safe_print(f"[Error] 写入失败 {filepath}: {e}")
        return None


# ============ CLI 测试 ============

if __name__ == "__main__":
    _safe_print("obsidian_writer.py - Obsidian 写入模块测试")

    _safe_print("\n[测试] _sanitize_filename...")
    _safe_print(f"  'AI 让程序员失业？' → '{_sanitize_filename('AI 让程序员失业？')}'")
    _safe_print(f"  'Test: <invalid> chars' → '{_sanitize_filename('Test: <invalid> chars')}'")

    _safe_print("\n[测试] _build_frontmatter...")
    fm = _build_frontmatter({"source": "36氪", "tags": ["AI", "科技"], "confidence": 0.85})
    _safe_print(fm)

    _safe_print("\n测试完成！")

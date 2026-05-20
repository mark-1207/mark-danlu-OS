#!/usr/bin/env python3
"""
PRISM-OS Obsidian 知识网关模块
扫描 Obsidian Vault，检索素材供 gap_analysis 使用

用法:
    from obsidian_knowledge import scan_vault, full_text_search, match_topics
"""

import os
import re
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# ============ 配置 ============

# Obsidian Vault 路径
DEFAULT_VAULT_PATH = Path(r"D:\软件\obsidian笔记\内容素材库")
KNOWLEDGE_DIR = "40_知识库"

# 质量阈值
QUALITY_THRESHOLD = 7


# ============ 辅助函数 ============

def _read_file(file_path: Path) -> str:
    """读取文件内容"""
    if file_path.exists():
        return file_path.read_text(encoding="utf-8")
    return ""


def _parse_frontmatter(content: str) -> Dict:
    """
    解析 YAML frontmatter

    Returns:
        Dict: frontmatter 键值对，解析失败返回空 dict
    """
    if not content.startswith("---"):
        return {}

    end_marker = content.find("\n---", 3)
    if end_marker == -1:
        return {}

    frontmatter_text = content[3:end_marker].strip()

    try:
        return yaml.safe_load(frontmatter_text) or {}
    except:
        return {}


def _extract_body(content: str) -> str:
    """提取正文文本（去除 frontmatter）"""
    if not content.startswith("---"):
        return content

    end_marker = content.find("\n---", 3)
    if end_marker == -1:
        return content

    return content[end_marker + 4:].strip()


def _score_to_float(score: str) -> float:
    """将评分转换为浮点数"""
    try:
        return float(score)
    except:
        return 0.0


# ============ 2.13 scan_vault ============

def scan_vault(vault_path: Path = None) -> List[Dict]:
    """
    扫描 Vault 目录结构

    Args:
        vault_path: Vault 路径，默认使用 DEFAULT_VAULT_PATH

    Returns:
        List of Dict: [{"path": str, "type": str, "name": str}, ...]
    """
    if vault_path is None:
        vault_path = DEFAULT_VAULT_PATH

    if not vault_path.exists():
        print(f"[Warning] Vault 路径不存在: {vault_path}")
        return []

    knowledge_path = vault_path / KNOWLEDGE_DIR
    if not knowledge_path.exists():
        print(f"[Warning] 知识库目录不存在: {knowledge_path}")
        return []

    files = []

    # 扫描知识库子目录
    subdirs = ["洞察库", "金句库", "原子库", "思维模型", "人生哲学"]

    for subdir in subdirs:
        subdir_path = knowledge_path / subdir
        if not subdir_path.exists():
            continue

        for md_file in subdir_path.glob("**/*.md"):
            files.append({
                "path": str(md_file.relative_to(vault_path)),
                "type": subdir,
                "name": md_file.stem
            })

    return files


# ============ 2.14 parse_frontmatter ============

def parse_frontmatter(file_path: Path) -> Dict:
    """
    解析文件的 frontmatter

    Args:
        file_path: .md 文件路径

    Returns:
        Dict: frontmatter
    """
    content = _read_file(file_path)
    return _parse_frontmatter(content)


# ============ 2.15 extract_body ============

def extract_body(file_path: Path) -> str:
    """
    提取文件正文

    Args:
        file_path: .md 文件路径

    Returns:
        str: 正文文本
    """
    content = _read_file(file_path)
    return _extract_body(content)


# ============ 2.16 full_text_search ============

def full_text_search(
    query: str,
    vault_path: Path = None,
    limit: int = 10
) -> List[Dict]:
    """
    全文搜索匹配命题关键词

    Args:
        query: 搜索关键词
        vault_path: Vault 路径
        limit: 返回数量限制

    Returns:
        List of Dict: [{"path": str, "type": str, "name": str, "content": str, "relevance": float}, ...]
    """
    if vault_path is None:
        vault_path = DEFAULT_VAULT_PATH

    query_lower = query.lower()
    query_words = re.split(r'[\s,，、]+', query_lower)

    # 扫描文件
    files = scan_vault(vault_path)
    knowledge_path = vault_path / KNOWLEDGE_DIR

    results = []

    for file_info in files:
        file_path = knowledge_path.parent / file_info["path"]
        if not file_path.exists():
            continue

        content = _read_file(file_path)
        fm = _parse_frontmatter(content)
        body = _extract_body(content)

        # 计算相关性
        relevance = 0.0

        # 标题匹配
        if any(w in file_info["name"].lower() for w in query_words):
            relevance += 0.3

        # 标签匹配
        tags = fm.get("tags", []) or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]
        if any(w in " ".join(tags).lower() for w in query_words):
            relevance += 0.3

        # 内容匹配
        body_lower = body.lower()
        matched_words = sum(1 for w in query_words if w in body_lower)
        if query_words:
            relevance += 0.4 * (matched_words / len(query_words))

        if relevance > 0:
            results.append({
                "path": file_info["path"],
                "type": file_info["type"],
                "name": file_info["name"],
                "content": body[:500],  # 只保留前 500 字符
                "relevance": min(1.0, relevance),
                "quality_score": _score_to_float(fm.get("quality_score", "0"))
            })

    # 按相关性排序
    results.sort(key=lambda x: x["relevance"], reverse=True)

    return results[:limit]


# ============ 2.17 filter_quality ============

def filter_quality(results: List[Dict], threshold: float = QUALITY_THRESHOLD) -> List[Dict]:
    """
    按 quality_score >= 7 过滤

    Args:
        results: full_text_search 返回的结果
        threshold: 质量阈值

    Returns:
        过滤后的结果
    """
    return [r for r in results if r.get("quality_score", 0) >= threshold]


# ============ 2.18 match_topics ============

def match_topics(results: List[Dict], topics: List[str]) -> List[Dict]:
    """
    按 topics 标签匹配

    Args:
        results: 搜索结果
        topics: 目标 topics 列表

    Returns:
        匹配的结果
    """
    if not topics:
        return results

    matched = []

    for r in results:
        file_path = DEFAULT_VAULT_PATH / KNOWLEDGE_DIR / ".." / r["path"]
        fm = parse_frontmatter(file_path)

        file_topics = fm.get("topics", []) or []
        if isinstance(file_topics, str):
            file_topics = [t.strip() for t in file_topics.split(",")]

        # 检查是否有交集
        if any(t in file_topics for t in topics):
            r["matched_topics"] = [t for t in topics if t in file_topics]
            matched.append(r)

    # 没有匹配 topics 的情况下，返回所有结果
    if not matched:
        matched = results

    return matched


# ============ 2.22 build_link_graph ============

def build_link_graph(vault_path: Path = None) -> Dict[str, List[str]]:
    """
    构建 wiki-link 关联图谱

    Args:
        vault_path: Vault 路径

    Returns:
        Dict: {"文件名": ["链接到的文件1", "链接到的文件2", ...]}
    """
    if vault_path is None:
        vault_path = DEFAULT_VAULT_PATH

    knowledge_path = vault_path / KNOWLEDGE_DIR
    if not knowledge_path.exists():
        return {}

    # wiki-link 模式：[[文件名]] 或 [[文件名|显示名]]
    wiki_link_pattern = r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]'

    graph = {}

    # 扫描所有 md 文件
    for md_file in knowledge_path.rglob("*.md"):
        file_name = md_file.stem
        content = _read_file(md_file)

        # 提取所有 wiki-link
        links = re.findall(wiki_link_pattern, content)
        if links:
            graph[file_name] = list(set(links))

    return graph


# ============ 主函数测试 ============

if __name__ == "__main__":
    print("obsidian_knowledge.py - Obsidian 知识网关测试")
    print(f"Vault 路径: {DEFAULT_VAULT_PATH}")

    # 测试 scan_vault
    print("\n[测试] scan_vault...")
    files = scan_vault()
    print(f"  找到 {len(files)} 个文件")

    # 测试 full_text_search
    print("\n[测试] full_text_search (搜索: AI 职场)...")
    results = full_text_search("AI 职场", limit=5)
    for r in results:
        print(f"  [{r['type']}] {r['name']} (相关性: {r['relevance']:.2f}, 质量: {r['quality_score']})")

    # 测试 filter_quality
    print("\n[测试] filter_quality...")
    filtered = filter_quality(results)
    print(f"  过滤后剩 {len(filtered)} 个")

    # 测试 build_link_graph
    print("\n[测试] build_link_graph...")
    graph = build_link_graph()
    print(f"  找到 {len(graph)} 个有链接的文件")

    print("\n测试完成！")
#!/usr/bin/env python3
"""
RSS-Hunter — 信息源猎手
RSS 抓取 + 认知裂缝检测 + Obsidian 写入

用法:
    python rss_hunter.py fetch                    # 抓取所有信源，更新去重记录
    python rss_hunter.py hunt                     # 抓取 + 裂缝检测 + 写入 Obsidian
    python rss_hunter.py hunt --source "36氪"     # 只处理指定信源
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# ============ 路径设置 ============

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # PRISM-OSv1/
sys.path.insert(0, str(PROJECT_ROOT / ".claude"))

# 导入现有模块
from feed_parser import parse_xml, extract_items, extract_fields, is_duplicate
from crack_hunter_wrapper import analyze_content
from rss_monitor import _fetch_feed

# 导入同目录模块
from obsidian_writer import write_crack, write_item, _safe_print

# ============ 配置 ============

CONFIG_FILE = SCRIPT_DIR.parent / "config" / "feeds.yaml"


def _load_config() -> Dict:
    """加载信源配置"""
    import yaml
    if not CONFIG_FILE.exists():
        _safe_print(f"[Error] 配置文件不存在: {CONFIG_FILE}")
        return {"monitored_sources": []}
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        _safe_print(f"[Error] 加载配置失败: {e}")
        return {"monitored_sources": []}


def _build_push_message(
    crack_info: Dict,
    source_name: str,
    article_title: str,
    article_link: str
) -> str:
    """生成终端推送消息"""
    consensus = crack_info.get("consensus", "无")
    reality = crack_info.get("reality", "无")
    crack_type = crack_info.get("crack_type", "未知")
    confidence = crack_info.get("confidence", 0)
    suggestions = crack_info.get("title_suggestions", [])

    lines = []
    lines.append("=" * 40)
    lines.append("【PRISM-OS 认知裂缝发现】")
    lines.append("=" * 40)
    lines.append("")
    lines.append(f"共识：{consensus}")
    lines.append(f"现实：{reality}")
    lines.append("")
    lines.append(f"裂缝类型：{crack_type} | 置信度：{confidence * 100:.0f}%")
    lines.append(f"来源：{source_name}")
    lines.append(f"原文：{article_title}")
    if article_link:
        lines.append(f"链接：{article_link}")
    lines.append("")

    if suggestions:
        lines.append("建议选题方向：")
        for i, s in enumerate(suggestions[:3], 1):
            lines.append(f"  {i}. {s}")
        lines.append("")

    lines.append("=" * 40)
    return "\n".join(lines)


def _get_source_tags(source: Dict) -> Tuple[str, List[str]]:
    """从信源配置提取 category 和 tags"""
    category = source.get("category", source.get("region", "general"))
    tags = source.get("tags", [])
    if not tags:
        tags = [source.get("region", "general")]
    return category, tags


# ============ 共享抓取逻辑 ============

def _load_sources(source_filter: Optional[str] = None) -> List[Dict]:
    """加载并过滤信源列表"""
    config = _load_config()
    sources = config.get("monitored_sources", [])
    if source_filter:
        sources = [s for s in sources if s.get("name") == source_filter]
        if not sources:
            _safe_print(f"[Error] 未找到信源: {source_filter}")
    return sources


def _iter_new_items(sources: List[Dict]):
    """抓取所有信源，yield 新条目 (fields, source_name, category, tags)"""
    for source in sources:
        name = source.get("name", "未知")
        url = source.get("url", "")
        category, tags = _get_source_tags(source)

        if not url:
            _safe_print(f"[跳过] {name} — 无 URL")
            continue

        _safe_print(f"[抓取] {name}...")
        xml_content = _fetch_feed(url)
        if not xml_content:
            _safe_print(f"  ✗ 抓取失败")
            continue

        root = parse_xml(xml_content)
        if not root:
            _safe_print(f"  ✗ XML 解析失败")
            continue

        items = extract_items(root)
        if not items:
            _safe_print(f"  ⚠ 无条目")
            continue

        new_count = 0
        skip_count = 0
        for item in items:
            fields = extract_fields(item, url)
            if is_duplicate(fields["title"], fields["pub_date"]):
                skip_count += 1
            else:
                new_count += 1
                yield fields, name, category, tags

        _safe_print(f"  ✓ 新条目: {new_count}, 跳过: {skip_count}")


# ============ fetch 命令 ============

def cmd_fetch(source_filter: Optional[str] = None):
    """抓取所有信源，更新去重记录"""
    sources = _load_sources(source_filter)
    if not sources:
        return

    total_new = 0
    for _fields, _name, _cat, _tags in _iter_new_items(sources):
        total_new += 1

    _safe_print(f"\n[完成] 总计新条目: {total_new}")


# ============ prism-os 桥接 ============

def _ask_launch_prism_os(crack_info: Dict, article_title: str, source_name: str):
    """裂缝推送后，询问用户是否调用 prism-os 生成标题"""
    try:
        answer = input("\n是否基于这个裂缝生成标题？(yes/no): ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return

    if answer not in ("yes", "y", "是"):
        return

    # 构建 prism-os 输入
    consensus = crack_info.get("consensus", "")
    reality = crack_info.get("reality", "")
    crack_type = crack_info.get("crack_type", "")
    suggestions = crack_info.get("title_suggestions", [])

    # 拼接用户输入：裂缝内容 + 建议方向
    user_input = f"{article_title}。共识是{consensus}，但现实是{reality}（{crack_type}）"
    if suggestions:
        user_input += f"。建议方向：{'、'.join(suggestions[:3])}"

    _safe_print(f"\n[启动] PRISM-OS 选题生成...")
    _safe_print(f"[输入] {user_input}\n")

    # 调用 prism_os.py run --format
    prism_script = str(PROJECT_ROOT / "skills" / "prism-os" / "scripts" / "prism_os.py")
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, prism_script, "run", user_input, "--format"],
            cwd=str(PROJECT_ROOT),
            timeout=300,
        )
        if result.returncode != 0:
            _safe_print(f"[Error] PRISM-OS 退出码: {result.returncode}")
    except subprocess.TimeoutExpired:
        _safe_print("[Error] PRISM-OS 执行超时（5分钟）")
    except Exception as e:
        _safe_print(f"[Error] 调用 PRISM-OS 失败: {e}")


# ============ hunt 命令 ============

def cmd_hunt(source_filter: Optional[str] = None):
    """抓取 + 裂缝检测 + 写入 Obsidian"""
    sources = _load_sources(source_filter)
    if not sources:
        return

    total_cracks = 0
    total_items = 0
    total_errors = 0

    for fields, name, category, tags in _iter_new_items(sources):
        # 裂缝检测
        try:
            has_crack, crack_info = analyze_content(
                fields["title"],
                fields["summary"],
                name
            )
        except Exception as e:
            _safe_print(f"  [Error] 裂缝检测失败: {fields['title'][:30]}... — {e}")
            total_errors += 1
            continue

        if has_crack:
            write_crack(
                title=fields["title"],
                summary=fields["summary"],
                source=name,
                category=category,
                tags=tags,
                url=fields["link"],
                crack_type=crack_info.get("crack_type", "未知"),
                confidence=crack_info.get("confidence", 0),
                consensus=crack_info.get("consensus", ""),
                reality=crack_info.get("reality", ""),
            )
            push_msg = _build_push_message(
                crack_info, name, fields["title"], fields["link"]
            )
            _safe_print(push_msg)
            total_cracks += 1
            _ask_launch_prism_os(crack_info, fields["title"], name)
        else:
            write_item(
                title=fields["title"],
                summary=fields["summary"],
                source=name,
                category=category,
                tags=tags,
                url=fields["link"],
            )
            total_items += 1

    _safe_print(f"\n{'=' * 40}")
    _safe_print(f"[完成] 裂缝: {total_cracks}, 普通: {total_items}, 错误: {total_errors}")
    _safe_print(f"{'=' * 40}")


# ============ CLI ============

def main():
    parser = argparse.ArgumentParser(
        description="RSS-Hunter — 信息源猎手：RSS 抓取 + 认知裂缝检测 + Obsidian 写入"
    )
    subparsers = parser.add_subparsers(dest="command")

    # fetch 命令
    fetch_parser = subparsers.add_parser("fetch", help="抓取所有信源，更新去重记录")
    fetch_parser.add_argument("--source", "-s", help="只处理指定信源（按 name 精确匹配）")

    # hunt 命令
    hunt_parser = subparsers.add_parser("hunt", help="抓取 + 裂缝检测 + 写入 Obsidian")
    hunt_parser.add_argument("--source", "-s", help="只处理指定信源（按 name 精确匹配）")

    args = parser.parse_args()

    if args.command == "fetch":
        cmd_fetch(args.source)
    elif args.command == "hunt":
        cmd_hunt(args.source)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

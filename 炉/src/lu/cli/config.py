"""CLI config 子命令：飞书 config pull/push/sync

- pull：从飞书 Bitable 读 StyleProfile → 写本地 YAML
- push：从本地 YAML → 飞书 Bitable
- sync：pull 后按 version 号比较，本地新则 push
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from lu.config.loader import StyleProfile, load_style_profile
from lu.feishu.client import FeishuBitableClient
from lu.feishu.style_profile import from_bitable, to_bitable


def should_push(local_version: int, remote_version: int | None) -> bool:
    """判断本地是否应推送到飞书"""
    if remote_version is None:
        return True
    return local_version > remote_version


def _read_remote_profile(client: FeishuBitableClient) -> StyleProfile | None:
    records = client.list_records()
    if not records:
        return None
    return from_bitable(records[0].get("fields", {}))


def _read_remote_version(client: FeishuBitableClient) -> int | None:
    profile = _read_remote_profile(client)
    return profile.version if profile else None


def cmd_pull(client: FeishuBitableClient, style_path: Path) -> int:
    """从飞书拉取 StyleProfile → 写本地 YAML"""
    profile = _read_remote_profile(client)
    if profile is None:
        print("[INFO] 飞书无记录", file=sys.stderr)
        return 0

    style_path.parent.mkdir(parents=True, exist_ok=True)
    style_path.write_text(
        _profile_to_yaml(profile),
        encoding="utf-8",
    )
    print(f"[INFO] 已拉取 v{profile.version} 到 {style_path}", file=sys.stderr)
    return 0


def cmd_push(client: FeishuBitableClient, style_path: Path) -> int:
    """从本地 YAML 推送到飞书"""
    if not style_path.is_file():
        print(f"[ERROR] 本地 style 不存在: {style_path}", file=sys.stderr)
        return 2

    profile = load_style_profile(style_path)
    fields = to_bitable(profile)

    existing = client.list_records()
    if existing:
        rec_id = existing[0].get("record_id") or existing[0].get("id")
        if rec_id:
            client.update_record(str(rec_id), fields)
            print(f"[INFO] 已更新飞书记录 {rec_id} v{profile.version}", file=sys.stderr)
            return 0

    client.create_record(fields)
    print(f"[INFO] 已创建飞书记录 v{profile.version}", file=sys.stderr)
    return 0


def cmd_sync(client: FeishuBitableClient, style_path: Path) -> int:
    """pull + 比较 version，按需 push"""
    # 先 pull 看飞书 version
    remote_version = _read_remote_version(client)
    if style_path.is_file():
        local = load_style_profile(style_path)
        local_version = local.version
    else:
        local_version = 0

    print(
        f"[INFO] local=v{local_version} remote=v{remote_version}",
        file=sys.stderr,
    )

    if should_push(local_version, remote_version):
        return cmd_push(client, style_path)
    else:
        return cmd_pull(client, style_path)


def _profile_to_yaml(profile: StyleProfile) -> str:
    """StyleProfile → 简单 YAML（避免引 PyYAML 复杂结构）"""
    lines: list[str] = []
    lines.append(f"version: {profile.version}")
    if profile.voice:
        lines.append(f'voice: "{profile.voice}"')
    if profile.forbidden:
        lines.append("forbidden:")
        for t in profile.forbidden:
            lines.append(f'  - "{t.term}"')
    sig = profile.socratic_stop_signal
    lines.append("socratic_stop_signal:")
    lines.append(f"  typical_rounds: {sig.typical_rounds}")
    lines.append("  saturation_keywords:")
    for kw in sig.saturation_keywords:
        lines.append(f'    - "{kw}"')
    lines.append(f"  auto_stop_enabled: {str(sig.auto_stop_enabled).lower()}")
    lines.append(f"  sample_count: {sig.sample_count}")
    return "\n".join(lines) + "\n"


def cmd_config(args: argparse.Namespace) -> int:
    config_path = Path(args.config)
    style_path = Path(args.style)

    try:
        client = FeishuBitableClient(config_path)
    except Exception as e:
        print(f"[ERROR] 飞书 client 初始化失败: {e}", file=sys.stderr)
        return 2

    try:
        if args.action == "pull":
            return cmd_pull(client, style_path)
        if args.action == "push":
            return cmd_push(client, style_path)
        if args.action == "sync":
            return cmd_sync(client, style_path)
    except Exception as e:
        print(f"[ERROR] 飞书操作失败: {e}", file=sys.stderr)
        return 2

    print(f"[ERROR] 未知 action: {args.action}", file=sys.stderr)
    return 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lu config")
    sub = parser.add_subparsers(dest="action", required=True)
    for act in ("pull", "push", "sync"):
        p = sub.add_parser(act, help=f"{act} config")
        p.add_argument("--config", default="config/feishu.yaml", help="飞书 config 路径")
        p.add_argument("--style", default="config/style_profile.yaml", help="本地 style YAML")
    return parser


__all__ = ["cmd_config", "should_push", "build_parser"]

"""CLI lu model 子命令：add / list / remove

- add：交互式提示输入模型字段，写入 custom_models.yaml
- list：列出所有 thinking models（built-in + custom）
- remove：按 id 删除
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lu.config.loader import ThinkingModel
from lu.custom_model import (
    CustomModelStore,
    DuplicateModelError,
    ModelNotFoundError,
    add_model,
    load_all_models,
    remove_model,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lu-model", add_help=False)
    sub = parser.add_subparsers(dest="model_action", required=True)

    add_p = sub.add_parser("add", help="添加 thinking model")
    add_p.add_argument("--id", required=True, help="模型 id（字母+数字+下划线）")
    add_p.add_argument("--name", required=True, help="模型名")
    add_p.add_argument("--definition", required=True, help="模型定义（做什么的）")
    add_p.add_argument("--use-when", default="", help="何时使用")
    add_p.add_argument("--prompt-hint", default="", help="prompt 注入提示")
    add_p.add_argument("--avoid", default="", help="避免什么")
    add_p.add_argument(
        "--custom-yaml",
        default="config/thinking_models/custom_models.yaml",
        help="custom models YAML 路径",
    )

    list_p = sub.add_parser("list", help="列出所有 models")
    list_p.add_argument("--custom-yaml", default="config/thinking_models/custom_models.yaml")
    list_p.add_argument("--built-in-yaml", default="config/thinking_models/models.yaml")
    list_p.add_argument("--only-custom", action="store_true")

    rm_p = sub.add_parser("remove", help="删除 model")
    rm_p.add_argument("--id", required=True)
    rm_p.add_argument(
        "--custom-yaml",
        default="config/thinking_models/custom_models.yaml",
    )

    return parser


def cmd_add(args: argparse.Namespace) -> int:
    model = ThinkingModel(
        id=args.id,
        name=args.name,
        definition=args.definition,
        use_when=args.use_when or None,
        prompt_hint=args.prompt_hint or None,
        avoid=args.avoid or None,
    )
    try:
        add_model(model, args.custom_yaml)
    except DuplicateModelError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    except ValueError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    print(f"[INFO] 已添加模型: {args.id} → {args.custom_yaml}", file=sys.stderr)
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    if args.only_custom:
        store = CustomModelStore(args.custom_yaml)
        models = store.list_all()
    else:
        models = load_all_models(
            built_in_path=args.built_in_yaml,
            custom_path=args.custom_yaml,
        )
    print(json.dumps(
        [{"id": m.id, "name": m.name, "definition": m.definition} for m in models],
        ensure_ascii=False, indent=2,
    ))
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    try:
        remove_model(args.id, args.custom_yaml)
    except ModelNotFoundError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    print(f"[INFO] 已删除模型: {args.id}", file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.model_action == "add":
        return cmd_add(args)
    if args.model_action == "list":
        return cmd_list(args)
    if args.model_action == "remove":
        return cmd_remove(args)
    if args.model_action == "framework-add":
        return cmd_framework_add(args)
    if args.model_action == "framework-list":
        return cmd_framework_list(args)
    if args.model_action == "framework-remove":
        return cmd_framework_remove(args)
    parser.print_help()
    return 1


def build_framework_parser(parent: argparse.ArgumentParser) -> None:
    """注册 framework 子命令到顶级 parser（独立 lu framework）"""
    fw = parent.add_parser("framework", help="管理 thinking frameworks")
    sub = fw.add_subparsers(dest="framework_action", required=True)
    add_p = sub.add_parser("add", help="添加 framework")
    add_p.add_argument("--id", required=True)
    add_p.add_argument("--name", required=True)
    add_p.add_argument("--strategy", required=True, help="策略：chain/parallel/nested/...")
    add_p.add_argument(
        "--model-ids", nargs="+", required=True, help="使用的 model id 列表"
    )
    add_p.add_argument("--trigger-keywords", nargs="*", default=[])
    add_p.add_argument(
        "--custom-yaml",
        default="config/thinking_models/custom_frameworks.yaml",
    )
    list_p = sub.add_parser("list", help="列出 frameworks")
    list_p.add_argument("--only-custom", action="store_true")
    list_p.add_argument(
        "--custom-yaml",
        default="config/thinking_models/custom_frameworks.yaml",
    )
    list_p.add_argument(
        "--built-in-yaml",
        default="config/thinking_models/frameworks.yaml",
    )
    rm_p = sub.add_parser("remove", help="删除 framework")
    rm_p.add_argument("--id", required=True)
    rm_p.add_argument(
        "--custom-yaml",
        default="config/thinking_models/custom_frameworks.yaml",
    )


def cmd_framework_add(args: argparse.Namespace) -> int:
    from lu.config.loader import Framework
    from lu.custom_model import (
        DuplicateModelError,
        add_framework,
    )

    framework = Framework(
        id=args.id,
        name=args.name,
        strategy=args.strategy,
        model_ids=args.model_ids,
        trigger_keywords=args.trigger_keywords or [],
    )
    try:
        add_framework(framework, args.custom_yaml)
    except DuplicateModelError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    except ValueError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    print(f"[INFO] 已添加 framework: {args.id} → {args.custom_yaml}", file=sys.stderr)
    return 0


def cmd_framework_list(args: argparse.Namespace) -> int:
    from lu.custom_model import load_all_frameworks, load_custom_frameworks

    if args.only_custom:
        frameworks = load_custom_frameworks(args.custom_yaml)
    else:
        frameworks = load_all_frameworks(
            built_in_path=args.built_in_yaml,
            custom_path=args.custom_yaml,
        )
    print(json.dumps(
        [{"id": f.id, "name": f.name, "strategy": f.strategy, "model_ids": f.model_ids} for f in frameworks],
        ensure_ascii=False, indent=2,
    ))
    return 0


def cmd_framework_remove(args: argparse.Namespace) -> int:
    from lu.custom_model import ModelNotFoundError, remove_framework

    try:
        remove_framework(args.id, args.custom_yaml)
    except ModelNotFoundError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2
    print(f"[INFO] 已删除 framework: {args.id}", file=sys.stderr)
    return 0


__all__ = [
    "build_framework_parser",
    "build_parser",
    "cmd_add",
    "cmd_framework_add",
    "cmd_framework_list",
    "cmd_framework_remove",
    "cmd_list",
    "cmd_remove",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
PRISM-OS 主流程脚本
整合 Phase 0-8：意图识别 → 熵值计算 → 标题生成 → 现实校验 → Gap分析 → 逻辑审计 → 刺客机制

用法:
    python prism_os.py run "<用户输入>"          # 完整流程（JSON输出）
    python prism_os.py run "<用户输入>" --format  # 完整流程（可读格式）
    python prism_os.py run "<用户输入>" --no-ext   # 仅 Phase 0-3
    python prism_os.py classify "<用户输入>"       # Phase 0: 意图识别
    python prism_os.py gateway "<用户输入>"        # Phase 1: 苏格拉底网关
"""

import sys
import json
import os
from typing import Dict, List, Optional
from datetime import datetime
import subprocess
import shutil

# ============ lark-cli 工具函数 ============

FEISHU_TABLE_ID = "tblOoR71Q3DSa33t"
FEISHU_APP_TOKEN = "QVz9byNH0auzRis9KeDcUoe3nZf"

def _verify_lark_cli():
    """验证 lark-cli 是否在 PATH 中"""
    if not shutil.which("lark-cli"):
        print("[Error] lark-cli not found in PATH", file=sys.stderr)
        sys.exit(1)

def _run_lark_cli(args: list, timeout: int = 30) -> tuple:
    """运行 lark-cli 命令"""
    _verify_lark_cli()
    lark_path = shutil.which("lark-cli")
    result = subprocess.run(
        [lark_path] + args,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout
    )
    return result.stdout, result.stderr, result.returncode

# ============ Phase 0: 意图识别 ============

def classify_intent(user_input: str) -> Dict:
    """
    意图识别 - 判断是否触发 PRISM-OS
    """
    trigger_keywords = [
        "写", "文章", "选题", "标题", "创作", "内容",
        "想写", "要写", "帮我写", "生成标题", "策划"
    ]

    question_indicators = ["怎么写", "如何写", "写什么", "什么标题", "选题"]

    # 隐式触发：话题疑问句（用户给了一个选题方向）
    topic_question_patterns = ["为什么", "是什么", "如何", "怎么", "怎麼", "好不好", "要不要", "是不是"]

    user_lower = user_input.lower()
    trigger_count = sum(1 for kw in trigger_keywords if kw in user_lower)
    question_count = sum(1 for kw in question_indicators if kw in user_lower)
    topic_question = any(pat in user_input for pat in topic_question_patterns)

    confidence = min(0.9, 0.3 + trigger_count * 0.2 + question_count * 0.15 + (0.15 if topic_question else 0))
    trigger = trigger_count >= 1 or question_count >= 1 or topic_question

    reason = ""
    if trigger:
        if trigger_count >= 2:
            reason = "包含多个选题关键词"
        elif question_count >= 1:
            reason = "询问写作/选题相关问题"
        elif topic_question:
            reason = "隐式选题（话题疑问句）"
        else:
            reason = "包含选题关键词"
    else:
        reason = "未识别到明确的写作/选题意图"

    return {
        "trigger": trigger,
        "confidence": confidence,
        "reason": reason
    }


# ============ 辅助函数 ============

def _load_yaml_simple(path: str) -> list:
    """简单 YAML 加载"""
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if not content.strip():
        return []
    result = []
    current = {}
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("- "):
            if current:
                result.append(current)
            current = {}
        elif ": " in line and not line.startswith("#"):
            key, val = line.split(": ", 1)
            current[key.strip()] = val.strip().strip('"').strip("'")
    if current:
        result.append(current)
    return result

def confirm_title(user_title: str) -> Dict:
    """
    将用户选择的标题写入飞书爆款选题库
    写入字段：标题、发布日期、命题逻辑、核心论点、内容方向、备注
    """
    # 输入校验
    title = user_title.strip()
    if not title:
        return {"success": False, "error": "标题不能为空"}
    if len(title) > 200:
        title = title[:200]

    # 从 topic_log.yaml 读取最近命题
    thesis = "（未记录）"
    core_argument = "（未记录）"

    log_path = os.path.join(os.path.dirname(__file__), "..", "data", "topic_log.yaml")
    if os.path.exists(log_path):
        try:
            logs = _load_yaml_simple(log_path)
            if logs:
                last = logs[-1]
                thesis = last.get("thesis", "（未记录）")
                if "gateway" in last and isinstance(last.get("gateway"), dict):
                    core_argument = last["gateway"].get("thesis", "（未记录）")
        except Exception as e:
            print(f"[Warning] 读取 topic_log.yaml 失败: {e}", file=sys.stderr)

    # 生成 lark-cli 写入命令
    # 飞书 datetime 字段需要 Unix 时间戳（毫秒）
    now = str(int(datetime.now().timestamp()))
    stdout, stderr, code = _run_lark_cli([
        "api", "POST",
        f"/open-apis/bitable/v1/apps/{FEISHU_APP_TOKEN}/tables/{FEISHU_TABLE_ID}/records",
        "--data", json.dumps({"fields": {
            "标题": title,
            "命题逻辑": thesis,
            "核心论点": core_argument,
            "内容方向": "（未分类）",
            "备注": ""
        }}),
        "--format", "json"
    ])

    if code != 0:
        print(f"[Error] lark-cli create failed: {stderr}", file=sys.stderr)
        return {"success": False, "error": stderr, "title": title}

    # 验证写入
    try:
        resp_data = json.loads(stdout)
        record_id = resp_data.get("data", {}).get("record", {}).get("record_id", "")
        return {"success": True, "title": title, "record_id": record_id}
    except json.JSONDecodeError:
        return {"success": True, "title": title, "note": "写入成功但无法解析返回ID"}


# ============ PRISM-OS 主流程 ============

def run_prism_os(
    user_input: str,
    identity_role: str = "",
    audience: str = "",
    include_phase_4_8: bool = True,
    materials: str = "",
    history_topics: List[str] = None,
    skip_gateway: bool = False
) -> Dict:
    """
    PRISM-OS 完整工作流程

    Args:
        user_input: 用户输入
        identity_role: 用户身份（可选）
        audience: 目标受众（可选）
        include_phase_4_8: 是否包含 Phase 4-8（默认 True）
        materials: 现有素材（可选）
        history_topics: 历史选题列表（可选）
        skip_gateway: 跳过 Phase 1 熵值判断（默认 False）

    Returns:
        完整流程结果
    """
    result = {
        "phase": "init",
        "status": "running",
        "user_input": user_input
    }

    # ============ Phase 0: 意图识别 ============
    intent_result = classify_intent(user_input)
    result["phase"] = "intent"
    result["intent"] = intent_result

    if not intent_result["trigger"]:
        result["status"] = "skipped"
        result["message"] = "未触发 PRISM-OS（需要写作/选题相关意图）"
        return result

    # ============ Phase 1: 苏格拉底网关（可选跳过） ============
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from socratic_gateway import socratic_gateway

    thesis = user_input

    if not skip_gateway:
        result["phase"] = "gateway"
        gateway_result = socratic_gateway(user_input)
        result["gateway"] = gateway_result

        if gateway_result["status"] == "blocked":
            result["status"] = "blocked"
            result["message"] = "命题熵值过低，被拦截"
            return result

        if gateway_result["status"] == "need_clarification":
            result["status"] = "need_clarification"
            result["message"] = "需要澄清"
            result["questions"] = gateway_result.get("questions", [])
            result["directions"] = gateway_result.get("directions", [])

            # 保存方向到备选队列
            try:
                from assassin import save_backup
                for direction in result["directions"]:
                    save_backup(direction, f"socratic-{datetime.now().strftime('%Y-%m-%d')}")
            except Exception as e:
                print(f"[Warning] 保存备选方向失败: {e}", file=sys.stderr)

            # ============ Phase 1.5: 备选检查（新增） ============
            try:
                from assassin import check_related_backups

                result["phase"] = "backup_check"
                matched_backups = check_related_backups(user_input)
                result["backup_matches"] = matched_backups if matched_backups else []
            except Exception as e:
                print(f"[Warning] Phase 1.5 失败: {e}", file=sys.stderr)
                result["backup_matches"] = []

            return result

        # gateway_result["status"] == "pass": 继续到 Phase 2
        result["status"] = "ready_for_generation"
    else:
        result["phase"] = "gateway_skipped"

    # ============ Phase 1.5: 备选检查（用于 skip_gateway 或 pass） ============
    if result["status"] in ["ready_for_generation", "running"]:
        try:
            from assassin import check_related_backups

            result["phase"] = "backup_check"
            matched_backups = check_related_backups(user_input)
            result["backup_matches"] = matched_backups if matched_backups else []
        except Exception as e:
            print(f"[Warning] Phase 1.5 失败: {e}", file=sys.stderr)
            result["backup_matches"] = []

    # ============ Phase 2: 棱镜引擎 ============
    from prism_engine import prism_engine as generate_titles

    result["phase"] = "prism"
    prism_result = generate_titles(thesis, identity_role, audience)
    result["prism"] = prism_result

    if prism_result["status"] == "error" or not prism_result.get("candidates"):
        result["status"] = "error"
        result["message"] = "标题生成失败"
        return result

    # ============ Phase 3: 现实校验锚 ============
    from reality_anchor import reality_anchor as validate_titles

    result["phase"] = "reality"
    reality_result = validate_titles(prism_result["candidates"])
    result["reality"] = reality_result

    # 提取最终候选
    final_candidates = reality_result.get("validated", [])
    result["candidates"] = final_candidates
    result["statistics"] = reality_result.get("statistics", {})

    # ============ Phase 4-8: 扩展功能（可选） ============
    if include_phase_4_8 and final_candidates:
        # Phase 4: Gap Analysis + 双端大纲
        try:
            from gap_analysis import gap_analysis

            result["phase"] = "gap"
            # 获取第一个候选标题的维度
            first_candidate = final_candidates[0] if final_candidates else {}
            gap_result = gap_analysis(
                thesis=thesis,
                materials=materials,
                title=first_candidate.get("title", ""),
                audience=audience,
                dimension=first_candidate.get("dimension", "")
            )
            result["gap"] = gap_result.get("gap")
            result["outlines"] = gap_result.get("outlines")
        except Exception as e:
            print(f"[Warning] Phase 4 失败: {e}", file=sys.stderr)
            result["gap"] = None
            result["outlines"] = None

        # Phase 5: 逻辑压力测试 + 认知旅程
        try:
            from logic_pressure import logic_pressure

            result["phase"] = "logic"
            if history_topics is None:
                history_topics = []
            lp_result = logic_pressure(final_candidates, history_topics)
            result["logic_audit"] = lp_result.get("logic_audit", [])
            result["cognitive_journey"] = lp_result.get("cognitive_journey", {})
        except Exception as e:
            print(f"[Warning] Phase 5 失败: {e}", file=sys.stderr)
            result["logic_audit"] = []
            result["cognitive_journey"] = {}

        # Phase 6: 数据持久化（写入 topic_log.yaml）
        try:
            from storage import append_log

            result["phase"] = "storage"
            # 获取熵值（如果 gateway 未跳过）
            entropy_score = 0
            if "gateway" in result and result["gateway"]:
                entropy_score = result["gateway"].get("entropy_score", 0)
            elif skip_gateway:
                entropy_score = -1  # 跳过标记

            log_entry = {
                "thesis": thesis,
                "candidates_count": len(final_candidates),
                "entropy_score": entropy_score,
                "gap_score": result.get("gap", {}).get("gap_score", 0) if result.get("gap") else 0,
                "candidates": [{"title": c.get("title", ""), "dimension": c.get("dimension", "")} for c in final_candidates[:5]]
            }
            storage_result = append_log(log_entry)
            result["storage"] = {"status": "ok" if storage_result.get("status") == "ok" else "failed"}
        except Exception as e:
            print(f"[Warning] Phase 6 失败: {e}", file=sys.stderr)
            result["storage"] = {"status": "failed"}

        # Phase 7: 刺客机制（仅当有历史数据时）
        if history_topics:
            try:
                from assassin import assassin_mechanism

                result["phase"] = "assassin"
                assassin_result = assassin_mechanism(
                    historical_topics=history_topics,
                    entities=None,
                    relations=None
                )
                result["reversals"] = assassin_result.get("reversals", [])
                result["topology"] = assassin_result.get("topology", {})
            except Exception as e:
                print(f"[Warning] Phase 7 失败: {e}", file=sys.stderr)
                result["reversals"] = []
                result["topology"] = {}

        # Phase 8: 数字分身筛选（自动应用）
        try:
            from cognitive_crack import digital_twin_filter

            result["phase"] = "digital_twin"
            # 使用默认思维特征进行筛选
            twin_result = digital_twin_filter(final_candidates, "理性、克制、反常识")
            result["digital_twin"] = twin_result
            result["twin_selected"] = twin_result.get("selected_topics", [])
        except Exception as e:
            print(f"[Warning] Phase 8 失败: {e}", file=sys.stderr)
            result["digital_twin"] = {}
            result["twin_selected"] = []

    # ============ 最终结果 ============
    result["status"] = "success"
    result["phase"] = "complete"

    return result


# ============ 输出格式化 ============

def format_prism_os_output(result: Dict) -> str:
    """
    将 run_prism_os() 返回的 JSON 格式化为可读报告
    """
    lines = [
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "【PRISM-OS 选题结果】",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ""
    ]

    # 候选标题
    candidates = result.get("candidates", [])
    if candidates:
        lines.append("■ 候选标题（按综合评分排序）")
        dim_names = {
            "reversal": "逆向拆解",
            "micro_scene": "微观切片",
            "systemic_flaw": "系统归因",
            "bridge": "认知脚手架"
        }

        for i, c in enumerate(candidates, 1):
            dim = c.get("dimension", "")
            dim_name = dim_names.get(dim, dim)
            title = c.get("title", "")
            comp = c.get("competition_level", "未知")
            novelty = c.get("novelty_score", 0)
            novelty_pct = int(novelty * 100) if novelty else 0

            # 逻辑审计标记
            logic_mark = "✓"
            if "logic_audit" in result:
                for audit in result.get("logic_audit", []):
                    if audit.get("title") == title and audit.get("has_fallacy"):
                        logic_mark = "⚠"
                        break

            lines.append(f"  {i} [{dim_name}] {logic_mark} {title}")
            lines.append(f"     {comp} | 新颖度 {novelty_pct}%")

        lines.append("")

    # 备选匹配显示
    backup_matches = result.get("backup_matches", [])
    if backup_matches:
        lines.append("■ 相关备选方向")
        for m in backup_matches[:3]:
            sim = int(m.get("similarity", 0) * 100)
            lines.append(f"  📌 {m.get('title', '')}（相似度 {sim}%）")
        lines.append("")

    # 素材缺口
    gap = result.get("gap")
    if gap:
        readiness = gap.get("readiness", 0)
        missing = gap.get("missing_evidence", [])
        recommendation = gap.get("recommendation", "")

        lines.append("■ 素材缺口")
        lines.append(f"  当前就绪度: {int(readiness * 100)}%")
        if missing:
            lines.append(f"  缺口: {', '.join(missing[:3])}")
        if recommendation:
            lines.append(f"  建议: {recommendation}")
        lines.append("")

    # 双端大纲
    outlines = result.get("outlines")
    if outlines:
        lines.append("■ 双端大纲")

        wechat = outlines.get("wechat_outline")
        if wechat:
            hook = wechat.get("hook", "")
            sections = wechat.get("sections", [])
            section_titles = " → ".join([s.get("title", "") for s in sections[:3]])
            lines.append(f"  📝 公众号: {hook}")
            lines.append(f"     结构: 引子 → {section_titles} → 升华")

        xiaohongshu = outlines.get("xiaohongshu_outline")
        if xiaohongshu:
            hook = xiaohongshu.get("hook", "")
            tags = xiaohongshu.get("tags", [])[:5]
            lines.append(f"  📕 小红书: {hook}")
            lines.append(f"     标签: {', '.join(tags)}")
        lines.append("")

    # 逻辑审计摘要
    logic_audit = result.get("logic_audit", [])
    if logic_audit:
        lines.append("■ 逻辑审计")
        fallacy_count = sum(1 for a in logic_audit if a.get("has_fallacy"))
        if fallacy_count > 0:
            lines.append(f"  ⚠ 发现 {fallacy_count} 个标题存在逻辑问题:")
            for audit in logic_audit[:3]:
                if audit.get("has_fallacy"):
                    ft = audit.get("fallacy_type", "未知")
                    sev = int(audit.get("severity", 0) * 100)
                    title = audit.get("title", "")[:25]
                    lines.append(f"     - {title}... → {ft}({sev}%)")
        else:
            lines.append("  ✓ 所有标题逻辑通过")
        lines.append("")

    # 认知旅程
    cj = result.get("cognitive_journey", {})
    if cj and cj.get("status") != "first_time":
        dist = cj.get("avg_distance", 0)
        status = cj.get("cognitive_progress", "未知")
        warning = cj.get("warning", "")

        lines.append("■ 认知旅程")
        status_icon = "✓" if status == "正常" else "⚠"
        lines.append(f"  {status_icon} 与历史选题距离: {dist:.2f}（{status}）")
        if warning:
            lines.append(f"  警告: {warning}")
        lines.append("")

    # 刺客反转（如果有）
    reversals = result.get("reversals", [])
    if reversals:
        lines.append("■ 刺客反转（历史爆款）")
        for r in reversals[:2]:
            original = r.get("original_thesis", "")[:30]
            reversal = r.get("reversal_thesis", "")[:30]
            strategy = r.get("reversal_strategy", "")
            lines.append(f"  原题: {original}...")
            lines.append(f"  反转: {reversal}...")
            lines.append(f"  策略: {strategy}")
        lines.append("")

    # 数字分身推荐（Phase 8）
    twin_selected = result.get("twin_selected", [])
    if twin_selected:
        lines.append("■ 数字分身推荐")
        for t in twin_selected[:3]:
            topic = t.get("topic", "")[:40]
            reason = t.get("selection_reason", "")[:30]
            lines.append(f"  ✓ {topic}")
            lines.append(f"    原因: {reason}...")
        lines.append("")

    # 数据持久化状态
    storage_status = result.get("storage", {}).get("status")
    if storage_status == "ok":
        lines.append("✓ 选题已保存到历史记录")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("")

    return "\n".join(lines)


# ============ CLI 入口 ============

def _safe_print(obj):
    """修复 Windows GBK 编码问题"""
    output = json.dumps(obj, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")


def main():
    if len(sys.argv) < 2:
        _safe_print({
            "error": "用法: python prism_os.py <命令> [选项]",
            "commands": {
                "run": "python prism_os.py run \"<用户输入>\" [--format] [--no-ext] [--fast] - 完整流程",
                "classify": "意图识别",
                "gateway": "苏格拉底网关（熵值计算）",
                "confirm": "python prism_os.py confirm \"<标题>\" - 确认选题并写入飞书"
            },
            "options": {
                "--format, -f": "格式化输出（可读报告）",
                "--no-ext": "跳过 Phase 4-8（仅 Phase 0-3）",
                "--fast, -F": "跳过 Phase 1 熵值判断（快速模式）"
            }
        })
        sys.exit(1)

    command = sys.argv[1]

    if command == "run":
        # 解析参数
        user_input = ""
        include_ext = True
        use_format = False
        skip_gateway = False

        for arg in sys.argv[2:]:
            if arg == "--format" or arg == "-f":
                use_format = True
            elif arg == "--no-ext":
                include_ext = False
            elif arg == "--fast" or arg == "-F":
                skip_gateway = True
            elif not user_input:
                user_input = arg

        if not user_input:
            _safe_print({"error": "请提供用户输入"})
            sys.exit(1)

        result = run_prism_os(user_input, include_phase_4_8=include_ext, skip_gateway=skip_gateway)

        if use_format:
            output = format_prism_os_output(result)
            sys.stdout.buffer.write(output.encode("utf-8"))
        else:
            _safe_print(result)

    elif command == "classify":
        if len(sys.argv) < 3:
            _safe_print({"error": "请提供用户输入"})
            sys.exit(1)
        user_input = sys.argv[2]
        result = classify_intent(user_input)
        _safe_print(result)

    elif command == "gateway":
        if len(sys.argv) < 3:
            _safe_print({"error": "请提供用户输入"})
            sys.exit(1)
        user_input = sys.argv[2]
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from socratic_gateway import socratic_gateway
        result = socratic_gateway(user_input)
        _safe_print(result)

    elif command == "confirm":
        if len(sys.argv) < 3:
            _safe_print({"error": "请提供标题"})
            sys.exit(1)
        title = sys.argv[2]
        result = confirm_title(title)
        _safe_print(result)

    else:
        _safe_print({"error": f"未知命令: {command}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
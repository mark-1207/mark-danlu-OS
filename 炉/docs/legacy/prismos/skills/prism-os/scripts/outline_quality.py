#!/usr/bin/env python3
"""
PRISM-OS 大纲质量检查 (M7: B1 + M8: B2)

B1 - CCOS 大纲 8 模块检查：
- 必需：HOOK（必有）+ 至少 1 个 MODEL
- 推荐：COUNTER、BOUNDARY
- 节奏：连续 3+ 同型模块 → 警告

B2 - 标题-大纲一致性（4 层兑现）：
- surface / implication / deeper_meaning / universal_value
- expand_depth 合并到 cognitive_tension（0 新 LLM）
- B2 综合 1 次 LLM 调用
"""
import json
import re
from typing import Dict, List, Optional


# 必需模块（缺失 → 阻断）
REQUIRED_MODULES = ("HOOK",)  # MODEL 是 ≥1 个的硬性要求（不放在这里）

# 推荐模块（缺失 → 警告）
RECOMMENDED_MODULES = ("COUNTER", "BOUNDARY")


def check_modules(outline: Dict) -> Dict:
    """
    检查大纲的 8 模块完整性。

    Returns:
        {
            "has_HOOK": bool,
            "has_Model": bool,
            "has_COUNTER": bool,
            "has_BOUNDARY": bool,
            "consecutive_violation": bool,
            "missing_required": List[str],
            "missing_recommended": List[str],
            "rhythm_issues": List[str],
        }
    """
    module_flow = outline.get("认知模块流", [])
    if not module_flow:
        return {
            "has_HOOK": False,
            "has_MODEL": False,
            "has_COUNTER": False,
            "has_BOUNDARY": False,
            "consecutive_violation": False,
            "missing_required": ["HOOK", "MODEL"],
            "missing_recommended": list(RECOMMENDED_MODULES),
            "rhythm_issues": ["模块流为空"],
        }

    types = [str(m.get("模块", "")) for m in module_flow if isinstance(m, dict)]

    has_HOOK = "HOOK" in types
    has_MODEL = types.count("MODEL") >= 1
    has_COUNTER = "COUNTER" in types
    has_BOUNDARY = "BOUNDARY" in types

    # 节奏检查：连续 3+ 同型
    rhythm_issues = []
    for i in range(len(types) - 2):
        if types[i] and types[i] == types[i + 1] == types[i + 2]:
            rhythm_issues.append(f"第 {i + 1}-{i + 3} 连续 3 个 {types[i]}")

    return {
        "has_HOOK": has_HOOK,
        "has_MODEL": has_MODEL,
        "has_COUNTER": has_COUNTER,
        "has_BOUNDARY": has_BOUNDARY,
        "consecutive_violation": bool(rhythm_issues),
        "missing_required": (["HOOK"] if not has_HOOK else []) + ([] if has_MODEL else ["MODEL"]),
        "missing_recommended": [m for m in RECOMMENDED_MODULES if m not in types],
        "rhythm_issues": rhythm_issues,
    }


def check_outline_quality(outline: Dict) -> Dict:
    """
    B1 综合检查（含 warnings 汇总）。

    Returns:
        {
            "B1_module": Dict,        # check_modules 的结果
            "overall_pass": bool,      # 无任何问题
            "warnings": List[str],     # 警告列表（人类可读）
            "can_proceed": bool,       # 必需齐 → 可继续
        }
    """
    b1 = check_modules(outline)
    warnings = []

    if b1["missing_required"]:
        for m in b1["missing_required"]:
            warnings.append(f"缺必需模块: {m}")
    if b1["missing_recommended"]:
        warnings.append(f"缺推荐模块: {', '.join(b1['missing_recommended'])}")
    if b1["rhythm_issues"]:
        for issue in b1["rhythm_issues"]:
            warnings.append(f"节奏问题: {issue}")

    can_proceed = len(b1["missing_required"]) == 0
    overall_pass = can_proceed and len(warnings) == 0

    return {
        "B1_module": b1,
        "overall_pass": overall_pass,
        "warnings": warnings,
        "can_proceed": can_proceed,
    }


def format_b1_report(result: Dict) -> str:
    """格式化 B1 报告为可读文本（CLI 展示用）"""
    lines = ["\n[B1 8 模块检查]"]
    b1 = result.get("B1_module", {})

    # 必需
    if b1.get("has_HOOK"):
        lines.append("  ✓ HOOK 必备")
    else:
        lines.append("  ✗ HOOK 缺失（必需）")
    if b1.get("has_MODEL"):
        lines.append("  ✓ MODEL 必备（≥1 个）")
    else:
        lines.append("  ✗ MODEL 缺失（必需）")

    # 推荐
    if b1.get("has_COUNTER"):
        lines.append("  ✓ COUNTER 推荐")
    else:
        lines.append("  ⚠ COUNTER 推荐（缺失）")
    if b1.get("has_BOUNDARY"):
        lines.append("  ✓ BOUNDARY 推荐")
    else:
        lines.append("  ⚠ BOUNDARY 推荐（缺失）")

    # 节奏
    if not b1.get("consecutive_violation"):
        lines.append("  ✓ 节奏正常")
    else:
        lines.append(f"  ⚠ 节奏: {len(b1.get('rhythm_issues', []))} 处连续 3+ 同型")

    # 汇总
    if result.get("can_proceed"):
        if result.get("overall_pass"):
            lines.append("\n  ✓ 全部通过")
        else:
            lines.append("\n  ⚠ 可继续但有警告")
    else:
        lines.append("\n  ✗ 必需模块缺失，需重生成")

    return "\n".join(lines)


# ============ CLI（调试） ============

if __name__ == "__main__":
    demo_outline = {
        "认知模块流": [
            {"模块": "HOOK", "内容摘要": "凌晨 3 点刷课的中层"},
            {"模块": "CASE", "内容摘要": "被裁的中年程序员"},
            {"模块": "EXPLAIN", "内容摘要": "为什么 AI 不是焦虑源"},
            {"模块": "MODEL", "内容摘要": "时间分配漏斗"},
            {"模块": "EVIDENCE", "内容摘要": "数据"},
            {"模块": "ACTION", "内容摘要": "第一步..."},
        ]
    }
    result = check_outline_quality(demo_outline)
    print(format_b1_report(result))


# ============ M8: B2 4 层兑现 ============

DEEP_TITLE_UNDERSTANDING_PROMPT = """你是标题深度理解专家。一次调用同时返回两层信息：

1. cognitive_tension（认知张力）: 大众以为 vs 现实是
2. depth_expansion（深度展开 4 层）: 标题字面 → 推论 → 深层 → 价值

# 输出（必须严格 JSON）
{{
  "cognitive_tension": {{
    "mainstream": "大众以为...",
    "reality": "现实是..."
  }},
  "depth_expansion": {{
    "surface": "标题字面在说什么（1 句）",
    "implication": "直接推论（1 句）",
    "deeper_meaning": "深层心理/认知含义（1 句）",
    "universal_value": "给读者的普遍价值/承诺（1 句）"
  }}
}}

# 用户命题
{thesis}
"""


def extract_keywords(text):
    """从标题提取关键元素：数字、年龄、人群、专有名词。"""
    if not text:
        return []
    keywords = []
    # 数字（纯数字）
    keywords.extend(re.findall(r"\d+", text))
    # 单字中文（年龄/单位/常用字）
    keywords.extend(c for c in text if "一" <= c <= "鿿")
    # 2-字中文 n-gram
    for i in range(len(text) - 1):
        chunk = text[i:i + 2]
        if all("一" <= c <= "鿿" for c in chunk):
            keywords.append(chunk)
    # 2+ 字英文（转小写）
    keywords.extend(w.lower() for w in re.findall(r"[a-zA-Z]{2,}", text))
    return list(set(k.strip() for k in keywords if k.strip()))


def _extract_json_str(text):
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start:end + 1]
    return None


def expand_depth_from_tension_response(llm_output):
    if not llm_output:
        return None
    json_str = _extract_json_str(llm_output)
    if not json_str:
        return None
    try:
        data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    depth = data.get("depth_expansion")
    if not isinstance(depth, dict):
        return None
    required = ("surface", "implication", "deeper_meaning", "universal_value")
    if not all(k in depth for k in required):
        return None
    return {
        "surface": str(depth.get("surface", "")),
        "implication": str(depth.get("implication", "")),
        "deeper_meaning": str(depth.get("deeper_meaning", "")),
        "universal_value": str(depth.get("universal_value", "")),
    }


def _call_llm_for_b2(prompt):
    try:
        from pathlib import Path
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from call_llm import call_llm_raw
        return call_llm_raw(prompt, temperature=0.3, scene="writing-cn",
                            error_prefix="[B2 LLM]")
    except Exception as e:
        print(f"[B2] LLM 调用失败: {e}", file=sys.stderr)
        return None


def _b2_default_result(reason=""):
    return {
        "surface_covered": False,
        "implication_covered": False,
        "deeper_covered": False,
        "value_covered": False,
        "uncovered_layers": ["surface", "implication", "deeper_meaning", "universal_value"],
        "delivery_score": 0.0,
        "missing_promises": [reason] if reason else [],
        "depth_suggestions": [f"LLM 调用失败: {reason}"] if reason else [],
    }


_B2_DELIVERY_PROMPT = """评估大纲对标题 4 层深度的兑现度。

# 标题
{title}

# 标题深度展开（4 层）
{depth}

# 大纲摘要
{outline}

# 输出（必须严格 JSON）
{{
  "surface_covered": bool,
  "implication_covered": bool,
  "deeper_covered": bool,
  "value_covered": bool,
  "uncovered_layers": ["...", ...],
  "delivery_score": 0.0-1.0,
  "missing_promises": ["...", ...],
  "depth_suggestions": ["第 X 段加...", ...]
}}
"""


def _summarize_outline(outline):
    if not isinstance(outline, dict):
        return str(outline)[:1000]
    parts = []
    for k, v in outline.items():
        if k in ("主结构", "推进方式", "内容目标", "用户动机", "核心认知冲突",
                 "内容立场", "Anti-AI要求", "语言风格", "信息密度要求"):
            parts.append(f"{k}: {v}")
    mf = outline.get("认知模块流", [])
    if mf:
        for m in mf[:10]:
            if isinstance(m, dict):
                parts.append(f"  [{m.get('模块', '?')}] {m.get('内容摘要', '')[:80]}")
    cip = outline.get("案例插入点", [])
    if cip:
        parts.append(f"案例: {', '.join(str(x)[:50] for x in cip[:3])}")
    return "\n".join(parts)[:3000]


def _parse_b2_response(raw):
    json_str = _extract_json_str(raw)
    if not json_str:
        return _b2_default_result(reason="JSON 解析失败")
    try:
        data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        return _b2_default_result(reason="JSON 格式错")
    if not isinstance(data, dict):
        return _b2_default_result(reason="非 dict")
    return {
        "surface_covered": bool(data.get("surface_covered", False)),
        "implication_covered": bool(data.get("implication_covered", False)),
        "deeper_covered": bool(data.get("deeper_covered", False)),
        "value_covered": bool(data.get("value_covered", False)),
        "uncovered_layers": [str(x) for x in data.get("uncovered_layers", [])],
        "delivery_score": float(data.get("delivery_score", 0.0)),
        "missing_promises": [str(x) for x in data.get("missing_promises", [])],
        "depth_suggestions": [str(x) for x in data.get("depth_suggestions", [])],
    }


def check_consistency_4_layers(title, depth, outline):
    if not title or not depth or not outline:
        return _b2_default_result(reason="缺少输入")
    outline_summary = _summarize_outline(outline)
    prompt = _B2_DELIVERY_PROMPT.format(
        title=title,
        depth=json.dumps(depth, ensure_ascii=False, indent=2),
        outline=outline_summary,
    )
    raw = _call_llm_for_b2(prompt)
    if not raw:
        return _b2_default_result(reason="LLM 失败")
    return _parse_b2_response(raw)


def format_b2_report(result):
    lines = ["\n[B2 4 层兑现检查]"]
    uncovered = result.get("uncovered_layers", [])
    if not uncovered:
        lines.append("  ✓ 4 层全部兑现")
    else:
        lines.append(f"  ⚠ 未兑现层: {', '.join(uncovered)}")
    score = result.get("delivery_score", 0)
    lines.append(f"  兑现度: {score:.2f}/1.0")
    suggestions = result.get("depth_suggestions", [])
    if suggestions:
        lines.append("  改进建议:")
        for s in suggestions[:3]:
            lines.append(f"    - {s}")
    return "\n".join(lines)

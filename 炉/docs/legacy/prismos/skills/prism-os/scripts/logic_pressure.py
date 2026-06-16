#!/usr/bin/env python3
"""
PRISM-OS Phase 5: 逻辑压力测试 & 认知旅程
检测标题中的逻辑谬误 + 计算与历史选题的语义距离

用法:
    python logic_pressure.py audit "<标题>"
    python logic_pressure.py journey "<命题>" "[<历史命题1>, ...]"
"""

import sys
import json
import os
import re
from typing import Dict, List, Optional

# ============ Phase 5: 逻辑压力测试 ============

def audit_title(title: str) -> Dict:
    """
    检测标题中的逻辑谬误

    Args:
        title: 待检测标题

    Returns:
        {
            "has_fallacy": true/false,
            "fallacy_type": str,
            "explanation": str,
            "severity": float,
            "suggestion": str
        }
    """
    prompt = f"""你是逻辑审计员。检测标题中的逻辑谬误。

待检测标题：{title}

检测项：
1. 循环论证：结论即前提
2. 幸存者偏差：只关注成功案例
3. 因果倒置：混淆因果关系
4. 滑坡谬误：夸大连锁反应

返回 JSON：
{{
  "has_fallacy": true/false,
  "fallacy_type": "循环论证/幸存者偏差/因果倒置/滑坡谬误/无",
  "explanation": "详细说明",
  "severity": 0.0-1.0,
  "suggestion": "修改建议（如有）"
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "has_fallacy": False,
            "fallacy_type": "无",
            "explanation": "逻辑审计失败",
            "severity": 0.0,
            "suggestion": ""
        }

    parsed = _parse_llm_json(result)
    if not parsed:
        return {
            "has_fallacy": False,
            "fallacy_type": "无",
            "explanation": "逻辑审计失败",
            "severity": 0.0,
            "suggestion": ""
        }

    return parsed


def audit_batch(titles: List[str]) -> List[Dict]:
    """
    批量审计标题（v1.1 优化：1 次 LLM 调用 + 3 层防御）

    原 12 次 LLM（每个标题 1 次）→ 1 次 LLM（数组返回）。
    风险与防御：
    1. 校验：返回数组长度 != len(titles) → 标记可疑
    2. 重试：长度不匹配时 retry 1 次，prompt 加 "必须返回恰好 N 项"
    3. fallback：retry 仍失败 → 对缺失项逐个调 audit_title 单独审计
    """
    n = len(titles)
    if n == 0:
        return []

    # 防御 1：1 次 LLM 调用（返回数组）
    verdicts = _audit_batch_single(titles, retry=False)

    # 防御 2：长度不匹配 → retry 1 次
    if len(verdicts) != n:
        verdicts = _audit_batch_single(titles, retry=True)

    # 防御 3：仍不匹配 → 对缺失项逐个 audit
    if len(verdicts) != n:
        # 找出缺失的索引
        covered_titles = {v.get("title", "") for v in verdicts}
        for i, t in enumerate(titles):
            if t not in covered_titles:
                # 单个 audit_title 兜底
                single = audit_title(t)
                verdicts.append({"title": t, **single})

    # 组装结果：每个 title 对应一个 verdict
    out = []
    for t in titles:
        match = next((v for v in verdicts if v.get("title") == t), None)
        if match:
            out.append({"title": t, **match})
        else:
            # 极端情况：仍未找到，用最差 fallback
            out.append({
                "title": t,
                "has_fallacy": False,
                "fallacy_type": "无",
                "explanation": "批量审计失败",
                "severity": 0.0,
                "suggestion": ""
            })
    return out


def _audit_batch_single(titles: List[str], retry: bool = False) -> List[Dict]:
    """
    1 次 LLM 调用，期望返回数组（每项对应一个 title）。
    retry=True 时 prompt 加 "必须返回恰好 N 项"。
    """
    n = len(titles)
    titles_block = "\n".join([f"{i+1}. {t}" for i, t in enumerate(titles)])

    count_constraint = ""
    if retry:
        count_constraint = f"\n**严格约束：必须返回恰好 {n} 项 JSON 对象，对应上面 {n} 个标题，顺序一致。**"

    prompt = f"""你是逻辑审计员。检测以下 {n} 个标题中的逻辑谬误（批量审计，一次返回）。

检测项：
1. 循环论证：结论即前提
2. 幸存者偏差：只关注成功案例
3. 因果倒置：混淆因果关系
4. 滑坡谬误：夸大连锁反应

待检测标题：
{titles_block}

返回 JSON 数组（按上述顺序，每项对应一个标题）：
[
  {{
    "title": "完整标题文本（必须与上面一致）",
    "has_fallacy": true/false,
    "fallacy_type": "循环论证/幸存者偏差/因果倒置/滑坡谬误/无",
    "explanation": "详细说明",
    "severity": 0.0-1.0,
    "suggestion": "修改建议"
  }},
  ...
]{count_constraint}"""

    result = _call_llm_raw(prompt)
    if not result:
        return []

    parsed = _parse_llm_json(result)
    if not parsed:
        return []

    if isinstance(parsed, dict) and "audits" in parsed:
        parsed = parsed["audits"]

    if not isinstance(parsed, list):
        return []

    return [v for v in parsed if isinstance(v, dict)]


# ============ Phase 5: 认知旅程 ============

def calculate_cognitive_journey(thesis: str, history_topics: List[str]) -> Dict:
    """
    计算当前选题与历史选题的语义距离

    Args:
        thesis: 当前命题
        history_topics: 历史选题列表

    Returns:
        {
            "avg_distance": float,
            "cognitive_progress": "正常/原地打转",
            "warning": str,
            "recommendation": str
        }
    """
    if not history_topics:
        return {
            "status": "first_time",
            "message": "首次使用，跳过认知旅程校验"
        }

    prompt = f"""你是认知路径规划师。计算当前选题与历史选题的语义距离。

当前命题：{thesis}
历史选题：{', '.join(history_topics)}

计算方法：
1. 评估当前命题与历史选题的主题相似度
2. 计算平均语义距离
3. 平均距离 < 0.3 表示认知原地打转

返回 JSON：
{{
  "avg_distance": 0.0-1.0,
  "cognitive_progress": "正常/原地打转",
  "warning": "如原地打转，给出警告",
  "recommendation": "如需调整，给出建议"
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "avg_distance": 0.5,
            "cognitive_progress": "未知",
            "warning": "认知旅程计算失败",
            "recommendation": ""
        }

    parsed = _parse_llm_json(result)
    if not parsed:
        return {
            "avg_distance": 0.5,
            "cognitive_progress": "未知",
            "warning": "认知旅程计算失败",
            "recommendation": ""
        }

    return parsed


# ============ Phase 5: 主流程 ============

def logic_pressure(candidates: List[Dict], history_topics: List[str] = None) -> Dict:
    """
    Phase 5 完整流程：逻辑压力测试 + 认知旅程

    Args:
        candidates: 候选标题列表
        history_topics: 历史选题（可选）

    Returns:
        {
            "logic_audit": [...],
            "cognitive_journey": {...}
        }
    """
    result = {
        "phase": "logic_pressure",
        "logic_audit": [],
        "cognitive_journey": {}
    }

    # 逻辑审计
    titles = [c.get("title", "") for c in candidates if c.get("title")]
    if titles:
        result["logic_audit"] = audit_batch(titles)

    # 认知旅程
    if history_topics is not None:
        thesis = candidates[0].get("title", "") if candidates else ""
        if thesis:
            result["cognitive_journey"] = calculate_cognitive_journey(thesis, history_topics)

    return result


# ============ 辅助函数 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    from call_llm import call_llm_raw
    return call_llm_raw(prompt, temperature=0.7, scene="reasoning", error_prefix="[Error] LLM:")


def _parse_llm_json(text: str) -> Optional[Dict]:
    """从 LLM 输出中解析 JSON"""
    if not text:
        return None

    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[Warning] JSON 解析失败: {e}", file=sys.stderr)

    return None


# ============ CLI 入口 ============

def _safe_print(obj):
    output = json.dumps(obj, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")


def main():
    if len(sys.argv) < 3:
        _safe_print({
            "error": "用法: logic_pressure.py <命令> <数据>",
            "commands": {
                "audit": "logic_pressure.py audit \"<标题>\" - 逻辑审计",
                "journey": "logic_pressure.py journey \"<命题>\" \"[<历史命题>] - 认知旅程",
                "full": "logic_pressure.py full '[{\"title\": \"...\"}]' - 完整流程"
            }
        })
        sys.exit(1)

    command = sys.argv[1]

    if command == "audit":
        title = sys.argv[2] if len(sys.argv) > 2 else ""
        result = audit_title(title)
        _safe_print(result)

    elif command == "journey":
        thesis = sys.argv[2] if len(sys.argv) > 2 else ""
        history_str = sys.argv[3] if len(sys.argv) > 3 else "[]"
        try:
            history = json.loads(history_str)
        except json.JSONDecodeError:
            history = []
        result = calculate_cognitive_journey(thesis, history)
        _safe_print(result)

    elif command == "full":
        candidates_str = sys.argv[2] if len(sys.argv) > 2 else "[]"
        try:
            candidates = json.loads(candidates_str)
        except json.JSONDecodeError:
            candidates = []
        history_str = sys.argv[3] if len(sys.argv) > 3 else "[]"
        try:
            history = json.loads(history_str)
        except json.JSONDecodeError:
            history = []
        result = logic_pressure(candidates, history)
        _safe_print(result)

    else:
        _safe_print({"error": f"未知命令: {command}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
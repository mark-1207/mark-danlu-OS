#!/usr/bin/env python3
"""
PRISM-OS Phase 1: 苏格拉底网关（Socratic Gateway）
熵值计算脚本

用法:
    python socratic_gateway.py classify "<用户输入>"
    python socratic_gateway.py entropy "<用户输入>"
    python socratic_gateway.py gateway "<用户输入>"
"""

import sys
import json
import os
import re
from typing import Dict, List, Optional

# ============ 常量 ============
FALLBACK_TITLE_LENGTH = 10

# ============ Phase 1: 输入分类 ============

def classify_input(user_raw_input: str) -> str:
    """
    检测输入类型: keyword / sentence / question

    Args:
        user_raw_input: 用户原始输入

    Returns:
        输入类型: "keyword" | "sentence" | "question"
    """
    user_raw_input = user_raw_input.strip()

    # 检测是否包含问号（中文或英文）或疑问词模式
    has_question_mark = "?" in user_raw_input or "：" in user_raw_input

    # 检测中文疑问词模式
    chinese_question_patterns = ["为什么", "怎么", "如何", "怎麼", "是不是", "好不好", "要不要", "会不会", "能不能", "是谁", "是什么", "在哪", "几", "多少"]
    has_chinese_question = any(p in user_raw_input for p in chinese_question_patterns)

    # 对于中文：用字符数判断 keyword；英文：用空格数
    # keyword: 中文 < 10 个字符且无完整语义，英文 < 3 个单词
    # sentence: 中文 >= 10 个字符或表达完整语义
    is_keyword = False
    if " " in user_raw_input:
        # 英文，按空格分割
        is_keyword = len(user_raw_input.split()) <= 2
    else:
        # 中文，按字符数判断
        # 10 个字符以下通常是片段，10+ 才算完整句子
        is_keyword = len(user_raw_input) < 10

    if is_keyword:
        return "keyword"
    elif has_question_mark or has_chinese_question:
        return "question"
    else:
        return "sentence"


def generate_clarification_questions(user_input: str, input_type: str) -> List[str]:
    """
    根据输入类型生成追问选项

    Args:
        user_input: 用户输入
        input_type: classify_input 返回的类型

    Returns:
        2-3 个追问选项
    """
    base_prompt = f"""用户输入类型: {input_type}
用户输入: "{user_input}"

请生成 2-3 个追问，帮助用户将模糊意图明确化。

追问原则：
- keyword 类型: 追问核心观点、受众关联、期望行动
- sentence 类型: 追问背后假设、反驳角度、具体场景
- question 类型: 追问标准答案、打破常识、差异化答案

返回 JSON:
{{"questions": ["追问1", "追问2", "追问3"]}}
"""
    raw_result = _call_llm_raw(base_prompt)
    if not raw_result:
        return []

    # 解析 JSON
    try:
        data = json.loads(raw_result)
        questions = data.get("questions", [])
        if isinstance(questions, list) and len(questions) > 0:
            return questions
    except:
        pass

    # fallback: 尝试从字符串中提取
    try:
        match = re.search(r'\[.*\]', raw_result, re.DOTALL)
        if match:
            questions = json.loads(match.group(0))
            if isinstance(questions, list):
                return questions
    except:
        pass

    return []


# ============ Phase 1: 熵值计算（规则版 Phase 4.7） ============

def _rule_object_clarity(text: str) -> float:
    """规则计算对象清晰度（0-1）"""
    # 明确的具体对象
    specific_patterns = [
        r"^(老板|员工|程序员|设计师|运营|销售|医生|老师|学生|家长|小孩|男性|女性)\s",
        r"(老板|员工|程序员|设计师|运营|销售|医生|老师|学生|家长|小孩|男性|女性)的",
        r"自媒体(创作者|人|账号)|(小红书|公众号|抖音|B站)(创作者|博主|账号)",
        r"(初级|中级|高级|资深)\s", r"(00后|90后|80后|70后)\s",
        r"(创业|互联网|金融|教育|医疗|电商|AI)\s",
        r"(字节|腾讯|阿里|百度|美团|拼多多|京东)\s",
    ]
    for p in specific_patterns:
        if re.search(p, text):
            return 1.0

    # 模糊对象
    vague_patterns = [r"(年轻人|打工人|普通人|大家|人们|所有人|很多人)", r"(一个人|某人|有人)"]
    for p in vague_patterns:
        if re.search(p, text):
            return 0.5

    # 无对象
    no_object_patterns = [r"^(很|觉得|感觉|好像|如何|怎么|为什么)", r"(迷茫|焦虑|困惑|无聊|无聊)"]
    for p in no_object_patterns:
        if re.search(p, text):
            return 0.0

    return 0.3


def _rule_conflict_tension(text: str) -> float:
    """规则计算冲突张力（0-1）"""
    # 强矛盾关键词
    strong_conflict = [
        "越", "却", "反而", "然而", "但", "事实上", "其实", "真相是",
        "表面上", "实际上", "并非", "不是", "反而", "竟然", "居然",
        "越X越Y", "越来越", "一边X一边Y",
    ]
    # 反常识关键词
    anti_common = [
        "反直觉", "不对", "错了", "不是这样", "误区", "陷阱",
        "淘汰", "失业", "崩塌", "危机", "终结", "消亡",
    ]

    text_lower = text.lower()
    strong_count = sum(1 for kw in strong_conflict if kw in text_lower)
    anti_count = sum(1 for kw in anti_common if kw in text_lower)

    if strong_count >= 2 or anti_count >= 2:
        return 1.0
    elif strong_count >= 1 or anti_count >= 1:
        return 0.7
    elif strong_count > 0:
        return 0.5
    return 0.3


def _rule_fact_support(text: str) -> float:
    """规则计算事实支撑度（0-1）"""
    # 有具体数据
    if re.search(r"\d+%|\d+万|\d+亿|\d+年|\d+月|\d+日|\d+岁", text):
        return 1.0
    # 有具体案例
    case_patterns = [r"(比如|例如|有个|曾经|一次|身边|朋友|同事|公司)", r"(案例|故事|经历|现象)"]
    if any(re.search(p, text) for p in case_patterns):
        return 0.7
    # 有现象描述
    phenomenon = ["发现", "看到", "感觉", "觉得", "似乎", "好像", "看起来"]
    if any(kw in text for kw in phenomenon):
        return 0.4
    # 纯情绪
    emotion_only = ["开心", "难过", "焦虑", "迷茫", "无聊", "不爽", "好累", "好烦"]
    if all(kw in text for kw in emotion_only[:2]):
        return 0.0
    return 0.2


def calculate_entropy(user_input: str, user_config: Optional[Dict] = None) -> Dict:
    """
    计算命题熵值，评估用户输入的质量（Phase 4.7 规则版）

    熵值公式: Entropy = Object×0.4 + Conflict×0.4 + Fact×0.2

    决策规则:
    - Entropy < 1.5 → "blocked"，拦截重构
    - Entropy < 2.5 → "clarify"，迫选追问
    - Entropy >= 2.5 → "pass"，直接放行

    Returns:
        {
            "object_clarity": float,
            "conflict_tension": float,
            "fact_support": float,
            "entropy_score": float,
            "decision": "blocked" | "clarify" | "pass",
            "reason": str
        }
    """
    object_score = _rule_object_clarity(user_input)
    conflict_score = _rule_conflict_tension(user_input)
    fact_score = _rule_fact_support(user_input)
    entropy = object_score * 0.4 + conflict_score * 0.4 + fact_score * 0.2

    if entropy >= 2.5:
        decision = "pass"
        reason = "命题清晰、有张力、有事实支撑"
    elif entropy >= 1.5:
        decision = "clarify"
        reason = "命题基本合格，建议补充具体对象或事实"
    else:
        decision = "blocked"
        reason = "命题过于模糊或空洞，需重构"

    return {
        "object_clarity": round(object_score, 2),
        "conflict_tension": round(conflict_score, 2),
        "fact_support": round(fact_score, 2),
        "entropy_score": round(entropy, 2),
        "decision": decision,
        "reason": reason
    }


# ============ Phase 1: 苏格拉底网关主流程 ============

def socratic_gateway(user_input: str, user_config: Optional[Dict] = None) -> Dict:
    """
    苏格拉底网关主流程

    Args:
        user_input: 用户原始输入
        user_config: 用户配置（可选）

    Returns:
        {
            "status": "ready_for_generation" | "need_clarification" | "blocked",
            "input_type": "keyword" | "sentence" | "question",
            "entropy_score": float,
            "decision": "blocked" | "clarify" | "pass",
            "reason": str,
            "directions": [str, ...]  # 仅当 decision=clarify 时
            "questions": []           # 保持字段兼容
        }
    """
    # Step 1: 输入分类
    input_type = classify_input(user_input)

    # Step 2: 熵值计算
    entropy_result = calculate_entropy(user_input, user_config)

    if entropy_result["decision"] == "error":
        return {
            "status": "error",
            "input_type": input_type,
            "entropy_score": 0.0,
            "decision": "error",
            "reason": entropy_result["reason"],
            "questions": []
        }

    # Step 3: 决策处理
    decision = entropy_result["decision"]

    if decision == "blocked":
        return {
            "status": "blocked",
            "input_type": input_type,
            "entropy_score": entropy_result["entropy_score"],
            "decision": "blocked",
            "reason": entropy_result["reason"],
            "questions": []
        }

    elif decision == "clarify":
        # 生成追问问题（保持原有逻辑）
        questions = generate_clarification_questions(user_input, input_type)
        if not questions:
            questions = [
                "你想表达的核心观点是什么？",
                "这篇文章的目标读者是谁？",
                "你希望读者看完后有什么行动？"
            ]

        # 生成方向选项（追加到返回结果，不影响追问逻辑）
        directions = generate_directions(user_input, input_type)
        if not directions:
            directions = [
                f"聚焦{user_input[:FALLBACK_TITLE_LENGTH]}的角度A",
                f"聚焦{user_input[:FALLBACK_TITLE_LENGTH]}的角度B",
                f"聚焦{user_input[:FALLBACK_TITLE_LENGTH]}的角度C"
            ]

        return {
            "status": "need_clarification",
            "input_type": input_type,
            "entropy_score": entropy_result["entropy_score"],
            "decision": "clarify",
            "reason": entropy_result["reason"],
            "questions": questions,  # 原有追问逻辑保持不变
            "directions": directions  # 追加方向选项供备选队列使用
        }

    else:  # pass
        return {
            "status": "ready_for_generation",
            "input_type": input_type,
            "entropy_score": entropy_result["entropy_score"],
            "decision": "pass",
            "reason": entropy_result["reason"],
            "questions": []
        }


# ============ 辅助函数 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM，返回原始文本"""
    from call_llm import call_llm

    # Phase 1 使用 reasoning scene
    scene = os.environ.get("GATEWAY_SCENE", "reasoning")
    os.environ["GATEWAY_SCENE"] = scene

    result = call_llm(prompt)

    if result.get("error"):
        print(f"LLM 调用错误: {result['error']}", file=sys.stderr)
        return None

    return result.get("content")


def _parse_llm_json(text: str) -> Optional[Dict]:
    """从 LLM 输出中解析 JSON"""
    if not text:
        return None

    # 尝试提取 JSON 代码块
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试找到 JSON 对象
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except:
        pass

    return None


# ============ 选题方向生成 ============

DIRECTION_PROMPT = """你是选题方向生成器。根据用户输入，生成 2-3 个具体的选题方向。

用户输入: "{user_input}"
输入类型: {input_type}

方向要求：
- 每个方向是一个完整的选题角度，不是追问
- 方向之间正交（覆盖不同角度）
- 包含具体对象和冲突张力

返回 JSON:
{{"directions": ["方向1", "方向2", "方向3"]}}"""


def generate_directions(user_input: str, input_type: str) -> List[str]:
    """
    生成 2-3 个具体方向选项（替代追问问题）
    Returns: ["方向1", "方向2", "方向3"]
    """
    prompt = DIRECTION_PROMPT.format(
        user_input=user_input,
        input_type=input_type
    )

    result = _call_llm_raw(prompt)
    if not result:
        return []

    parsed = _parse_llm_json(result)
    if not parsed:
        return []

    directions = parsed.get("directions", [])
    if isinstance(directions, list) and len(directions) > 0:
        return [d for d in directions if isinstance(d, str) and d.strip()]

    return []


# ============ CLI 入口 ============

def _safe_print(obj):
    """修复 Windows GBK 编码问题：使用 binary mode"""
    output = json.dumps(obj, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")

def main():
    if len(sys.argv) < 3:
        _safe_print({
            "error": "用法: python socratic_gateway.py <命令> <输入>",
            "commands": {
                "classify": "python socratic_gateway.py classify <输入> - 输入分类",
                "entropy": "python socratic_gateway.py entropy <输入> - 熵值计算",
                "gateway": "python socratic_gateway.py gateway <输入> - 完整网关流程"
            }
        })
        sys.exit(1)

    command = sys.argv[1]
    user_input = sys.argv[2]

    if command == "classify":
        result = {"input_type": classify_input(user_input)}
        _safe_print(result)

    elif command == "entropy":
        result = calculate_entropy(user_input)
        _safe_print(result)

    elif command == "gateway":
        result = socratic_gateway(user_input)
        _safe_print(result)

    else:
        _safe_print({"error": f"未知命令: {command}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
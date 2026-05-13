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


# ============ Phase 1: 熵值计算 ============

def calculate_entropy(user_input: str, user_config: Optional[Dict] = None) -> Dict:
    """
    计算命题熵值，评估用户输入的质量

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
    prompt = _build_entropy_prompt(user_input)

    try:
        response = _call_llm_raw(prompt)
        if not response:
            return _entropy_error_result("LLM 调用失败")

        # 尝试解析 JSON
        result = _parse_llm_json(response)
        if not result:
            return _entropy_error_result(f"JSON 解析失败: {response[:100]}")

        # 验证必需字段
        required = ["object_clarity", "conflict_tension", "fact_support", "entropy_score", "decision", "reason"]
        for field in required:
            if field not in result:
                return _entropy_error_result(f"缺少字段: {field}")

        # 验证 decision 值
        if result["decision"] not in ["blocked", "clarify", "pass"]:
            return _entropy_error_result(f"无效 decision 值: {result['decision']}")

        return result

    except Exception as e:
        return _entropy_error_result(f"异常: {str(e)}")


def _build_entropy_prompt(user_input: str) -> str:
    """构建熵值计算 Prompt"""
    return f"""你是严格的命题审查员。评估用户输入的命题质量，按三个维度打分（0-1）：

1. Object_Clarity（对象清晰度）：命题是否指向具体对象？
   - 1.0：明确对象（如"自媒体创作者"、"初级程序员"）
   - 0.5：模糊对象（如"年轻人"、"打工人"）
   - 0.0：无对象（如"感觉很迷茫"、"想做点什么"）

2. Conflict_Tension（冲突张力）：命题是否包含矛盾或反常识元素？
   - 1.0：强矛盾（如"AI 让执行者失业"、"越努力越贫穷"）
   - 0.5：弱矛盾（如"AI 改变工作方式"）
   - 0.0：无矛盾（如"AI 很强大"、"要努力工作"）

3. Fact_Support（事实支撑）：命题是否基于具体现象？
   - 1.0：有具体案例或数据
   - 0.5：有模糊描述
   - 0.0：纯情绪表达

计算公式：Entropy = Object×0.4 + Conflict×0.4 + Fact×0.2

用户输入：{user_input}

返回 JSON：
{{
  "object_clarity": 0.0-1.0,
  "conflict_tension": 0.0-1.0,
  "fact_support": 0.0-1.0,
  "entropy_score": 0.0-3.0,
  "decision": "blocked" | "clarify" | "pass",
  "reason": "简短理由"
}}"""


def _entropy_error_result(reason: str) -> Dict:
    """构建熵值计算错误结果"""
    return {
        "object_clarity": 0.0,
        "conflict_tension": 0.0,
        "fact_support": 0.0,
        "entropy_score": 0.0,
        "decision": "error",
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
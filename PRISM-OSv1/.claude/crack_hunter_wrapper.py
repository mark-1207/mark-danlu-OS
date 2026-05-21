#!/usr/bin/env python3
"""
PRISM-OS 认知裂缝捕捉器封装
调用 Phase 8 LLM 分析 RSS 内容，发现认知裂缝并提炼认知信号

用法:
    from crack_hunter_wrapper import build_prompt, parse_result, analyze_content
"""

import json
import re
from typing import Dict, List, Optional, Tuple

# ============ 配置 ============

CONFIDENCE_THRESHOLD = 0.75  # 置信度阈值

SIGNAL_EXTRACTION_PROMPT = """你是认知裂缝猎人，负责从新闻/文章中发现认知裂缝并提炼认知信号。

**任务**：分析以下内容，输出结构化的认知信号。

**内容**：
标题：{title}
来源：{source}
摘要：{summary}

**输出 JSON**：
{{
  "has_crack": true/false,
  "crack_type": "数据裂缝/逻辑裂缝/时效裂缝/视角裂缝/因果裂缝/无",
  "consensus": "被挑战的共识/常识（如无，填'无'）",
  "reality": "与共识相悖的现实（如无，填'无'）",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由（50字内）",

  "signals": {{
    "trend": "识别出的趋势变化（50字内，如无填'无'）",
    "emotion": ["焦虑", "兴奋", "替代感", "身份危机", "阶层焦虑"],
    "contradiction": "最值得表达的矛盾（50字内，如无填'无'）",
    "homogenization_alert": "是否已同质化？全网是否在重复同类话题？（是/否/不确定）"
  }},

  "expression_angles": [
    {{
      "type": "创作者类型（技术型/认知型/商业型）",
      "angle": "适合从这个角度切入的表达入口（50字内）",
      "resonance": 0.0-1.0
    }}
  ],

  "title_suggestions": ["建议标题1", "建议标题2"]
}}"""


# ============ Prompt 构建 ============

def build_prompt(article_title: str, article_content: str, source: str = "") -> str:
    """
    封装 Phase 8 prompt（v2.0 — 信号提炼版）

    Args:
        article_title: 文章标题
        article_content: 文章内容/摘要
        source: 来源

    Returns:
        str: 完整的 prompt
    """
    return SIGNAL_EXTRACTION_PROMPT.format(
        title=article_title,
        source=source,
        summary=article_content[:500] if len(article_content) > 500 else article_content
    )


# ============ 结果解析 ============

def parse_result(raw_output: str) -> Optional[Dict]:
    """
    解析裂缝分析结果（v2.0 — 支持 signals/expression_angles）

    Args:
        raw_output: LLM 原始输出

    Returns:
        Dict 或 None
    """
    if not raw_output:
        return None

    # 尝试提取 JSON
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw_output, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        # 尝试直接找 {...}
        start = raw_output.find("{")
        end = raw_output.rfind("}") + 1
        if start >= 0 and end > start:
            text = raw_output[start:end]
        else:
            return None

    try:
        result = json.loads(text)

        # 验证必要字段
        required_fields = ["has_crack", "crack_type", "confidence"]
        for field in required_fields:
            if field not in result:
                return None

        return result
    except json.JSONDecodeError:
        return None


# ============ 认知裂缝分析主函数 ============

def analyze_content(
    article_title: str,
    article_content: str,
    source: str = ""
) -> Tuple[bool, Dict]:
    """
    分析内容是否包含认知裂缝（v2.0 — 提炼 5 类认知信号）

    Args:
        article_title: 文章标题
        article_content: 文章内容
        source: 来源

    Returns:
        (是否有裂缝, 分析结果Dict)
    """
    # 构建 prompt
    prompt = build_prompt(article_title, article_content, source)

    # 调用 LLM
    result = _call_llm(prompt)

    if not result:
        return False, {"error": "LLM 调用失败"}

    # 解析结果
    parsed = parse_result(result.get("content", ""))

    if not parsed:
        return False, {"error": "结果解析失败"}

    # 检查置信度阈值
    confidence = parsed.get("confidence", 0)
    has_crack = parsed.get("has_crack", False) and confidence >= CONFIDENCE_THRESHOLD

    if has_crack:
        # 限制 expression_angles 数量
        if "expression_angles" in parsed:
            parsed["expression_angles"] = parsed["expression_angles"][:3]
        # 限制 title_suggestions 数量
        if "title_suggestions" in parsed:
            parsed["title_suggestions"] = parsed["title_suggestions"][:3]

    return has_crack, parsed


# ============ 辅助函数 ============

def _call_llm(prompt: str) -> Optional[Dict]:
    """调用 LLM"""
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", "prism-os", "scripts"))

    try:
        from call_llm import call_llm
        scene = os.environ.get("GATEWAY_SCENE", "reasoning")
        os.environ["GATEWAY_SCENE"] = scene
        return call_llm(prompt)
    except Exception as e:
        print(f"[Error] LLM 调用失败: {e}")
        return None


# ============ 主函数测试 ============

if __name__ == "__main__":
    print("crack_hunter_wrapper.py - 认知裂缝捕捉测试 (v2.0)")

    print("\n[测试] build_prompt...")
    prompt = build_prompt(
        "AI让程序员失业率上升30%",
        "根据最新调研报告显示，AI工具的普及导致全球范围内程序员失业率显著上升...",
        "知乎热榜"
    )
    print(f"  Prompt 长度: {len(prompt)} 字符")

    print("\n[测试] parse_result...")
    test_json = '''
    {
      "has_crack": true,
      "crack_type": "数据裂缝",
      "consensus": "AI会创造更多就业机会",
      "reality": "AI导致程序员失业率上升30%",
      "confidence": 0.85,
      "reasoning": "数据与主流叙事相悖",
      "signals": {
        "trend": "程序员职业安全感正在崩塌",
        "emotion": ["替代焦虑", "身份危机"],
        "contradiction": "AI 提高生产力，但降低普通内容价值",
        "homogenization_alert": "否"
      },
      "expression_angles": [
        {"type": "认知型创作者", "angle": "AI对普通程序员的影响：身份危机", "resonance": 0.9},
        {"type": "商业型创作者", "angle": "AI 时代人力结构变化", "resonance": 0.7}
      ],
      "title_suggestions": [
        "为什么AI创造就业的数据是错的？",
        "程序员失业潮：被忽视的真相"
      ]
    }
    '''
    parsed = parse_result(test_json)
    print(f"  解析结果: {parsed}")

    if parsed and parsed.get("signals"):
        print(f"  signals: {parsed['signals']}")
    if parsed and parsed.get("expression_angles"):
        print(f"  expression_angles: {parsed['expression_angles']}")

    print("\n测试完成！")
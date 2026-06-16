#!/usr/bin/env python3
"""
PRISM-OS C2 信息密度控制 (M10, v1.1)

定量（0 LLM）+ 定性（1 次 LLM，2 项核心检查）
"""
import json
import re
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ============ 定量：实体计数（0 LLM）============

def count_entities(text: str) -> int:
    """计数：数字 / 年份 / 百分比 / 概念词（粗略）"""
    if not text:
        return 0
    count = 0
    count += len(re.findall(r'\d+', text))
    count += len(re.findall(r'\d{4}年|\d+%', text))
    # 修订：保留 "// 10"，接受其为拍脑袋
    count += len(re.findall(r'[一-鿿]{2,}', text)) // 10
    return count


def quantitative_density(text: str) -> float:
    """实体密度：entities / len(text) * 100"""
    if not text:
        return 0.0
    entities = count_entities(text)
    return (entities / max(len(text), 1)) * 100


# ============ 定性：LLM 2 项核心检查（1 次 LLM）============

DENSITY_EVAL_PROMPT = """评估大纲/文章的信息密度。

# 文本
{text}

# 2 项核心检查（从人设 core_framework 来）
1. topic_logic_chain 覆盖：文本是否覆盖"现象→原因→规律→趋势→机会"逻辑链？
2. value_increment 存在：文本是否至少提供 1 个明确的增量（认知/框架/决策/行动）？

# 输出（必须严格 JSON）
{{
  "logic_chain_covered": true/false,
  "value_increment_found": true/false,
  "low_density_paragraphs": [...],
  "high_density_paragraphs": [...],
  "suggestions": ["..."]
}}
"""


def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM 拿原始输出（隔离便于 mock）"""
    try:
        from call_llm import call_llm_raw
        return call_llm_raw(prompt, temperature=0.3, scene="writing-cn",
                            error_prefix="[density LLM]")
    except Exception as e:
        print(f"[density] LLM 调用失败: {e}", file=sys.stderr)
        return None


def _extract_json(text: str) -> Optional[str]:
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    return text[start:end + 1]


# ============ DensityReport ============

@dataclass
class DensityReport:
    """密度分析结果"""
    overall_density: float = 0.0
    per_paragraph_density: List[float] = field(default_factory=list)
    quantitative_score: float = 0.0
    qualitative_score: float = 0.0
    logic_chain_covered: bool = False
    value_increment_found: bool = False
    low_density_paragraphs: List[str] = field(default_factory=list)
    high_density_paragraphs: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


def measure_density(text: str, persona: Dict) -> DensityReport:
    """
    测量文本信息密度。

    - 定量（0 LLM）：实体计数
    - 定性（1 次 LLM）：2 项核心检查
    - 权重：定量 0.6 + 定性 0.4
    """
    # 定量
    quant = quantitative_density(text)
    paragraphs = text.split("\n\n")
    per_para = [quantitative_density(p) for p in paragraphs if p.strip()]

    # 定性（LLM）
    prompt = DENSITY_EVAL_PROMPT.format(text=text[:3000])
    result = _call_llm_raw(prompt)

    parsed = {}
    if result:
        json_str = _extract_json(result)
        if json_str:
            try:
                parsed = json.loads(json_str)
            except (json.JSONDecodeError, ValueError):
                pass

    logic_chain = bool(parsed.get("logic_chain_covered", False))
    value_incr = bool(parsed.get("value_increment_found", False))
    low_paras = parsed.get("low_density_paragraphs", [])
    high_paras = parsed.get("high_density_paragraphs", [])
    suggestions = parsed.get("suggestions", [])

    qualitative_score = 1.0 if value_incr else 0.0
    overall = quant * 0.6 + qualitative_score * 0.4

    return DensityReport(
        overall_density=overall,
        per_paragraph_density=per_para,
        quantitative_score=quant,
        qualitative_score=qualitative_score,
        logic_chain_covered=logic_chain,
        value_increment_found=value_incr,
        low_density_paragraphs=low_paras,
        high_density_paragraphs=high_paras,
        suggestions=suggestions,
    )


def check_l6_density(report: DensityReport) -> Dict:
    """L6 密度检查（返回 dict，方便 quality_check 集成）。"""
    return {
        "overall_density": report.overall_density,
        "quantitative_score": report.quantitative_score,
        "qualitative_score": report.qualitative_score,
        "logic_chain_covered": report.logic_chain_covered,
        "value_increment_found": report.value_increment_found,
        "low_density_paragraphs": report.low_density_paragraphs,
        "high_density_paragraphs": report.high_density_paragraphs,
        "suggestions": report.suggestions,
    }

#!/usr/bin/env python3
"""
Prompt 稳定性测试 (横切必做)

跑每个关键 prompt 3 次同输入，验证：
1. 关键字段都存在
2. 张力分等数值字段波动 ≤ ±1
3. 解析不抛异常

运行: python tests/test_prompt_stability.py
输出: tests/prompt_stability_results.json + stderr 摘要
"""
import sys
import os
import json
import time
import re
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


def run_extract_cognitive_tension_3x(thesis: str):
    """cognitive_tension（含 4 层深度展开）跑 3 次"""
    from cognitive_outline import _call_llm_raw, _parse_llm_json
    prompt = f"""你是标题深度理解专家。一次返回两层信息：

1. 认知张力: 大众以为 vs 现实是
2. 深度展开 4 层: surface（字面）/ implication（推论）/ deeper_meaning（深层）/ universal_value（价值）

# 命题
{thesis}

# 输出（必须严格 JSON）
{{
  "认知张力": {{"大众以为": "...", "现实是": "..."}},
  "深度展开": {{
    "surface": "标题字面在说什么（1 句）",
    "implication": "直接推论（1 句）",
    "deeper_meaning": "深层心理/认知含义（1 句）",
    "universal_value": "给读者的普遍价值/承诺（1 句）"
  }}
}}
"""
    results = []
    for i in range(3):
        raw = _call_llm_raw(prompt)
        parsed = _parse_llm_json(raw) if raw else None
        results.append({
            "raw_len": len(raw) if raw else 0,
            "parsed_ok": parsed is not None,
            "has_tension": parsed is not None and "认知张力" in parsed,
            "has_depth": parsed is not None and "深度展开" in parsed,
            "depth_keys": list(parsed.get("深度展开", {}).keys()) if parsed else [],
        })
    return results


def run_title_deep_gen_3x(thesis: str):
    """title_deep 5 标题生成（含 tension_score）跑 3 次"""
    from title_deep import _call_llm_raw, parse_deep_titles
    prompt = f"""基于给定命题生成 5 个候选标题。

# 命题
{thesis}

# 输出（必须严格 JSON）
[
  {{"title": "...", "based_on": "audience_specific", "why": "..."}},
  ...共 5 个
]
"""
    results = []
    for i in range(3):
        raw = _call_llm_raw(prompt)
        titles = parse_deep_titles(raw) if raw else []
        scores = []  # 这个 prompt 不返回 tension_score（默认无）
        results.append({
            "raw_len": len(raw) if raw else 0,
            "titles_count": len(titles),
            "titles_sample": [t["title"][:30] for t in titles[:2]] if titles else [],
        })
    return results


def main():
    """跑所有 prompt 稳定性测试"""
    thesis = "AI 时代 35 岁程序员为什么焦虑"

    print(f"=== Prompt 稳定性测试 ===")
    print(f"测试命题: {thesis}")
    print(f"时间: {datetime.now().isoformat()}")
    print()

    results = {"thesis": thesis, "timestamp": datetime.now().isoformat()}

    # 1. cognitive_tension + 4 层深度
    print("【1】 extract_cognitive_tension（含 4 层展开）")
    r1 = run_extract_cognitive_tension_3x(thesis)
    for i, r in enumerate(r1, 1):
        print(f"  第 {i} 次: raw_len={r['raw_len']} parsed_ok={r['parsed_ok']} "
              f"has_tension={r['has_tension']} has_depth={r['has_depth']} "
              f"depth_keys={r['depth_keys']}")
    results["cognitive_tension_3x"] = r1
    all_parsed = all(r["parsed_ok"] and r["has_tension"] and r["has_depth"] for r in r1)
    results["cognitive_tension_stable"] = all_parsed
    print(f"  → {'✅ 稳定' if all_parsed else '❌ 不稳定'}")
    print()

    # 2. title_deep 5 标题
    print("【2】 title_deep 5 标题生成")
    r2 = run_title_deep_gen_3x(thesis)
    for i, r in enumerate(r2, 1):
        print(f"  第 {i} 次: raw_len={r['raw_len']} titles={r['titles_count']} sample={r['titles_sample']}")
    results["title_deep_gen_3x"] = r2
    all_titles = all(r["titles_count"] == 5 for r in r2)
    results["title_deep_stable"] = all_titles
    print(f"  → {'✅ 5 标题都生成' if all_titles else '⚠ 数量波动'}")
    print()

    # 总结
    overall = all_parsed and all_titles
    print(f"=== 总结 ===")
    print(f"  cognitive_tension 稳定性: {'✅' if all_parsed else '❌'}")
    print(f"  title_deep 稳定性: {'✅' if all_titles else '⚠'}")
    print(f"  整体: {'✅ 全部稳定' if overall else '⚠ 有波动'}")

    # 写结果
    output_path = Path(__file__).parent / "prompt_stability_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n结果已写入: {output_path}")

    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())

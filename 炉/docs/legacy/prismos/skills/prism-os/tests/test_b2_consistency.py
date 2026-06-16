#!/usr/bin/env python3
"""outline_quality.py B2 4 层兑现测试 - M8: 标题-大纲一致性"""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from outline_quality import (
    check_consistency_4_layers,
    extract_keywords,
    expand_depth_from_tension_response,
    DEEP_TITLE_UNDERSTANDING_PROMPT,
    format_b2_report,
)


# ============ extract_keywords 单元测试 ============

class TestExtractKeywords(unittest.TestCase):
    """从标题提取关键元素"""

    def test_extracts_numbers(self):
        kws = extract_keywords("35 岁程序员焦虑的真相")
        self.assertIn("35", kws)
        self.assertIn("岁", kws)

    def test_extracts_chinese_phrases(self):
        kws = extract_keywords("AI 时代的认知升级方法")
        # 2+ 字中文片段
        self.assertTrue(any(len(kw) >= 2 for kw in kws))

    def test_extracts_english_words(self):
        kws = extract_keywords("AI tools for designers")
        self.assertIn("ai", kws)
        self.assertIn("tools", kws)

    def test_empty_title(self):
        self.assertEqual(extract_keywords(""), [])


# ============ expand_depth_from_tension_response 解析 ============

class TestExpandDepthParse(unittest.TestCase):
    """从 LLM 输出（同时含 tension + depth）解析 4 层深度"""

    def test_parses_combined_output(self):
        llm_output = '''{
            "cognitive_tension": {
                "mainstream": "学 AI 终身学习",
                "reality": "时间才是焦虑源"
            },
            "depth_expansion": {
                "surface": "AI 时代需要转型",
                "implication": "AI 替你不掉焦虑",
                "deeper_meaning": "35 岁的'时间感'是倒计时心态",
                "universal_value": "重新定义时间归属"
            }
        }'''
        result = expand_depth_from_tension_response(llm_output)
        self.assertIsNotNone(result)
        self.assertEqual(result["surface"], "AI 时代需要转型")
        self.assertEqual(result["implication"], "AI 替你不掉焦虑")
        self.assertEqual(result["deeper_meaning"], "35 岁的'时间感'是倒计时心态")
        self.assertEqual(result["universal_value"], "重新定义时间归属")

    def test_parses_code_block(self):
        llm_output = '''```json
{
    "depth_expansion": {
        "surface": "X",
        "implication": "Y",
        "deeper_meaning": "Z",
        "universal_value": "W"
    }
}
```'''
        result = expand_depth_from_tension_response(llm_output)
        self.assertIsNotNone(result)
        self.assertEqual(result["surface"], "X")

    def test_returns_none_on_invalid(self):
        self.assertIsNone(expand_depth_from_tension_response("not json"))
        self.assertIsNone(expand_depth_from_tension_response(""))

    def test_returns_none_on_missing_fields(self):
        """4 层任一缺失 → None"""
        llm_output = '{"depth_expansion": {"surface": "X", "implication": "Y"}}'
        self.assertIsNone(expand_depth_from_tension_response(llm_output))


# ============ check_consistency_4_layers 单元测试 ============

class TestCheckConsistency4Layers(unittest.TestCase):
    """B2 检查大纲对标题 4 层深度的兑现度"""

    def test_passes_when_all_layers_covered(self):
        """大纲覆盖了 4 层 → 全 covered"""
        # mock LLM 返回全覆盖
        mock_response = '''{
            "surface_covered": true,
            "implication_covered": true,
            "deeper_covered": true,
            "value_covered": true,
            "uncovered_layers": [],
            "delivery_score": 0.9,
            "missing_promises": [],
            "depth_suggestions": ["建议补..."]
        }'''
        with patch("outline_quality._call_llm_for_b2", return_value=mock_response):
            result = check_consistency_4_layers(
                "AI 时代如何转型",
                {"surface": "X", "implication": "Y", "deeper_meaning": "Z", "universal_value": "W"},
                {"认知模块流": [{"模块": "HOOK", "内容摘要": "..."}]},
            )
            self.assertEqual(len(result["uncovered_layers"]), 0)
            self.assertGreater(result["delivery_score"], 0.7)

    def test_detects_uncovered_layers(self):
        """大纲只覆盖 1 层 → uncovered_layers 列出 3 个"""
        mock_response = '''{
            "surface_covered": true,
            "implication_covered": false,
            "deeper_covered": false,
            "value_covered": false,
            "uncovered_layers": ["implication", "deeper_meaning", "universal_value"],
            "delivery_score": 0.25,
            "missing_promises": ["implication", "deeper_meaning", "universal_value"],
            "depth_suggestions": ["第 2 段加 implication 推论", "第 3 段加 deeper_meaning 深度", "结尾给 universal_value 价值"]
        }'''
        with patch("outline_quality._call_llm_for_b2", return_value=mock_response):
            result = check_consistency_4_layers("AI 时代", {"surface": "X"}, {"认知模块流": []})
            self.assertEqual(len(result["uncovered_layers"]), 3)
            self.assertIn("implication", result["uncovered_layers"])
            self.assertEqual(result["delivery_score"], 0.25)

    def test_suggestions_actionable(self):
        mock_response = '''{
            "surface_covered": true, "implication_covered": true,
            "deeper_covered": false, "value_covered": false,
            "uncovered_layers": ["deeper_meaning", "universal_value"],
            "delivery_score": 0.5,
            "missing_promises": [],
            "depth_suggestions": ["第 2 段加 deeper_meaning 深度", "结尾给 universal_value 价值"]
        }'''
        with patch("outline_quality._call_llm_for_b2", return_value=mock_response):
            result = check_consistency_4_layers("T", {"surface": "X"}, {})
            suggestions = result["depth_suggestions"]
            self.assertGreater(len(suggestions), 0)
            for s in suggestions:
                # suggestions 应是具体可执行的
                self.assertGreater(len(s), 5)


# ============ format_b2_report 展示 ============

class TestFormatB2Report(unittest.TestCase):
    """格式化 B2 报告"""

    def test_clean_report(self):
        result = {
            "uncovered_layers": [],
            "delivery_score": 1.0,
            "missing_promises": [],
            "depth_suggestions": [],
        }
        text = format_b2_report(result)
        self.assertIn("✓", text)

    def test_with_uncovered(self):
        result = {
            "uncovered_layers": ["deeper_meaning"],
            "delivery_score": 0.5,
            "missing_promises": ["deeper_meaning"],
            "depth_suggestions": ["加 deeper_meaning"],
        }
        text = format_b2_report(result)
        self.assertIn("⚠", text)
        self.assertIn("deeper_meaning", text)


# ============ DEEP_TITLE_UNDERSTANDING_PROMPT 模板 ============

class TestDeepTitleUnderstandingPrompt(unittest.TestCase):
    """expand_depth + cognitive_tension 合并的 prompt 模板"""

    def test_prompt_contains_4_layer_definitions(self):
        """prompt 模板含 4 层定义"""
        for layer in ["surface", "implication", "deeper_meaning", "universal_value"]:
            self.assertIn(layer, DEEP_TITLE_UNDERSTANDING_PROMPT)

    def test_prompt_asks_for_combined_output(self):
        """prompt 要求同时返回 cognitive_tension + depth_expansion"""
        self.assertIn("cognitive_tension", DEEP_TITLE_UNDERSTANDING_PROMPT)
        self.assertIn("depth_expansion", DEEP_TITLE_UNDERSTANDING_PROMPT)


if __name__ == "__main__":
    unittest.main(verbosity=2)

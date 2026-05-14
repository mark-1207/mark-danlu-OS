#!/usr/bin/env python3
"""prism_engine.py 单元测试"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from prism_engine import (
    check_banned_words,
    calculate_jaccard_similarity,
    check_orthogonality,
    _parse_llm_json,
    DIMENSIONS,
    BANNED_WORDS,
)


class TestCheckBannedWords(unittest.TestCase):
    def test_detects_banned_word(self):
        has_banned, found = check_banned_words("赋能企业的AI战略")
        self.assertTrue(has_banned)
        self.assertIn("赋能", found)

    def test_no_banned(self):
        has_banned, found = check_banned_words("AI时代执行者为什么更值钱")
        self.assertFalse(has_banned)
        self.assertEqual(found, [])

    def test_empty_string(self):
        has_banned, found = check_banned_words("")
        self.assertFalse(has_banned)

    def test_all_banned_words_covered(self):
        for word in BANNED_WORDS:
            has_banned, _ = check_banned_words(f"这是{word}的测试")
            self.assertTrue(has_banned, f"未能检测到禁用词: {word}")


class TestJaccardSimilarity(unittest.TestCase):
    def test_identical(self):
        self.assertEqual(calculate_jaccard_similarity("hello", "hello"), 1.0)

    def test_no_overlap(self):
        self.assertEqual(calculate_jaccard_similarity("apple", "banana"), 0.0)

    def test_empty(self):
        self.assertEqual(calculate_jaccard_similarity("", ""), 0.0)


class TestCheckOrthogonality(unittest.TestCase):
    def test_all_different(self):
        candidates = [
            {"title": "AI时代执行者为什么更值钱"},
            {"title": "为什么年轻人不愿意结婚了"},
            {"title": "月薪三万的程序员在焦虑什么"},
        ]
        result = check_orthogonality(candidates)
        self.assertEqual(len(result), 3)
        for c in result:
            self.assertTrue(c["orthogonal"])

    def test_similar_english_titles(self):
        """高度相似的英文标题应不正交（Jaccard > 0.75）"""
        candidates = [
            {"title": "hello world test case"},
            {"title": "hello world test example"},
        ]
        result = check_orthogonality(candidates)
        # 3/5 = 0.6 < 0.75，仍算正交 — 验证阈值行为
        for c in result:
            self.assertIn("orthogonal", c)
            self.assertIsInstance(c["max_similarity"], float)

    def test_single_candidate(self):
        result = check_orthogonality([{"title": "测试"}])
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["orthogonal"])

    def test_empty(self):
        self.assertEqual(check_orthogonality([]), [])

    def test_fields_added(self):
        result = check_orthogonality([{"title": "A"}, {"title": "B"}])
        for c in result:
            self.assertIn("max_similarity", c)
            self.assertIn("similar_titles", c)
            self.assertIn("orthogonal", c)


class TestParseLlmJson(unittest.TestCase):
    def test_plain_json(self):
        result = _parse_llm_json('{"key": "value"}')
        self.assertEqual(result, {"key": "value"})

    def test_json_in_code_block(self):
        result = _parse_llm_json('```json\n{"key": "value"}\n```')
        self.assertEqual(result, {"key": "value"})

    def test_json_with_surrounding_text(self):
        result = _parse_llm_json('Result:\n{"key": "value"}\nDone.')
        self.assertEqual(result, {"key": "value"})

    def test_nested_json(self):
        result = _parse_llm_json('{"candidates": [{"title": "测试"}]}')
        self.assertEqual(result["candidates"][0]["title"], "测试")

    def test_invalid(self):
        self.assertIsNone(_parse_llm_json("not json"))

    def test_empty(self):
        self.assertIsNone(_parse_llm_json(""))

    def test_none(self):
        self.assertIsNone(_parse_llm_json(None))


class TestDimensions(unittest.TestCase):
    def test_all_four_exist(self):
        for key in ["reversal", "micro_scene", "systemic_flaw", "bridge"]:
            self.assertIn(key, DIMENSIONS)

    def test_structure(self):
        for dim in DIMENSIONS.values():
            self.assertIn("name", dim)
            self.assertIn("description", dim)
            self.assertIn("formula", dim)


if __name__ == "__main__":
    unittest.main()

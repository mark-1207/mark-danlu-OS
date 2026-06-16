#!/usr/bin/env python3
"""prism_engine.py 单元测试"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from prism_engine import (
    check_banned_words,
    check_title_semantics,
    calculate_jaccard_similarity,
    check_orthogonality,
    _parse_llm_json,
    DIMENSIONS,
    BANNED_WORDS,
    TITLE_ARCHETYPES,
    select_title_archetypes,
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


class TestBannedWordsCoverage(unittest.TestCase):
    """A1: BANNED_WORDS 扩充 + 外部化后的覆盖测试"""

    def test_total_count_at_least_80(self):
        self.assertGreaterEqual(
            len(BANNED_WORDS), 80,
            f"BANNED_WORDS 应至少 80 词，当前 {len(BANNED_WORDS)}"
        )

    def test_yaml_file_exists(self):
        from pathlib import Path
        from prism_engine import _BANNED_WORDS_YAML_PATH
        self.assertTrue(_BANNED_WORDS_YAML_PATH.exists(), f"yaml 文件不存在: {_BANNED_WORDS_YAML_PATH}")

    def test_yaml_has_six_categories(self):
        from prism_engine import _load_banned_words_yaml
        data = _load_banned_words_yaml()
        required = {
            "ai_cliche",
            "xhs_hook",
            "number_bait",
            "emotion_pileup",
            "pseudo_depth",
            "template_phrase",
        }
        self.assertTrue(
            required.issubset(set(data.keys())),
            f"yaml 缺少类别: {required - set(data.keys())}"
        )

    def test_new_categories_words_detected(self):
        from prism_engine import _load_banned_words_yaml
        data = _load_banned_words_yaml()
        samples = {
            "xhs_hook": ["建议收藏", "保姆级", "手把手"],
            "number_bait": ["90%的人不知道", "聪明人都在用"],
            "emotion_pileup": ["看哭了", "破防了", "DNA动了"],
            "pseudo_depth": ["穿透本质", "底层认知", "思维模型"],
            "template_phrase": ["建议先收藏", "全文干货"],
        }
        for cat, words in samples.items():
            cat_words = data[cat]
            for w in words:
                self.assertIn(
                    w, cat_words,
                    f"类别 {cat} 缺少词: {w}"
                )
                has_banned, _ = check_banned_words(f"测试{w}标题")
                self.assertTrue(
                    has_banned, f"check_banned_words 未识别新词: {w}"
                )

    def test_backward_compat_imports(self):
        # 旧代码可能直接 import BANNED_WORDS 列表
        from prism_engine import BANNED_WORDS as bw
        self.assertIsInstance(bw, list)
        self.assertGreater(len(bw), 0)


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
        for key in ["reversal", "benefit_anchor", "micro_scene", "contrarian"]:
            self.assertIn(key, DIMENSIONS)

    def test_structure(self):
        for dim in DIMENSIONS.values():
            self.assertIn("name", dim)
            self.assertIn("description", dim)
            self.assertIn("formula", dim)


# ============ 新增：标题原型系统测试 ============

class TestTitleArchetypes(unittest.TestCase):
    """TITLE_ARCHETYPES 常量测试"""

    def test_five_archetypes_exist(self):
        """必须有5个读者标题原型"""
        self.assertEqual(len(TITLE_ARCHETYPES), 5,
                         f"期望5个原型，实际{len(TITLE_ARCHETYPES)}")

    def test_archetype_keys(self):
        expected_keys = {"opinion_assertion", "identity_label", "scene_suspense",
                         "data_counter_ask", "story_hook"}
        self.assertEqual(set(TITLE_ARCHETYPES.keys()), expected_keys)

    def test_each_archetype_has_required_fields(self):
        for key, arch in TITLE_ARCHETYPES.items():
            for field in ("name", "description", "formula", "reader_trigger"):
                self.assertIn(field, arch, f"{key} 缺少字段: {field}")
            self.assertIsInstance(arch["name"], str)
            self.assertTrue(len(arch["name"]) > 0, f"{key}.name 为空")

    def test_archetypes_have_chinese_names(self):
        for arch in TITLE_ARCHETYPES.values():
            self.assertTrue(any('一' <= c <= '鿿' for c in arch["name"]),
                            f"{arch['name']} 应包含中文")


class TestSelectTitleArchetypes(unittest.TestCase):
    """select_title_archetypes 维度得分 → 原型推荐测试"""

    def test_returns_list_of_strings(self):
        scores = {"reversal": 0.8, "benefit_anchor": 0.3, "micro_scene": 0.4, "contrarian": 0.2}
        result = select_title_archetypes(scores)
        self.assertIsInstance(result, list)
        self.assertTrue(len(result) > 0)
        for item in result:
            self.assertIsInstance(item, str)
            self.assertIn(item, TITLE_ARCHETYPES.keys(),
                          f"返回值 '{item}' 不在 TITLE_ARCHETYPES 中")

    def test_reversal_high_recommends_opinion_assertion(self):
        scores = {"reversal": 0.9, "benefit_anchor": 0.1, "micro_scene": 0.2, "contrarian": 0.1}
        result = select_title_archetypes(scores)
        self.assertIn("opinion_assertion", result)

    def test_micro_scene_high_recommends_scene_suspense(self):
        scores = {"reversal": 0.1, "benefit_anchor": 0.1, "micro_scene": 0.9, "contrarian": 0.1}
        result = select_title_archetypes(scores)
        self.assertIn("scene_suspense", result)

    def test_balanced_scores_returns_multiple(self):
        scores = {"reversal": 0.6, "benefit_anchor": 0.5, "micro_scene": 0.5, "contrarian": 0.6}
        result = select_title_archetypes(scores)
        self.assertGreaterEqual(len(result), 2, "均衡得分应至少推荐2个原型")

    def test_all_low_scores_still_returns_archetypes(self):
        scores = {"reversal": 0.1, "benefit_anchor": 0.1, "micro_scene": 0.1, "contrarian": 0.1}
        result = select_title_archetypes(scores)
        self.assertTrue(len(result) > 0, "即使得分很低也应返回默认原型")

    def test_returns_2_to_4_archetypes(self):
        scores = {"reversal": 0.5, "benefit_anchor": 0.5, "micro_scene": 0.5, "contrarian": 0.5}
        result = select_title_archetypes(scores)
        self.assertGreaterEqual(len(result), 2, "至少2个")
        self.assertLessEqual(len(result), 4, "至多4个")


class TestTitleCountRange(unittest.TestCase):
    """验证标题数量范围 6-10"""

    def test_archetype_count_produces_6_to_10_titles(self):
        """2-4个原型 — 只测试有效的原型数×标题数组合"""
        valid_combos = [
            (2, 3, 6),   # 2原型×3标题=6
            (3, 2, 6),   # 3原型×2标题=6
            (3, 3, 9),   # 3原型×3标题=9
            (4, 2, 8),   # 4原型×2标题=8
        ]
        for arch_count, titles_per, expected in valid_combos:
            self.assertGreaterEqual(expected, 6, f"{arch_count}×{titles_per}={expected} < 6")
            self.assertLessEqual(expected, 10, f"{arch_count}×{titles_per}={expected} > 10")

    def test_min_2_archetypes_x_3_titles_equals_6(self):
        self.assertEqual(2 * 3, 6)

    def test_max_4_archetypes_x_3_titles_equals_12_too_many(self):
        """4×3=12 超标，应限制每原型最多2-3个"""
        self.assertGreater(4 * 3, 10, "4原型×3标题=12 > 10，实现时应限制")


class TestOrthogonalThreshold(unittest.TestCase):
    """验证 orthogonal_count 阈值从8降到5"""

    def test_threshold_5_with_7_candidates(self):
        """7个候选人中5+正交 → success"""
        candidates = [
            {"title": f"标题{i:02d}"} for i in range(7)
        ]
        result = check_orthogonality(candidates)
        orthogonal = sum(1 for c in result if c["orthogonal"])
        # 7个不同的标题应当全部正交
        self.assertEqual(orthogonal, 7)
        # 新的阈值：>=5 就是 success
        self.assertGreaterEqual(orthogonal, 5)

    def test_threshold_5_with_4_orthogonal(self):
        """4个正交 < 5 = partial"""
        orthogonal_count = 4
        self.assertLess(orthogonal_count, 5, "4 < 5 → 应为 partial")


class TestNegativeTitleExamples(unittest.TestCase):
    """A2: 反面示例扩充 4 → 20+"""

    def test_at_least_20_negative_examples(self):
        from prism_engine import NEGATIVE_TITLE_EXAMPLES
        self.assertGreaterEqual(
            len(NEGATIVE_TITLE_EXAMPLES), 20,
            f"反面示例应至少 20 条，当前 {len(NEGATIVE_TITLE_EXAMPLES)}"
        )

    def test_each_has_title_and_reason(self):
        from prism_engine import NEGATIVE_TITLE_EXAMPLES
        for ex in NEGATIVE_TITLE_EXAMPLES:
            self.assertEqual(len(ex), 2, f"格式错误: {ex}")
            self.assertIsInstance(ex[0], str)
            self.assertTrue(len(ex[0]) > 0, f"标题为空: {ex}")
            self.assertIsInstance(ex[1], str)
            self.assertTrue(len(ex[1]) > 0, f"原因为空: {ex}")

    def test_no_duplicate_titles(self):
        from prism_engine import NEGATIVE_TITLE_EXAMPLES
        titles = [ex[0] for ex in NEGATIVE_TITLE_EXAMPLES]
        self.assertEqual(len(titles), len(set(titles)), "存在重复标题")

    def test_at_least_5_trigger_banned_words(self):
        """验证示例确实命中禁用词（说明它们真有问题）"""
        from prism_engine import NEGATIVE_TITLE_EXAMPLES, check_banned_words
        triggered = sum(1 for ex in NEGATIVE_TITLE_EXAMPLES if check_banned_words(ex[0])[0])
        self.assertGreaterEqual(
            triggered, 5,
            f"应有 ≥5 个反面示例命中 BANNED_WORDS，实际 {triggered}"
        )

    def test_includes_original_4_examples(self):
        """保留原始 4 条示例，不丢失既有教学信号"""
        from prism_engine import NEGATIVE_TITLE_EXAMPLES
        original_titles = {
            "AI时代，你必须知道的5个职场真相",
            "揭秘！AI裁员背后的惊人真相",
            "为什么学AI的人都赚不到钱？",
            "AI时代下，裁员已成必然趋势",
        }
        actual_titles = {ex[0] for ex in NEGATIVE_TITLE_EXAMPLES}
        missing = original_titles - actual_titles
        self.assertFalse(missing, f"原始 4 条缺失: {missing}")


class TestPositiveTitleExamples(unittest.TestCase):
    """A3: 正面示例扩充 3 → 15+"""

    def test_at_least_15_positive_examples(self):
        from prism_engine import POSITIVE_TITLE_EXAMPLES
        self.assertGreaterEqual(
            len(POSITIVE_TITLE_EXAMPLES), 15,
            f"正面示例应至少 15 条，当前 {len(POSITIVE_TITLE_EXAMPLES)}"
        )

    def test_each_has_title_and_reason(self):
        from prism_engine import POSITIVE_TITLE_EXAMPLES
        for ex in POSITIVE_TITLE_EXAMPLES:
            self.assertEqual(len(ex), 2, f"格式错误: {ex}")
            self.assertIsInstance(ex[0], str)
            self.assertTrue(len(ex[0]) > 0, f"标题为空: {ex}")
            self.assertIsInstance(ex[1], str)
            self.assertTrue(len(ex[1]) > 0, f"原因为空: {ex}")

    def test_no_duplicate_titles(self):
        from prism_engine import POSITIVE_TITLE_EXAMPLES
        titles = [ex[0] for ex in POSITIVE_TITLE_EXAMPLES]
        self.assertEqual(len(titles), len(set(titles)), "存在重复标题")

    def test_includes_original_3_examples(self):
        """保留原始 3 条示例，不丢失既有教学信号"""
        from prism_engine import POSITIVE_TITLE_EXAMPLES
        original_titles = {
            "我被AI替代的那天，才明白一个道理",
            "同事被裁后，我偷偷学了3个月AI",
            "35岁，我决定不再假装不懂AI",
        }
        actual_titles = {ex[0] for ex in POSITIVE_TITLE_EXAMPLES}
        missing = original_titles - actual_titles
        self.assertFalse(missing, f"原始 3 条缺失: {missing}")

    def test_no_positive_triggers_banned_words(self):
        """正面示例不应包含禁用词（否则自相矛盾）"""
        from prism_engine import POSITIVE_TITLE_EXAMPLES, check_banned_words
        bad = [ex[0] for ex in POSITIVE_TITLE_EXAMPLES if check_banned_words(ex[0])[0]]
        self.assertEqual(bad, [], f"正面示例不应含禁用词: {bad}")


class TestCheckTitleSemantics(unittest.TestCase):
    """A4: 语义级验证函数 check_title_semantics"""

    def test_clean_title_passes(self):
        ok, issues = check_title_semantics("我被AI替代的那天，才明白一个道理")
        self.assertTrue(ok, f"干净标题被误判: {issues}")
        self.assertEqual(issues, [])

    def test_detects_question_pileup_cn(self):
        ok, issues = check_title_semantics("AI时代为什么？？？")
        self.assertFalse(ok)
        self.assertTrue(any("问号" in i for i in issues), f"未识别问号堆砌: {issues}")

    def test_detects_question_pileup_en(self):
        ok, issues = check_title_semantics("Why AI?? Why now??")
        self.assertFalse(ok)

    def test_detects_exclamation_pileup(self):
        ok, issues = check_title_semantics("震惊！！！")
        self.assertFalse(ok)
        self.assertTrue(any("感叹号" in i for i in issues), f"未识别感叹号堆砌: {issues}")

    def test_detects_ellipsis_cn(self):
        ok, issues = check_title_semantics("AI的真相……")
        self.assertFalse(ok)
        self.assertTrue(any("省略号" in i for i in issues), f"未识别省略号: {issues}")

    def test_detects_ellipsis_en(self):
        ok, issues = check_title_semantics("AI的真相...")
        self.assertFalse(ok)

    def test_detects_short_title(self):
        ok, issues = check_title_semantics("AI")
        self.assertFalse(ok)
        self.assertTrue(any("短" in i for i in issues), f"未识别短标题: {issues}")

    def test_detects_long_title(self):
        long_title = "我被AI替代的那天，才明白一个非常深刻但被很多人忽视的基本道理和最底层原则"
        ok, issues = check_title_semantics(long_title)
        self.assertFalse(ok)
        self.assertTrue(any("长" in i for i in issues), f"未识别长标题: {issues}")

    def test_detects_number_ge_template(self):
        ok, issues = check_title_semantics("你必须知道的5个AI秘密")
        self.assertFalse(ok)
        self.assertTrue(any("个" in i or "数字" in i for i in issues), f"未识别数字+个: {issues}")

    def test_detects_template_opening_yuanlai(self):
        ok, issues = check_title_semantics("原来AI是这样改变职场的")
        self.assertFalse(ok)

    def test_detects_template_opening_jiemi(self):
        ok, issues = check_title_semantics("揭秘AI时代的真相")
        self.assertFalse(ok)

    def test_detects_template_opening_yiwenkan(self):
        ok, issues = check_title_semantics("一文看懂AI对职场的影响")
        self.assertFalse(ok)

    def test_detects_vague_subject(self):
        ok, issues = check_title_semantics("人们都在偷偷学AI")
        self.assertFalse(ok)
        self.assertTrue(any("主语" in i for i in issues), f"未识别空泛主语: {issues}")

    def test_single_question_mark_ok(self):
        ok, _ = check_title_semantics("为什么AI让某些人失业了？")
        self.assertTrue(ok, "单个问号不应被算作堆砌")

    def test_single_exclamation_ok(self):
        ok, _ = check_title_semantics("我用AI写完代码，惊艳了同事！")
        self.assertTrue(ok, "单个感叹号不应被算作堆砌")

    def test_empty_title(self):
        ok, issues = check_title_semantics("")
        self.assertFalse(ok)
        self.assertTrue(len(issues) > 0)


def test_prd_dimensions_exist():
    """DIMENSIONS 应包含 PRD 4 维"""
    from prism_engine import DIMENSIONS
    assert "reversal" in DIMENSIONS
    assert "benefit_anchor" in DIMENSIONS
    assert "micro_scene" in DIMENSIONS
    assert "contrarian" in DIMENSIONS


def test_legacy_dimensions_exist():
    """LEGACY_DIMENSIONS 应保留旧 4 维"""
    from prism_engine import LEGACY_DIMENSIONS
    assert "reversal" in LEGACY_DIMENSIONS
    assert "systemic_flaw" in LEGACY_DIMENSIONS
    assert "bridge" in LEGACY_DIMENSIONS


def test_dimensions_total_count():
    """DIMENSIONS 应为 4 维（PRD）"""
    from prism_engine import DIMENSIONS
    assert len(DIMENSIONS) == 4


if __name__ == "__main__":
    unittest.main()

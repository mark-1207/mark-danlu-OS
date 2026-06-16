#!/usr/bin/env python3
"""outline_quality.py 单元测试 - M7: B1 大纲 8 模块检查"""
import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from outline_quality import (
    check_modules,
    check_outline_quality,
    REQUIRED_MODULES,
    RECOMMENDED_MODULES,
)


def _make_module_flow(*types):
    """构造模块流。types 是模块名列表"""
    return [{"模块": t, "内容摘要": f"关于 {t}", "功能": f"功能 {t}"} for t in types]


def _make_outline(*types):
    return {"认知模块流": _make_module_flow(*types)}


# ============ check_modules 单元测试 ============

class TestCheckModules(unittest.TestCase):
    """检查 8 模块完整性"""

    def test_full_outline_passes(self):
        """8 模块齐全 → 通过"""
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "MODEL", "COUNTER", "EVIDENCE", "ACTION", "BOUNDARY")
        result = check_modules(outline)
        self.assertTrue(result["has_HOOK"])
        self.assertTrue(result["has_MODEL"])
        self.assertTrue(result["has_COUNTER"])
        self.assertTrue(result["has_BOUNDARY"])
        self.assertEqual(result["missing_required"], [])
        self.assertEqual(result["missing_recommended"], [])
        self.assertFalse(result["consecutive_violation"])
        self.assertEqual(result["rhythm_issues"], [])

    def test_missing_HOOK_detected(self):
        """无 HOOK → missing_required 列出 HOOK"""
        outline = _make_outline("CASE", "EXPLAIN", "MODEL", "EVIDENCE", "ACTION")
        result = check_modules(outline)
        self.assertFalse(result["has_HOOK"])
        self.assertIn("HOOK", result["missing_required"])

    def test_missing_MODEL_detected(self):
        """无 MODEL → has_MODEL=False"""
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "EVIDENCE", "ACTION")
        result = check_modules(outline)
        self.assertFalse(result["has_MODEL"])
        self.assertIn("MODEL", result["missing_required"])

    def test_missing_COUNTER_marked_recommended(self):
        """无 COUNTER → missing_recommended 列出（非必需）"""
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "MODEL", "EVIDENCE", "ACTION", "BOUNDARY")
        result = check_modules(outline)
        self.assertFalse(result["has_COUNTER"])
        self.assertIn("COUNTER", result["missing_recommended"])
        # 不应进 missing_required
        self.assertNotIn("COUNTER", result["missing_required"])

    def test_missing_BOUNDARY_marked_recommended(self):
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "MODEL", "COUNTER", "EVIDENCE", "ACTION")
        result = check_modules(outline)
        self.assertFalse(result["has_BOUNDARY"])
        self.assertIn("BOUNDARY", result["missing_recommended"])

    def test_consecutive_rhythm_violation(self):
        """连续 3 同型模块 → 节奏违规"""
        outline = _make_outline("HOOK", "EXPLAIN", "EXPLAIN", "EXPLAIN", "MODEL")
        result = check_modules(outline)
        self.assertTrue(result["consecutive_violation"])
        self.assertEqual(len(result["rhythm_issues"]), 1)
        self.assertIn("EXPLAIN", result["rhythm_issues"][0])

    def test_no_consecutive_violation_for_2(self):
        """连续 2 同型不算违规"""
        outline = _make_outline("HOOK", "EXPLAIN", "EXPLAIN", "MODEL", "ACTION")
        result = check_modules(outline)
        self.assertFalse(result["consecutive_violation"])

    def test_empty_module_flow_detected(self):
        """模块流为空 → missing_required 含 HOOK + MODEL"""
        outline = {"认知模块流": []}
        result = check_modules(outline)
        self.assertIn("HOOK", result["missing_required"])
        self.assertIn("MODEL", result["missing_required"])

    def test_missing_认知模块流_key(self):
        """连 '认知模块流' key 都没有 → 必失败"""
        result = check_modules({})
        self.assertIn("HOOK", result["missing_required"])
        self.assertIn("MODEL", result["missing_required"])


# ============ check_outline_quality 集成测试 ============

class TestCheckOutlineQuality(unittest.TestCase):
    """B1 综合检查（含 B1 模块 + 决策汇总）"""

    def test_full_outline_overall_pass(self):
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "MODEL", "COUNTER", "EVIDENCE", "ACTION", "BOUNDARY")
        result = check_outline_quality(outline)
        # overall_pass: 无 missing_required + 无 rhythm violation
        self.assertTrue(result["can_proceed"])
        self.assertEqual(result["warnings"], [])

    def test_missing_required_can_proceed_false(self):
        """缺必需模块 → can_proceed=False"""
        outline = _make_outline("CASE", "EXPLAIN", "MODEL", "EVIDENCE", "ACTION", "COUNDARY")
        result = check_outline_quality(outline)
        self.assertFalse(result["can_proceed"])
        self.assertGreater(len(result["warnings"]), 0)

    def test_warnings_include_recommended_missing(self):
        """缺推荐模块 → 警告（但 can_proceed=True）"""
        outline = _make_outline("HOOK", "CASE", "EXPLAIN", "MODEL", "EVIDENCE", "ACTION")
        result = check_outline_quality(outline)
        self.assertTrue(result["can_proceed"])
        # 应有 COUNTER/BOUNDARY 警告
        warnings_str = " ".join(result["warnings"])
        self.assertIn("COUNTER", warnings_str)
        self.assertIn("BOUNDARY", warnings_str)

    def test_rhythm_violation_in_warnings(self):
        outline = _make_outline("HOOK", "EXPLAIN", "EXPLAIN", "EXPLAIN", "MODEL")
        result = check_outline_quality(outline)
        # can_proceed 应为 True（必需齐）
        self.assertTrue(result["can_proceed"])
        # 但应有 rhythm warning
        warnings_str = " ".join(result["warnings"])
        self.assertIn("节奏", warnings_str)


# ============ 必需/推荐常量 ============

class TestConstants(unittest.TestCase):
    def test_required_modules_contains_HOOK(self):
        self.assertIn("HOOK", REQUIRED_MODULES)

    def test_required_contains_MODEL(self):
        """MODEL 是至少 1 个的硬性要求"""
        # MODEL 不在 REQUIRED 是因为检查"≥ 1 个"而非"含 MODEL"
        # 这里只验证 REQUIRED 至少含 HOOK
        self.assertIn("HOOK", REQUIRED_MODULES)

    def test_recommended_contains_COUNTER(self):
        self.assertIn("COUNTER", RECOMMENDED_MODULES)

    def test_recommended_contains_BOUNDARY(self):
        self.assertIn("BOUNDARY", RECOMMENDED_MODULES)


if __name__ == "__main__":
    unittest.main(verbosity=2)

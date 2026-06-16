#!/usr/bin/env python3
"""conflict_detect.py 单元测试 - M3 基础: 冲突检测"""
import sys
import os
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from conflict_detect import (
    detect_thesis_collision,
    detect_angle_collision,
    detect_audience_fatigue,
    detect_conflicts,
    format_report,
    filter_recent_history,
    jaccard_similarity,
)


# ============ 工具函数 ============

class TestJaccardSimilarity(unittest.TestCase):
    def test_identical_returns_1(self):
        self.assertEqual(jaccard_similarity("hello", "hello"), 1.0)

    def test_disjoint_returns_0(self):
        self.assertEqual(jaccard_similarity("abc", "xyz"), 0.0)

    def test_partial_overlap(self):
        sim = jaccard_similarity("abc", "acd")
        # |a,c| / |a,b,c,d| = 2/4 = 0.5
        self.assertAlmostEqual(sim, 0.5)

    def test_empty_strings(self):
        self.assertEqual(jaccard_similarity("", ""), 1.0)
        self.assertEqual(jaccard_similarity("abc", ""), 0.0)
        self.assertEqual(jaccard_similarity("", "abc"), 0.0)


# ============ filter_recent_history ============

class TestFilterRecentHistory(unittest.TestCase):
    def test_filters_by_30_days(self):
        now = datetime(2026, 6, 10)
        recent = {"title": "近的", "timestamp": (now - timedelta(days=5)).isoformat()}
        old = {"title": "远的", "timestamp": (now - timedelta(days=60)).isoformat()}
        result = filter_recent_history([recent, old], lookback_days=30, now=now)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "近的")

    def test_no_timestamp_included(self):
        """无 timestamp 的条目默认包含（不知道时间就不过滤）"""
        no_ts = {"title": "无时间戳"}
        result = filter_recent_history([no_ts], lookback_days=30, now=datetime(2026, 6, 10))
        self.assertEqual(len(result), 1)

    def test_empty_history(self):
        self.assertEqual(filter_recent_history([], 30, datetime(2026, 6, 10)), [])


# ============ A 命题撞车 ============

class TestThesisCollision(unittest.TestCase):
    def test_no_history_no_collision(self):
        result = detect_thesis_collision("AI 时代如何转型", [])
        self.assertEqual(result, [])

    def test_high_similarity_warns(self):
        history = [
            {"title": "AI 时代如何转型完全指南", "thesis": "AI 时代如何转型完全指南给你"},
            {"title": "AI 取代低端工作", "thesis": "AI 取代低端岗位"},
        ]
        # "AI 时代如何转型" vs "AI 时代如何转型完全指南" 是同一话题（高相似）
        result = detect_thesis_collision("AI 时代如何转型", history, threshold=0.4)
        self.assertGreater(len(result), 0)
        # 第二个话题"AI 取代低端" 不相关
        sims = [c["similarity"] for c in result]
        self.assertGreater(sims[0], 0.4)

    def test_low_similarity_no_collision(self):
        history = [
            {"thesis": "古代诗词鉴赏方法"},
            {"thesis": "周末爬山攻略"},
        ]
        result = detect_thesis_collision("AI 时代如何转型", history, threshold=0.6)
        self.assertEqual(result, [])

    def test_below_threshold_no_warn(self):
        history = [{"thesis": "AI 入门指南"}]  # 2 字重合
        result = detect_thesis_collision("AI 时代职场转型完全指南", history, threshold=0.8)
        self.assertEqual(result, [])


# ============ B 角度撞车 ============

class TestAngleCollision(unittest.TestCase):
    def test_similar_angles_warn(self):
        history = [
            {"title": "我被 AI 替代的那天", "rationale": "第一人称场景"},
        ]
        # 候选标题"我被 AI 替代后" 角度相似
        result = detect_angle_collision("我被 AI 替代后的反思", history, threshold=0.5)
        self.assertGreater(len(result), 0)

    def test_different_angles_no_collision(self):
        history = [
            {"title": "AI 时代创业指南"},
        ]
        result = detect_angle_collision("古代诗词赏析", history, threshold=0.5)
        self.assertEqual(result, [])


# ============ C 受众疲劳 ============

class TestAudienceFatigue(unittest.TestCase):
    def test_low_count_no_fatigue(self):
        history = [{"audience": "25-35 职场人"}] * 3
        result = detect_audience_fatigue("25-35 职场人", history, threshold_warn=5)
        self.assertEqual(result["level"], "none")

    def test_warn_at_5(self):
        history = [{"audience": "25-35 职场人"}] * 5
        result = detect_audience_fatigue("25-35 职场人", history, threshold_warn=5)
        self.assertEqual(result["level"], "warn")

    def test_high_at_8(self):
        history = [{"audience": "25-35 职场人"}] * 8
        result = detect_audience_fatigue("25-35 职场人", history, threshold_warn=5, threshold_high=8)
        self.assertEqual(result["level"], "high")

    def test_different_audience_no_fatigue(self):
        history = [{"audience": "程序员"}] * 10
        result = detect_audience_fatigue("设计师", history)
        self.assertEqual(result["level"], "none")


# ============ detect_conflicts (主入口) ============

class TestDetectConflicts(unittest.TestCase):
    def test_no_history(self):
        result = detect_conflicts("AI 时代如何转型", [], now=datetime(2026, 6, 10))
        self.assertEqual(result["thesis_collisions"], [])
        self.assertEqual(result["angle_collisions"], [])
        self.assertEqual(result["audience_fatigue"]["level"], "none")
        self.assertEqual(result["data_collisions"]["enabled"], False)

    def test_filters_old_history(self):
        now = datetime(2026, 6, 10)
        # 60 天前的高相似度条目不应触发
        history = [{
            "title": "AI 时代如何转型",
            "thesis": "AI 时代如何转型",
            "timestamp": (now - timedelta(days=60)).isoformat(),
        }]
        result = detect_conflicts("AI 时代如何转型", history, now=now, lookback_days=30)
        self.assertEqual(len(result["thesis_collisions"]), 0)

    def test_combines_all_three_types(self):
        now = datetime(2026, 6, 10)
        history = [
            {
                "title": "AI 时代如何转型的深度思考",
                "thesis": "AI 时代如何转型",
                "audience": "25-35 职场人",
                "timestamp": (now - timedelta(days=3)).isoformat(),
            },
        ] * 6  # 6 篇相同受众 + 高相似命题
        result = detect_conflicts("AI 时代如何转型", history, now=now,
                                 audience="25-35 职场人",
                                 thesis_threshold=0.4)
        # A 命题撞车
        self.assertGreater(len(result["thesis_collisions"]), 0)
        # C 受众疲劳（≥ 5）
        self.assertIn(result["audience_fatigue"]["level"], ("warn", "high"))

    def test_lookback_days_configurable(self):
        now = datetime(2026, 6, 10)
        history = [{
            "title": "AI 时代如何转型",
            "thesis": "AI 时代如何转型",
            "timestamp": (now - timedelta(days=20)).isoformat(),
        }]
        # 20 天在 30 天窗口内
        r1 = detect_conflicts("AI 时代如何转型", history, now=now, lookback_days=30)
        # 20 天在 10 天窗口外
        r2 = detect_conflicts("AI 时代如何转型", history, now=now, lookback_days=10)
        self.assertGreater(len(r1["thesis_collisions"]), 0)
        self.assertEqual(len(r2["thesis_collisions"]), 0)


# ============ format_report ============

class TestFormatReport(unittest.TestCase):
    def test_clean_report_short(self):
        report = {
            "thesis_collisions": [],
            "angle_collisions": [],
            "audience_fatigue": {"level": "none", "count": 0, "audience": "X"},
            "data_collisions": {"enabled": False, "note": "v1 暂不支持"},
        }
        text = format_report(report)
        # 无冲突时简短
        self.assertIn("✓", text)

    def test_report_with_warnings(self):
        report = {
            "thesis_collisions": [{"thesis": "AI 时代如何转型", "similarity": 0.75, "date": "2026-06-08"}],
            "angle_collisions": [{"title": "我被 AI 替代", "similarity": 0.6, "date": "2026-06-09"}],
            "audience_fatigue": {"level": "warn", "count": 5, "audience": "X"},
            "data_collisions": {"enabled": False, "note": "v1 暂不支持"},
        }
        text = format_report(report)
        self.assertIn("⚠", text)
        self.assertIn("AI 时代如何转型", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)

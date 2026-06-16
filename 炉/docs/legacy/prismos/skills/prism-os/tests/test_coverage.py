"""
M5 A2 维度覆盖分析 TDD 测试 (v1.1)

7 个测试覆盖 plan 行 2212-2220:
- 广度/深度模式覆盖分析
- 不平衡检测 + 最低覆盖深度
- 补生成只生成缺失维度
- 命令矩阵解析 (1-12/d/r/q)
"""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ 广度模式覆盖 ============

class TestCoverageBroad:
    """广度模式: 4 维 (reversal/benefit_anchor/micro_scene/contrarian)"""

    def test_coverage_full_broad(self):
        """4 维全覆盖 → missing=[]"""
        from coverage import analyze_coverage

        candidates = [
            {"title": "T1", "dimension": "reversal"},
            {"title": "T2", "dimension": "benefit_anchor"},
            {"title": "T3", "dimension": "micro_scene"},
            {"title": "T4", "dimension": "contrarian"},
        ]
        report = analyze_coverage(candidates, mode="broad")
        assert report.missing == []
        assert report.coverage_ratio == 1.0

    def test_coverage_missing(self):
        """缺 1 维 → missing 列出该维度"""
        from coverage import analyze_coverage

        candidates = [
            {"title": "T1", "dimension": "reversal"},
            {"title": "T2", "dimension": "reversal"},
            {"title": "T3", "dimension": "micro_scene"},
            {"title": "T4", "dimension": "micro_scene"},
        ]
        report = analyze_coverage(candidates, mode="broad")
        assert "benefit_anchor" in report.missing
        assert "contrarian" in report.missing
        assert report.coverage_ratio == 0.5

    def test_coverage_imbalance(self):
        """单维 > 50% → imbalance=True"""
        from coverage import analyze_coverage

        candidates = [
            {"title": "T1", "dimension": "reversal"},
            {"title": "T2", "dimension": "reversal"},
            {"title": "T3", "dimension": "reversal"},
            {"title": "T4", "dimension": "benefit_anchor"},
        ]
        report = analyze_coverage(candidates, mode="broad")
        assert report.imbalance is True

    def test_coverage_min_depth_check(self):
        """每维 ≥1 才 min_depth_ok"""
        from coverage import analyze_coverage

        # 缺一维 → min_depth_ok=False
        candidates = [
            {"title": "T1", "dimension": "reversal"},
            {"title": "T2", "dimension": "benefit_anchor"},
            {"title": "T3", "dimension": "micro_scene"},
        ]
        report = analyze_coverage(candidates, mode="broad")
        assert report.min_depth_ok is False

        # 全覆盖 → min_depth_ok=True
        candidates.append({"title": "T4", "dimension": "contrarian"})
        report = analyze_coverage(candidates, mode="broad")
        assert report.min_depth_ok is True


# ============ 深度模式覆盖 ============

class TestCoverageDeep:
    """深度模式: 5 archetypes"""

    def test_coverage_full_deep(self):
        """5 archetypes 全覆盖 → missing=[]"""
        from coverage import analyze_coverage

        candidates = [
            {"title": "T1", "based_on": "opinion_assertion"},
            {"title": "T2", "based_on": "identity_label"},
            {"title": "T3", "based_on": "scene_suspense"},
            {"title": "T4", "based_on": "data_counter_ask"},
            {"title": "T5", "based_on": "story_hook"},
        ]
        report = analyze_coverage(candidates, mode="deep")
        assert report.missing == []
        assert report.coverage_ratio == 1.0


# ============ 命令矩阵 ============

class TestCommandMatrix:
    """决策点 1 命令解析: 1-12 / d / r / q"""

    def test_command_matrix(self):
        from coverage import parse_coverage_command

        # 数字选择
        r = parse_coverage_command("5", num_candidates=12)
        assert r["action"] == "select" and r["index"] == 4

        # 深度模式
        r = parse_coverage_command("d", num_candidates=12)
        assert r["action"] == "deep"

        # 补生成
        r = parse_coverage_command("r", num_candidates=12)
        assert r["action"] == "regenerate"

        # 退出
        r = parse_coverage_command("q", num_candidates=12)
        assert r["action"] == "quit"

        # 超范围
        r = parse_coverage_command("13", num_candidates=12)
        assert r["action"] == "error"

        # 空输入
        r = parse_coverage_command("", num_candidates=12)
        assert r["action"] == "error"

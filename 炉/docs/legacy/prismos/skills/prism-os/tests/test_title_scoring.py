"""
M4 A1 认知张力评分 TDD 测试 (v1.1)

5 个测试覆盖 plan 行 2096-2102:
- tension_score 范围 (1-5)
- 解析 LLM JSON 提取 tension_score
- 排序权重: A1 主导排序
"""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ score_tension 解析 ============

class TestScoreTension:
    """score_tension: 从 dict 或 LLM 输出提取 tension_score"""

    def test_tension_score_in_range(self):
        """tension_score 必须在 1-5 范围内"""
        from title_scoring import score_tension

        # 正常值
        assert 1 <= score_tension({"tension_score": 3}) <= 5
        # 边界
        assert score_tension({"tension_score": 1}) >= 1
        assert score_tension({"tension_score": 5}) <= 5
        # 超范围应 clamp
        assert score_tension({"tension_score": 0}) >= 1
        assert score_tension({"tension_score": 10}) <= 5
        # 缺失 → 默认 3
        assert score_tension({}) == 3
        # 非 dict → 默认 3
        assert score_tension("invalid") == 3

    def test_tension_extracted_from_llm_output(self):
        """从 LLM JSON 输出中解析 tension_score（防御性：字段不存在 / 非数字）"""
        from title_scoring import score_tension

        # 完整 dict
        assert score_tension({"title": "T", "tension_score": 4}) == 4.0
        # 字符串数字
        assert score_tension({"tension_score": "3"}) == 3.0
        # 字段不存在
        assert score_tension({"title": "T", "based_on": "x"}) == 3
        # 非数字字符串
        assert score_tension({"tension_score": "abc"}) == 3


# ============ 排序权重 ============

class TestSortByScore:
    """sort_by_score: A1 张力 × 0.6 主导排序"""

    def test_sort_score_dominates_by_a1(self):
        """高 A1 + 低 A3 排在低 A1 + 高 A3 前面"""
        from title_scoring import sort_by_score

        candidates = [
            {"title": "通用建议", "tension_score": 2, "consistency_score": 0.9},
            {"title": "反方挑战", "tension_score": 5, "consistency_score": 0.3},
        ]
        sorted_list = sort_by_score(candidates)
        # tension=5 × 0.6 = 3.0 + 0.9×5×0.4=1.8 → 4.8
        # tension=2 × 0.6 = 1.2 + 0.3×5×0.4=0.6 → 1.8
        assert sorted_list[0]["title"] == "反方挑战"

    def test_sort_preserves_missing_scores(self):
        """缺失分数的候选不崩溃，用默认值排序"""
        from title_scoring import sort_by_score

        candidates = [
            {"title": "A"},
            {"title": "B", "tension_score": 4},
        ]
        sorted_list = sort_by_score(candidates)
        assert len(sorted_list) == 2
        assert sorted_list[0]["title"] == "B"

    def test_sort_by_score_empty_list(self):
        """空列表不崩溃"""
        from title_scoring import sort_by_score
        assert sort_by_score([]) == []

"""thinking_models/framework_selector.py 测试

v1: 关键词匹配（不依赖 LLM）
- 问题解构：为什么 / 怎么回事 / 原因 / 根因
- 决策分析：选 / 决定 / 还是 / 哪个 / 要不要
- 系统思考：系统 / 长期 / 全局 / 影响 / 后果
- 创新突破：新 / 不同 / 差异化 / 创新 / 突破
- 无匹配 → 默认问题解构
"""
from __future__ import annotations

import pytest

from lu.thinking_models.framework_selector import select_framework
from lu.thinking_models.registry import FrameworkRegistry


@pytest.fixture
def registry() -> FrameworkRegistry:
    return FrameworkRegistry.from_yaml("config/thinking_models/frameworks.yaml")


class TestKeywordMatching:
    def test_problem_decomposition(self, registry: FrameworkRegistry):
        fw = select_framework("为什么这个产品不增长", registry)
        assert fw.id == "problem_decomposition"

    def test_decision_analysis(self, registry: FrameworkRegistry):
        fw = select_framework("我应该选 A 还是 B", registry)
        assert fw.id == "decision_analysis"

    def test_systems_thinking(self, registry: FrameworkRegistry):
        fw = select_framework("长期看这件事会有什么影响", registry)
        assert fw.id == "systems_thinking"

    def test_innovation_breakthrough(self, registry: FrameworkRegistry):
        fw = select_framework("如何做差异化创新", registry)
        assert fw.id == "innovation_breakthrough"


class TestDefault:
    def test_no_match_falls_back_to_problem_decomposition(self, registry: FrameworkRegistry):
        fw = select_framework("写一篇文章", registry)
        assert fw.id == "problem_decomposition"

    def test_empty_falls_back(self, registry: FrameworkRegistry):
        fw = select_framework("", registry)
        assert fw.id == "problem_decomposition"


class TestPriority:
    def test_first_match_wins(self, registry: FrameworkRegistry):
        fw = select_framework("为什么选 A 还是 B", registry)
        assert fw.id == "problem_decomposition"

    def test_specific_keyword_beats_general(self, registry: FrameworkRegistry):
        fw = select_framework("这件事的系统影响", registry)
        assert fw.id == "systems_thinking"

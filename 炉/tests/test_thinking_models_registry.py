"""thinking_models/registry.py 测试

加载 12 模型 + 4 框架
"""
from __future__ import annotations

from pathlib import Path

import pytest

from lu.thinking_models.registry import (
    Framework,
    FrameworkRegistry,
    ThinkingModel,
    ThinkingModelRegistry,
    load_default_registries,
)


@pytest.fixture
def model_registry() -> ThinkingModelRegistry:
    return ThinkingModelRegistry.from_yaml("config/thinking_models/models.yaml")


@pytest.fixture
def framework_registry() -> FrameworkRegistry:
    return FrameworkRegistry.from_yaml("config/thinking_models/frameworks.yaml")


class TestThinkingModelRegistry:
    def test_load_12_models(self, model_registry: ThinkingModelRegistry):
        assert len(model_registry) == 12

    def test_all_models_have_required_fields(self, model_registry: ThinkingModelRegistry):
        for m in model_registry.list_all():
            assert m.id
            assert m.name
            assert m.definition
            assert m.use_when
            assert m.prompt_hint

    def test_get_by_id(self, model_registry: ThinkingModelRegistry):
        m = model_registry.get("first_principles")
        assert m.name == "第一性原理"

    def test_get_missing_raises(self, model_registry: ThinkingModelRegistry):
        with pytest.raises(KeyError, match="not_a_real_model"):
            model_registry.get("not_a_real_model")

    def test_iteration(self, model_registry: ThinkingModelRegistry):
        ids = [m.id for m in model_registry]
        assert "leverage_point" in ids
        assert "first_principles" in ids
        assert "second_order" in ids

    def test_required_ids_present(self, model_registry: ThinkingModelRegistry):
        required = {
            "leverage_point", "first_principles", "inverse", "systems_thinking",
            "jtbd", "occam_razor", "contrarian", "causal_chain",
            "five_why", "analogy", "feedback_loop", "second_order",
        }
        actual = {m.id for m in model_registry.list_all()}
        assert required == actual


class TestFrameworkRegistry:
    def test_load_4_frameworks(self, framework_registry: FrameworkRegistry):
        assert len(framework_registry) == 4

    def test_framework_ids(self, framework_registry: FrameworkRegistry):
        ids = {f.id for f in framework_registry}
        assert ids == {
            "problem_decomposition",
            "decision_analysis",
            "systems_thinking",
            "innovation_breakthrough",
        }

    def test_framework_strategies(self, framework_registry: FrameworkRegistry):
        strategies = {f.id: f.strategy for f in framework_registry}
        assert strategies["problem_decomposition"] == "chain"
        assert strategies["decision_analysis"] == "parallel"
        assert strategies["systems_thinking"] == "nested"
        assert strategies["innovation_breakthrough"] == "divergent_then_convergent"

    def test_framework_model_ids_resolve(self, framework_registry: FrameworkRegistry):
        for fw in framework_registry:
            assert len(fw.model_ids) >= 2
            for mid in fw.model_ids:
                assert isinstance(mid, str)
                assert mid  # non-empty

    def test_get_by_id(self, framework_registry: FrameworkRegistry):
        fw = framework_registry.get("decision_analysis")
        assert fw.name == "决策分析"
        assert "leverage_point" in fw.model_ids


class TestLoadDefaultRegistries:
    def test_load_both(self):
        model_reg, fw_reg = load_default_registries()
        assert len(model_reg) == 12
        assert len(fw_reg) == 4

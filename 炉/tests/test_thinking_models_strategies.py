"""thinking_models/strategies.py 测试

5 种策略：
- chain: 链式 A→B→C，前者输出作为后者输入
- parallel: 并行 A‖B‖C，输出聚合
- nested: 嵌套 A(B(C))，每层都有完整上下文
- divergent_then_convergent: 前半发散→后半收敛
- condition: 条件分支，根据 ctx 选模型
"""
from __future__ import annotations

import pytest

from lu.thinking_models.strategies import (
    ModelOutput,
    StrategyContext,
    chain,
    parallel,
    nested,
    divergent_then_convergent,
    condition,
    get_strategy,
)


def _model(id: str, name: str = ""):
    from lu.config.loader import ThinkingModel
    return ThinkingModel(id=id, name=name or id, definition="x", use_when="x")


def _tracking_llm(responses: list[str]):
    """模拟 LLM：按调用顺序返回预设响应"""
    calls: list[str] = []
    iterator = iter(responses)

    def call(prompt: str) -> str:
        calls.append(prompt)
        try:
            return next(iterator)
        except StopIteration:
            return "[NO_MORE_RESPONSES]"

    return call, calls


class TestChainStrategy:
    def test_sequential_execution(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["out_A", "out_B", "out_C"])

        result = chain(models, "PROP", llm)

        assert len(result.outputs) == 3
        assert [o.model_id for o in result.outputs] == ["A", "B", "C"]
        assert [o.output for o in result.outputs] == ["out_A", "out_B", "out_C"]

    def test_each_step_receives_previous_output(self):
        models = [_model("A"), _model("B")]
        llm, calls = _tracking_llm(["A_response", "B_response"])

        chain(models, "PROP", llm)

        assert "A_response" in calls[1], "B 的 prompt 应包含 A 的输出"

    def test_empty_models_returns_empty(self):
        llm, _ = _tracking_llm([])
        result = chain([], "PROP", llm)
        assert result.outputs == []

    def test_single_model(self):
        models = [_model("only")]
        llm, _ = _tracking_llm(["only_out"])
        result = chain(models, "PROP", llm)
        assert len(result.outputs) == 1
        assert result.outputs[0].output == "only_out"


class TestParallelStrategy:
    def test_all_models_called(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["out_A", "out_B", "out_C"])

        result = parallel(models, "PROP", llm)

        assert len(result.outputs) == 3
        assert {o.model_id for o in result.outputs} == {"A", "B", "C"}

    def test_each_receives_original_proposition(self):
        models = [_model("A"), _model("B")]
        llm, calls = _tracking_llm(["x", "y"])

        parallel(models, "ORIGINAL_PROP", llm)

        for c in calls:
            assert "ORIGINAL_PROP" in c

    def test_empty_models(self):
        llm, _ = _tracking_llm([])
        result = parallel([], "P", llm)
        assert result.outputs == []


class TestNestedStrategy:
    def test_layers_accumulate_context(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["A_out", "B_out", "C_out"])

        result = nested(models, "PROP", llm)

        assert len(result.outputs) == 3
        assert calls[1].count("A_out") >= 1
        assert calls[2].count("A_out") >= 1
        assert calls[2].count("B_out") >= 1

    def test_all_models_called(self):
        models = [_model("A"), _model("B")]
        llm, _ = _tracking_llm(["a", "b"])
        result = nested(models, "P", llm)
        assert [o.model_id for o in result.outputs] == ["A", "B"]


class TestDivergentThenConvergent:
    def test_split_in_half(self):
        models = [_model("A"), _model("B"), _model("C"), _model("D")]
        llm, calls = _tracking_llm(["A", "B", "CD", "CD2"])

        result = divergent_then_convergent(models, "PROP", llm)

        assert len(calls) == 4
        assert len(result.outputs) == 4

    def test_convergent_sees_diverge_outputs(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["A_out", "B_out", "C_out"])

        divergent_then_convergent(models, "P", llm)

        assert "A_out" in calls[2]
        assert "B_out" in calls[2]

    def test_three_models_diverge_one_converge(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["A", "B", "C_converged"])

        result = divergent_then_convergent(models, "P", llm)

        assert len(result.outputs) == 3
        assert calls[2].count("A") >= 1
        assert calls[2].count("B") >= 1


class TestConditionStrategy:
    def test_choose_by_route(self):
        models = [_model("A"), _model("B"), _model("C")]
        llm, calls = _tracking_llm(["B_out"])

        ctx = StrategyContext(proposition="P", route="B")
        result = condition(models, ctx, llm)

        assert len(result.outputs) == 1
        assert result.outputs[0].model_id == "B"

    def test_default_route_falls_back_to_first(self):
        models = [_model("A"), _model("B")]
        llm, calls = _tracking_llm(["A_out"])

        ctx = StrategyContext(proposition="P", route="nonexistent")
        result = condition(models, ctx, llm)

        assert result.outputs[0].model_id == "A"

    def test_explicit_first(self):
        models = [_model("A"), _model("B")]
        llm, _ = _tracking_llm(["A_out"])

        ctx = StrategyContext(proposition="P", route="A")
        result = condition(models, ctx, llm)

        assert result.outputs[0].model_id == "A"


class TestGetStrategy:
    def test_chain(self):
        assert get_strategy("chain") is chain

    def test_parallel(self):
        assert get_strategy("parallel") is parallel

    def test_nested(self):
        assert get_strategy("nested") is nested

    def test_divergent_then_convergent(self):
        assert get_strategy("divergent_then_convergent") is divergent_then_convergent

    def test_condition(self):
        assert get_strategy("condition") is condition

    def test_unknown_raises(self):
        with pytest.raises(ValueError, match="未知策略"):
            get_strategy("nonexistent")


class TestModelOutputDataclass:
    def test_construction(self):
        o = ModelOutput(model_id="A", output="text")
        assert o.model_id == "A"
        assert o.output == "text"

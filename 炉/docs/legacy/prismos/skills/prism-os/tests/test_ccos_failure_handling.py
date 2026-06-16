"""CCOS 失败处理测试"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


def test_ccos_failure_sets_ccos_failed():
    """CCOS 失败时 state.ccos_failed 应为 True"""
    from phases.ccos import CCOSPhase
    from phases.base import PipelineState, PipelineConfig

    phase = CCOSPhase()
    state = PipelineState(
        thesis="测试命题",
        selected_candidate={"title": "测试标题", "dimension": "reversal"},
        platform="wechat",
    )
    config = PipelineConfig(interactive=False)

    # mock CCOS 生成失败 (platform=wechat 调用 cognitive_outline_workflow)
    with patch("cognitive_outline.cognitive_outline_workflow") as mock_ccos:
        mock_ccos.side_effect = Exception("LLM 调用失败")
        result = phase.execute(state, config)

    assert state.ccos_failed is True
    assert result.data.get("ccos_outline") is None


def test_narrate_skipped_when_ccos_failed():
    """CCOS 失败时 narrate 应跳过"""
    from phases.narrate import NarratePhase
    from phases.base import PipelineState, PipelineConfig

    phase = NarratePhase()
    state = PipelineState(
        thesis="测试命题",
        ccos_failed=True,
        ccos_outline=None,
    )
    config = PipelineConfig(include_narrate=True)

    assert phase.should_run(state, config) is False


def test_narrate_runs_when_ccos_succeeds():
    """CCOS 成功时 narrate 应执行"""
    from phases.narrate import NarratePhase
    from phases.base import PipelineState, PipelineConfig

    phase = NarratePhase()
    state = PipelineState(
        thesis="测试命题",
        ccos_failed=False,
        ccos_outline={"主结构": "测试"},
    )
    config = PipelineConfig(include_narrate=True)

    assert phase.should_run(state, config) is True


def test_partial_success_when_ccos_failed():
    """CCOS 失败时最终 status 应为 partial_success"""
    from phases import FullPrismPipeline, PipelineConfig, PipelineState

    config = PipelineConfig(
        interactive=False,
        skip_gateway=True,
        include_phase_4_8=True,
        include_narrate=True,
    )
    pipeline = FullPrismPipeline(config)

    # mock 所有 LLM 调用（避免真实 API）
    # prism_engine 返回 1 个候选，CCOS 单独 mock 为失败
    mock_prism_result = {
        "status": "success",
        "candidates": [{"title": "测试标题", "dimension": "reversal", "orthogonal": True, "max_similarity": 0.1}],
        "orthogonal_count": 1,
        "total_count": 1,
        "warnings": [],
    }
    with patch("call_llm.call_llm_raw", return_value=None), \
         patch("call_llm.call_llm", return_value={"content": "", "error": "mock"}), \
         patch("prism_engine.prism_engine", return_value=mock_prism_result), \
         patch("cognitive_outline.generate_dual_platform_outline") as mock_ccos:
        mock_ccos.side_effect = Exception("LLM 调用失败")
        state = pipeline.run("我想写一篇关于AI的文章")

    assert state.status == "partial_success"
    assert state.ccos_failed is True

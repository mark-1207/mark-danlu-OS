"""
方向选择标准化流程 TDD 测试

5 个测试:
- 网关 pass 时含 directions
- DirectionSelectPhase 展示方向
- 用户选 1/2/3 正确解析
- skip / default 继续
- prism 收到方向注入
"""
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


# ============ 网关 pass 方向生成 ============

class TestGatewayPassDirections:
    """socratic_gateway pass 分支也生成 directions"""

    def test_gateway_pass_includes_directions(self):
        """pass 时 gateway_result 含 directions 字段"""
        from socratic_gateway import socratic_gateway

        fake_directions = ["方向1: 失业焦虑", "方向2: 新机会", "方向3: 方法论"]

        with patch("socratic_gateway.calculate_entropy",
                   return_value={"entropy_score": 0.6, "decision": "pass",
                                 "reason": "清晰"}), \
             patch("socratic_gateway.calculate_hkr",
                   return_value={"hkr_avg": 0.7, "h": 0, "k": 0, "r": 0}), \
             patch("socratic_gateway.generate_directions",
                   return_value=fake_directions):
            result = socratic_gateway("AI 时代如何转型")

        assert result["status"] == "ready_for_generation"
        assert "directions" in result
        assert len(result["directions"]) == 3


# ============ DirectionSelectPhase ============

class TestDirectionSelectPhase:
    """DirectionSelectPhase: 展示 + 解析 + 注入"""

    def test_direction_select_shows_options(self):
        """need_input 时 prompt 含所有方向"""
        from phases.direction_select import DirectionSelectPhase
        from phases.base import PhaseResult, PipelineState, PipelineConfig

        state = MagicMock()
        state.gateway = {
            "status": "ready_for_generation",
            "directions": ["方向1: 失业焦虑", "方向2: 新机会", "方向3: 方法论"],
        }
        state.user_reply = ""
        config = MagicMock()
        config.interactive = True

        phase = DirectionSelectPhase()
        result = phase.execute(state, config)

        assert result.status == "need_input"
        assert "方向1: 失业焦虑" in result.prompt
        assert "方向2: 新机会" in result.prompt
        assert "方向3: 方法论" in result.prompt

    def test_direction_select_parses_choice(self):
        """用户选 1/2/3 → state.direction_selected 正确"""
        from phases.direction_select import DirectionSelectPhase
        from phases.base import PipelineState, PipelineConfig

        state = MagicMock()
        state.gateway = {
            "status": "ready_for_generation",
            "directions": ["方向A", "方向B", "方向C"],
        }
        config = MagicMock()
        config.interactive = True

        # 选 2
        state.user_reply = "2"
        phase = DirectionSelectPhase()
        result = phase.execute(state, config)
        assert result.status == "success"
        assert state.direction_selected == "方向B"

        # 选 1
        state.user_reply = "1"
        result = phase.execute(state, config)
        assert result.status == "success"
        assert state.direction_selected == "方向A"

    def test_direction_select_skip(self):
        """skip/quit → 不设置 direction_selected，继续"""
        from phases.direction_select import DirectionSelectPhase

        state = MagicMock()
        state.gateway = {
            "status": "ready_for_generation",
            "directions": ["方向A", "方向B"],
        }
        state.direction_selected = ""
        config = MagicMock()
        config.interactive = True

        phase = DirectionSelectPhase()

        # skip
        state.user_reply = "skip"
        result = phase.execute(state, config)
        assert result.status == "success"
        assert state.direction_selected == ""

        # quit
        state.user_reply = "q"
        result = phase.execute(state, config)
        assert result.status == "success"
        assert state.direction_selected == ""

        # 无效数字
        state.user_reply = "99"
        result = phase.execute(state, config)
        assert result.status == "success"
        assert state.direction_selected == ""


# ============ PrismPhase 注入 ============

class TestPrismDirectionInjection:
    """PrismPhase 收到 state.direction_selected 后注入 thesis"""

    def test_prism_uses_selected_direction(self):
        """prism_engine 收到带方向的 thesis"""
        from phases.prism import PrismPhase
        from phases.base import PipelineState, PipelineConfig

        state = MagicMock()
        state.thesis = "AI 时代如何转型"
        state.direction_selected = "AI 时代新职业机会"
        state.identity_role = ""
        state.audience = ""
        state.deep_titles = []
        state.user_reply = ""
        state.history_topics = []
        config = MagicMock()
        config.interactive = True
        config.persona_name = "default"

        captured = {}
        def fake_prism_engine(thesis, **kwargs):
            captured["thesis"] = thesis
            captured["kwargs"] = kwargs
            return {"candidates": []}

        with patch("prism_engine.prism_engine", side_effect=fake_prism_engine), \
             patch("socratic_gateway.calculate_hkr", return_value={"h": 0, "k": 0, "r": 0, "hkr_avg": 0}):
            phase = PrismPhase()
            phase.execute(state, config)

        assert "AI 时代如何转型" in captured["thesis"]
        assert "AI 时代新职业机会" in captured["thesis"]

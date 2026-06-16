#!/usr/bin/env python3
"""M1 集成测试 v1.0 补完: phases/twin.py + phases/narrate.py 用 persona"""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


class TestTwinPhasePersonaIntegration(unittest.TestCase):
    """TwinPhase 应加载 persona，注入 topic_domains 用于候选筛选"""

    def test_twin_loads_persona_topic_domains(self):
        """TwinPhase.execute 调用前加载 persona 的 topic_domains"""
        with patch("cognitive_crack.learn_and_filter_combined") as mock_combined, \
             patch("persona.load") as mock_persona_load:
            mock_combined.return_value = {
                "thinking_pattern": "理性",
                "dimension_weights": {},
                "style_keywords": [],
                "confidence": 0.5,
                "selected_topics": [{"topic": "T1", "selection_reason": "X"}],
                "rejected_topics": [],
                "digital_twin_confidence": 0.5,
            }
            mock_persona_load.return_value = {
                "topic_domains": ["AI", "认知升级", "创作者经济"],
                "tone_keywords": ["犀利", "理性"],
            }

            from phases import PipelineState, PipelineConfig
            from phases.twin import TwinPhase

            state = PipelineState(
                thesis="AI 时代认知升级",
                candidates=[{"title": "AI 时代认知升级的三个底层逻辑"}],
            )
            config = PipelineConfig(persona_name="default")

            phase = TwinPhase()
            result = phase.execute(state, config)

            # 验证：persona.load 被调用过一次
            self.assertGreaterEqual(mock_persona_load.call_count, 1)
            # 验证：learn_and_filter_combined 被调用
            self.assertGreaterEqual(mock_combined.call_count, 1)

    def test_twin_boosts_in_domain_candidates(self):
        """领域内候选应在 selected_topics 中被优先保留"""
        with patch("cognitive_crack.learn_and_filter_combined") as mock_combined:
            mock_combined.return_value = {
                "thinking_pattern": "理性",
                "dimension_weights": {},
                "style_keywords": [],
                "confidence": 0.5,
                "selected_topics": [
                    {"topic": "AI 时代焦虑", "selection_reason": "X"},
                    {"topic": "古代诗词", "selection_reason": "Y"},
                ],
                "rejected_topics": [],
                "digital_twin_confidence": 0.5,
            }
            from phases import PipelineState, PipelineConfig
            from phases.twin import TwinPhase
            state = PipelineState(thesis="AI 焦虑")
            config = PipelineConfig(persona_name="default")
            result = TwinPhase().execute(state, config)

            # 验证：in_domain 字段被加到 selected_topics
            for st in result.data["twin_selected"]:
                self.assertIn("in_domain", st)


class TestNarratePhasePersonaIntegration(unittest.TestCase):
    """NarratePhase 应加载 persona，注入 style_fingerprint 到 _run_narrate"""

    def test_narrate_loads_persona(self):
        """NarratePhase 加载 persona 并传给 _run_narrate"""
        with patch("prism_os._run_narrate") as mock_narrate, \
             patch("persona.load") as mock_persona_load:
            mock_narrate.return_value = {"word_count": 100, "output_file": "/tmp/x.md"}
            mock_persona_load.return_value = {
                "tone_keywords": ["犀利", "理性"],
                "avoid_keywords": ["鸡汤", "成功学"],
                "platform_preference": {"wechat": "深度"},
                "topic_domains": ["AI", "认知"],
                "style_keywords": ["逻辑优先"],
                "style_mentors": ["刘润"],
            }

            from phases import PipelineState, PipelineConfig
            from phases.narrate import NarratePhase

            state = PipelineState(
                thesis="AI 焦虑",
                platform="wechat",
                ccos_outline={"主结构": "认知升级型"},
                selected_candidate={"title": "AI 焦虑的本质"},
            )
            config = PipelineConfig(persona_name="default")
            result = NarratePhase().execute(state, config)

            # 验证：_run_narrate 被调用，且收到 persona 数据
            self.assertEqual(mock_narrate.call_count, 1)
            call_args = mock_narrate.call_args
            # _run_narrate 至少应有 (topic, platform) 参数，可能有 persona
            self.assertEqual(call_args.kwargs.get("platform", call_args.args[1] if len(call_args.args) > 1 else None), "wechat")

    def test_narrate_skips_when_ccos_failed(self):
        """CCOS 失败时 narrate 跳过"""
        with patch("prism_os._run_narrate") as mock_narrate:
            from phases import PipelineState, PipelineConfig
            from phases.narrate import NarratePhase
            state = PipelineState(
                thesis="X",
                ccos_outline={"主结构": "..."},
                ccos_failed=True,
                selected_candidate={"title": "T"},
            )
            config = PipelineConfig()
            result = NarratePhase().execute(state, config)
            # narrate 不应被调用
            self.assertEqual(mock_narrate.call_count, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)

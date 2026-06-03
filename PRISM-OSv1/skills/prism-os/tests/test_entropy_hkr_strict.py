#!/usr/bin/env python3
"""
熵值/HKR 规则过严 Bug 测试 — Commit 7 RED

bug: 合理命题（含 clarifications）打分过低，无法 pass
fix: 扩展关键词集合，让合理的命题能 pass

用法: python -m pytest skills/prism-os/tests/test_entropy_hkr_strict.py -v
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))


class TestEntropyPermissiveRules(unittest.TestCase):
    """合理命题应能 pass 熵值，不应被过严规则卡住"""

    def test_clear_topic_passes_entropy(self):
        """明确话题的命题应能 pass"""
        from socratic_gateway import calculate_entropy
        result = calculate_entropy(
            "35岁程序员面临的裁员危机"
        )
        # 之前的实现：object_clarity=0.6, conflict=0.7(因为"危机"), fact=0.2 → entropy=0.56
        # 应该是 ≥ 0.7 才能 pass（之前）
        # 我们期望 pass
        self.assertEqual(result["decision"], "pass",
                         f"明确话题应 pass，实际: {result['decision']}, score={result['entropy_score']}")

    def test_topic_with_clarification_passes(self):
        """含 clarifications 的命题应能 pass"""
        from socratic_gateway import calculate_entropy
        full = """35岁程序员面临的裁员危机
补充说明：裁员危机是核心问题；受众是职场大龄人士；期望行动是提升自我、转变思路、适应变化、不要固步自封"""
        result = calculate_entropy(full)
        self.assertEqual(result["decision"], "pass",
                         f"含 clarifications 的命题应 pass，实际: {result['decision']}, score={result['entropy_score']}")

    def test_topic_with_action_keywords_passes(self):
        """含具体行动建议的命题应能 pass"""
        from socratic_gateway import calculate_entropy
        result = calculate_entropy(
            "如何应对35岁程序员被裁危机：行动建议是学AI、转型管理岗、做独立开发者"
        )
        self.assertEqual(result["decision"], "pass",
                         f"含行动建议的命题应 pass，实际: {result['decision']}, score={result['entropy_score']}")


class TestHKRPermissiveRules(unittest.TestCase):
    """合理命题应能 pass HKR"""

    def test_topic_with_target_audience_passes(self):
        """含目标读者的命题应能 pass HKR"""
        from socratic_gateway import calculate_hkr
        result = calculate_hkr(
            "针对35岁程序员的裁员危机，职场大龄人士如何应对"
        )
        # R 维度应识别"35岁程序员"和"大龄人士"
        self.assertGreaterEqual(result["r"], 0.3,
                              f"目标读者关键词应贡献 R，实际: {result['r']}")

    def test_topic_with_clarification_passes(self):
        """含 clarifications 的命题应能 pass HKR"""
        from socratic_gateway import calculate_hkr
        full = """35岁程序员面临的裁员危机
补充说明：裁员危机是核心问题；受众是职场大龄人士；期望行动是提升自我、转变思路、适应变化、不要固步自封"""
        result = calculate_hkr(full)
        # 含"裁员"、"危机"、"焦虑"应贡献 R
        self.assertGreaterEqual(result["r"], 0.3,
                              f"含焦虑/危机关键词应贡献 R，实际: {result['r']}")

    def test_topic_with_action_passes(self):
        """含具体行动的命题应能 pass HKR"""
        from socratic_gateway import calculate_hkr
        result = calculate_hkr(
            "应对裁员危机：学AI提升技能、转型产品经理、做自由职业"
        )
        # K 维度应识别"学"、"提升技能"
        self.assertGreaterEqual(result["hkr_avg"], 0.3,
                              f"含行动的命题应过 HKR 门槛，实际: {result['hkr_avg']}")


class TestGatewayPassesReasonableTopic(unittest.TestCase):
    """端到端：合理命题应能 pass gateway"""

    def test_35yo_programmer_with_clarification_passes(self):
        from socratic_gateway import socratic_gateway
        full = """35岁程序员面临的裁员危机
补充说明：裁员危机是核心问题；受众是职场大龄人士；期望行动是提升自我、转变思路、适应变化、不要固步自封"""
        result = socratic_gateway(full)
        self.assertEqual(result["status"], "ready_for_generation",
                         f"合理命题应 pass gateway，实际: {result['status']}")


class TestEvaluateTopic(unittest.TestCase):
    """Phase 1 选题评估：entropy + 主题基线分（替代 calculate_hkr 在 Phase 1 的角色）"""

    def test_严肃问句不再卡死(self):
        """验证：纯问句+严肃话题，evaluate_topic 应 pass（不再 need_clarification）"""
        from socratic_gateway import evaluate_topic
        result = evaluate_topic("为什么对于很多职场人来说，越努力反而离目标越远呢")
        self.assertTrue(result["pass"],
                        f"严肃问句+职场主题应 pass，实际: {result}")
        self.assertGreaterEqual(result["topic_bonus"], 0.2,
                                f"'职场'主题应贡献 ≥ 0.2 加分，实际: {result['topic_bonus']}")

    def test_纯口水话应被拒(self):
        """验证：无主题的纯口水话应被拒"""
        from socratic_gateway import evaluate_topic
        result = evaluate_topic("今天天气真好")
        self.assertFalse(result["pass"],
                         f"无主题纯口水话应被拒，实际: {result}")

    def test_成长类主题应加分(self):
        """'成长'主题命中基线分"""
        from socratic_gateway import evaluate_topic
        result = evaluate_topic("个人成长路径应该如何选择")
        self.assertGreaterEqual(result["topic_bonus"], 0.1,
                                f"'成长'主题应加分，实际: {result['topic_bonus']}")


class TestEvaluateTitle(unittest.TestCase):
    """Phase 2 标题评估：HKR 标题版（独立关键词库）"""

    def test_标题反转结构加分(self):
        """'反而'应触发 H 加分"""
        from socratic_gateway import evaluate_title
        result = evaluate_title("越努力反而离目标越远")
        self.assertGreater(result["h"], 0,
                           f"'反而'应触发 H 加分，实际: {result['h']}")

    def test_标题问句加分(self):
        """'为什么...？'应触发 K 加分"""
        from socratic_gateway import evaluate_title
        result = evaluate_title("为什么你越努力越穷？")
        self.assertGreater(result["k"], 0.1,
                           f"问句应触发 K 加分，实际: {result['k']}")

    def test_口语夸张标题保持高分(self):
        """回归：原 H 词不失效"""
        from socratic_gateway import evaluate_title
        result = evaluate_title("这个 AI 工具太离谱了，笑死")
        self.assertGreaterEqual(result["h"], 0.4,
                                f"口语夸张词应保持 H 高分，实际: {result['h']}")

    def test_转折结构加分(self):
        """'但/却'应触发 K 加分"""
        from socratic_gateway import evaluate_title
        result = evaluate_title("你很努力，但你没有方向")
        self.assertGreater(result["k"], 0,
                           f"转折词应触发 K 加分，实际: {result['k']}")


if __name__ == "__main__":
    unittest.main(verbosity=2)

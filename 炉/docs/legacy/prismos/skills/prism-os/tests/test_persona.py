#!/usr/bin/env python3
"""persona.py 单元测试 - M1: 人设持久化"""
import sys
import os
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from persona import (
    load,
    list_names,
    validate,
    format_for_prism,
    format_for_ccos,
    format_for_twin,
    format_for_narrate,
    get_topic_domains,
    is_in_domain,
    PersonaNotFoundError,
    PersonaValidationError,
)


class TestLoadPersona(unittest.TestCase):
    def test_load_default_returns_full_persona(self):
        """加载 default persona 返回完整 11 个顶层字段"""
        p = load("default")
        self.assertIn("identity_role", p)
        self.assertIn("audience", p)
        self.assertIn("tone_keywords", p)
        self.assertIn("style_mentors", p)
        self.assertIn("style_keywords", p)
        self.assertIn("avoid_keywords", p)
        self.assertIn("core_framework", p)
        self.assertIn("value_increments", p)
        self.assertIn("topic_domains", p)
        self.assertIn("knowledge_principles", p)
        self.assertIn("end_goal", p)
        self.assertIn("platform_preference", p)
        # 至少 11 个顶层字段
        self.assertGreaterEqual(len(p), 11)

    def test_load_default_identity_role_contains_keywords(self):
        """default 的 identity_role 含关键身份词"""
        p = load("default")
        role = p.get("identity_role", "")
        # 至少包含以下身份之一
        keywords = ["思想", "认知", "AI"]
        self.assertTrue(any(kw in role for kw in keywords),
                        f"identity_role 应含身份关键词: {role}")

    def test_load_missing_persona_raises(self):
        """不存在的人设名抛 PersonaNotFoundError"""
        with self.assertRaises(PersonaNotFoundError):
            load("totally_nonexistent_persona_xyz")

    def test_validate_detects_missing_required(self):
        """缺 identity_role 或 audience 时返回非空列表"""
        p_empty = {}
        missing = validate(p_empty)
        self.assertIn("identity_role", missing)
        self.assertIn("audience", missing)

    def test_validate_passes_full_persona(self):
        """完整 persona 验证通过"""
        p = load("default")
        missing = validate(p)
        self.assertEqual(missing, [], f"缺字段: {missing}")

    def test_list_names_includes_default(self):
        """list_names 返回 default"""
        names = list_names()
        self.assertIn("default", names)


class TestFormatForPrism(unittest.TestCase):
    def test_extracts_5_fields(self):
        """提取 5 个字段"""
        p = load("default")
        fmt = format_for_prism(p)
        for key in ("identity_role", "audience", "tone_keywords", "style_keywords", "avoid_keywords"):
            self.assertIn(key, fmt)

    def test_tone_keywords_is_list(self):
        """tone_keywords 应该是列表"""
        p = load("default")
        fmt = format_for_prism(p)
        self.assertIsInstance(fmt["tone_keywords"], list)
        self.assertGreater(len(fmt["tone_keywords"]), 0)


class TestFormatForCCOS(unittest.TestCase):
    def test_maps_to_layer7_4_fields(self):
        """映射到 Layer 7 的 4 字段"""
        p = load("default")
        fmt = format_for_ccos(p)
        for key in ("认知倾向", "表达气质", "价值倾向", "长期母题"):
            self.assertIn(key, fmt)

    def test_表达气质_includes_mentors(self):
        """表达气质含 style_mentors"""
        p = load("default")
        fmt = format_for_ccos(p)
        # default 的 style_mentors 含 刘润/张一鸣/Naval/芒格
        self.assertIn("参考", fmt["表达气质"])
        # 至少含其中一个
        mentors = ["刘润", "张一鸣", "Naval", "芒格"]
        self.assertTrue(any(m in fmt["表达气质"] for m in mentors))

    def test_长期母题_is_non_empty(self):
        """长期母题非空"""
        p = load("default")
        fmt = format_for_ccos(p)
        self.assertTrue(len(fmt["长期母题"]) > 0)


class TestFormatForTwin(unittest.TestCase):
    def test_extracts_topic_domains(self):
        """提取 topic_domains"""
        p = load("default")
        fmt = format_for_twin(p)
        self.assertIn("topic_domains", fmt)
        self.assertIsInstance(fmt["topic_domains"], list)
        self.assertGreater(len(fmt["topic_domains"]), 0)
        # default 含"AI""认知"等领域
        domains_str = "".join(fmt["topic_domains"])
        self.assertTrue("AI" in domains_str or "认知" in domains_str)


class TestFormatForNarrate(unittest.TestCase):
    def test_wechat_gets_depth_preference(self):
        """wechat 平台用'深度'偏好"""
        p = load("default")
        fmt = format_for_narrate(p, "wechat")
        self.assertIn("深度", fmt["platform_preference"])

    def test_xiaohongshu_gets_emotion_preference(self):
        """xiaohongshu 平台用'情绪'偏好"""
        p = load("default")
        fmt = format_for_narrate(p, "xiaohongshu")
        self.assertIn("情绪", fmt["platform_preference"])

    def test_unknown_platform_returns_empty_preference(self):
        """未知平台返回空偏好（不报错）"""
        p = load("default")
        fmt = format_for_narrate(p, "unknown_platform")
        self.assertEqual(fmt["platform_preference"], "")


class TestTopicDomainHelpers(unittest.TestCase):
    def test_get_topic_domains_returns_list(self):
        """get_topic_domains 返回列表"""
        p = load("default")
        domains = get_topic_domains(p)
        self.assertIsInstance(domains, list)
        self.assertGreater(len(domains), 0)

    def test_is_in_domain_matches(self):
        """is_in_domain 粗略匹配（要求文本含 topic_domain 子串）"""
        p = load("default")
        # 包含"认知升级"领域
        self.assertTrue(is_in_domain("如何实现认知升级", p))
        # 包含"创作者经济"领域
        self.assertTrue(is_in_domain("创作者经济的未来", p))
        # 不在领域
        self.assertFalse(is_in_domain("古代诗词鉴赏", p))

    def test_is_in_domain_empty_returns_true(self):
        """无人设领域限制时，所有文本都算"在领域内"（避免过滤）"""
        p_empty = {}
        self.assertTrue(is_in_domain("任意文本", p_empty))


class TestPersonaIntegration(unittest.TestCase):
    """M1 集成测试：验证 persona 字段真的注入到 CCOS"""

    def test_ccos_uses_persona_in_authorial_identity(self):
        """CCOS Layer 7 的 authorial_identity 来自 persona 的 style_mentors"""
        import cognitive_outline
        # 设置 persona name
        cognitive_outline._PERSONA_NAME = "default"

        # 调用 _load_authorial_identity，验证返回值含 persona 字段
        authorial = cognitive_outline._load_authorial_identity()
        # persona 的 style_mentors 是 刘润/张一鸣/Naval/芒格
        # format_for_ccos 把它映射到 表达气质 字段
        self.assertIn("参考", authorial.get("表达气质", ""))
        self.assertTrue(
            any(m in authorial.get("表达气质", "") for m in ["刘润", "张一鸣", "Naval", "芒格"]),
            f"表达气质应含 style_mentors: {authorial.get('表达气质')}"
        )
        # 长期母题应含 style_keywords 或 topic_domains
        self.assertTrue(len(authorial.get("长期母题", "")) > 0)
        # audience 来自 persona
        self.assertIn("职场人", authorial.get("audience", ""))

    def test_fallback_when_persona_fails(self):
        """persona 加载失败时回退到旧逻辑（不崩）"""
        import cognitive_outline
        # 设置为不存在的 persona
        cognitive_outline._PERSONA_NAME = "nonexistent_for_test_xyz"

        # 应该有 fallback：使用硬编码或 LLM 提取
        authorial = cognitive_outline._load_authorial_identity()
        # 至少有这 4 个字段
        for key in ("认知倾向", "表达气质", "价值倾向", "长期母题"):
            self.assertIn(key, authorial)


if __name__ == "__main__":
    unittest.main(verbosity=2)

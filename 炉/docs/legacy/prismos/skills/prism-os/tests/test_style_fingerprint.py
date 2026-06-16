"""
M9 C1 风格指纹 TDD 测试 (v1.1)

7 个测试覆盖 plan 行 2427-2436:
- StyleFingerprint 从 persona 构建
- style_prompt_text 完整
- check_style_match 匹配 ≥ 2 字符关键词
- 单字符不误中
- avoid_keywords 命中报错
- narrate 注入
- quality_check L5 集成
"""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


MOCK_PERSONA = {
    "tone_keywords": ["犀利", "理性", "深刻", "克制"],
    "style_keywords": ["口语化", "有具体场景", "有真实细节"],
    "style_mentors": ["半佛仙人", "李笑来"],
    "avoid_keywords": ["赋能", "降维打击", "破圈", "震惊"],
}


# ============ StyleFingerprint 构建 ============

class TestStyleFingerprint:
    """StyleFingerprint 从 persona dict 构建"""

    def test_fingerprint_from_persona(self):
        """4 字段从 persona 正确提取"""
        from style_fingerprint import StyleFingerprint

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        assert fp.style_mentors == ["半佛仙人", "李笑来"]
        assert fp.tone_keywords == ["犀利", "理性", "深刻", "克制"]
        assert fp.style_keywords == ["口语化", "有具体场景", "有真实细节"]
        assert fp.avoid_keywords == ["赋能", "降维打击", "破圈", "震惊"]

    def test_fingerprint_prompt_text(self):
        """style_prompt_text 非空且包含关键信息"""
        from style_fingerprint import StyleFingerprint

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        assert fp.style_prompt_text
        assert "半佛仙人" in fp.style_prompt_text
        assert "犀利" in fp.style_prompt_text
        assert "赋能" in fp.style_prompt_text


# ============ 风格检查 ============

class TestStyleCheck:
    """check_style_match: 规则化风格检查（L5）"""

    def test_style_check_matched(self):
        """命中 ≥ 2 字符关键词"""
        from style_fingerprint import StyleFingerprint, check_style_match

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        text = "这篇文章用口语化的表达，有具体场景支撑，犀利地分析了问题"
        result = check_style_match(text, fp)
        assert len(result.matched) >= 2
        assert "口语化" in result.matched
        assert "犀利" in result.matched

    def test_style_check_ignores_single_char(self):
        """单字符关键词不参与匹配（避免"理性"误中）"""
        from style_fingerprint import StyleFingerprint, check_style_match

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        # "理性" 是 2 字符，应该参与匹配
        # 但如果有 1 字符关键词，不应参与
        single_char_persona = {
            "tone_keywords": ["理"],  # 1 字符
            "style_keywords": ["好"],  # 1 字符
            "style_mentors": [],
            "avoid_keywords": [],
        }
        fp2 = StyleFingerprint.from_persona(single_char_persona)
        result = check_style_match("这是一个理性的分析", fp2)
        # 单字符关键词不应被匹配
        assert len(result.matched) == 0

    def test_style_check_anti_issues(self):
        """命中 avoid_keywords → anti_issues 非空"""
        from style_fingerprint import StyleFingerprint, check_style_match

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        text = "这个方法论可以赋能你的团队，实现降维打击"
        result = check_style_match(text, fp)
        assert "赋能" in result.anti_issues
        assert "降维打击" in result.anti_issues

    def test_style_check_score_range(self):
        """score 在合理范围内（0-1 之间）"""
        from style_fingerprint import StyleFingerprint, check_style_match

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        # 全命中
        text = "口语化 有具体场景 有真实细节 犀利 理性 深刻 克制"
        result = check_style_match(text, fp)
        assert 0.0 <= result.score <= 1.0

        # 全未命中
        text2 = "无关的文本"
        result2 = check_style_match(text2, fp)
        assert 0.0 <= result2.score <= 1.0


# ============ Narrate 注入 ============

class TestNarrateInjection:
    """inject_style_guidance: 风格指纹注入 narrate prompt"""

    def test_narrate_injects_fingerprint(self):
        """注入后 prompt 包含风格指纹信息"""
        from style_fingerprint import inject_style_guidance

        original_prompt = "请根据大纲生成文章"
        result = inject_style_guidance(original_prompt, MOCK_PERSONA)
        assert "半佛仙人" in result
        assert "犀利" in result
        assert "赋能" in result  # avoid_keywords 也应出现
        assert original_prompt in result


# ============ Quality Check L5 集成 ============

class TestQualityCheckL5:
    """quality_check 升级: 加入 L5 风格检查"""

    def test_quality_check_includes_l5(self):
        """quality_check 结果包含 style_check 字段"""
        from style_fingerprint import check_l5_style, StyleFingerprint

        fp = StyleFingerprint.from_persona(MOCK_PERSONA)
        text = "口语化表达，有具体场景，犀利分析"
        result = check_l5_style(text, fp)
        assert "matched" in result
        assert "missed" in result
        assert "anti_issues" in result
        assert "score" in result

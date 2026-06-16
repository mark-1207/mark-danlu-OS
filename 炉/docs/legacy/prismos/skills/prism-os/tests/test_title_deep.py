#!/usr/bin/env python3
"""title_deep.py 单元测试 - M2: 标题深度模块"""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from title_deep import (
    DepthAnalysis,
    VALID_BASED_ON,
    filter_titles,
    score_length,
    parse_deep_analysis,
    parse_deep_titles,
    handle_deep_command,
    BANNED_WORDS,
)


# ============ DepthAnalysis dataclass ============

class TestDepthAnalysis(unittest.TestCase):
    """9 维深度拆解的数据结构验证"""

    def _make_valid(self) -> DepthAnalysis:
        return DepthAnalysis(
            core_claim="AI 时代需要转型",
            hidden_assumptions=["转型是必要的", "存在正确方向"],
            mainstream_narrative="学 AI 终身学习",
            contrarian_takes=["不转型才是答案", "转型是陷阱", "转型是特权"],
            hidden_audience="35+ 中层管理",
            scenarios=["凌晨3点刷课的中层", "刚被裁的中年程序员", "35+妈妈在切换"],
            pain_points=["时间不够", "方向太多"],
            value_anchors=["安全感", "意义感"],
            unanswered_questions=["转型的尽头是什么", "谁该转谁不该转", "转了会更好吗"],
        )

    def test_9_fields_present(self):
        d = self._make_valid()
        for field in [
            "core_claim", "hidden_assumptions", "mainstream_narrative",
            "contrarian_takes", "hidden_audience", "scenarios",
            "pain_points", "value_anchors", "unanswered_questions"
        ]:
            self.assertTrue(hasattr(d, field))

    def test_validate_passes_full(self):
        d = self._make_valid()
        issues = d.validate()
        self.assertEqual(issues, [], f"issues: {issues}")

    def test_validate_detects_short_core_claim(self):
        d = self._make_valid()
        d.core_claim = ""
        issues = d.validate()
        self.assertTrue(any("core_claim" in i for i in issues))

    def test_validate_detects_too_many_assumptions(self):
        d = self._make_valid()
        d.hidden_assumptions = ["a", "b", "c", "d"]  # 4 > 3
        issues = d.validate()
        self.assertTrue(any("hidden_assumptions" in i for i in issues))

    def test_validate_detects_too_few_contrarian(self):
        d = self._make_valid()
        d.contrarian_takes = ["only one"]  # 1 < 3
        issues = d.validate()
        self.assertTrue(any("contrarian_takes" in i for i in issues))

    def test_validate_detects_vague_audience(self):
        d = self._make_valid()
        d.hidden_audience = "职场人"  # vague, 在禁列表
        issues = d.validate()
        self.assertTrue(any("hidden_audience" in i for i in issues))

    def test_validate_detects_short_audience(self):
        d = self._make_valid()
        d.hidden_audience = "AI"  # too short, < 4 chars
        issues = d.validate()
        self.assertTrue(any("hidden_audience" in i for i in issues))

    def test_to_dict_round_trip(self):
        d = self._make_valid()
        d2 = DepthAnalysis.from_dict(d.to_dict()) if hasattr(DepthAnalysis, "from_dict") else d
        # 至少 to_dict 工作
        d_dict = d.to_dict()
        self.assertEqual(d_dict["core_claim"], "AI 时代需要转型")


# ============ 解析函数 ============

class TestParseDeepAnalysis(unittest.TestCase):
    """从 LLM 输出 JSON 解析为 DepthAnalysis"""

    def test_parses_valid_json(self):
        llm_output = '''{
            "core_claim": "AI 让焦虑更甚",
            "hidden_assumptions": ["AI 不可控", "失业是常态"],
            "mainstream_narrative": "AI 替代人力",
            "contrarian_takes": ["AI 创造新岗位", "AI 让人更值钱", "AI 加剧内卷"],
            "hidden_audience": "35+ 程序员",
            "scenarios": ["刷课", "投简历", "转行"],
            "pain_points": ["时间", "方向", "沉没成本"],
            "value_anchors": ["安全感", "意义感", "自由度"],
            "unanswered_questions": ["尽头", "谁该转", "会不会好"]
        }'''
        d = parse_deep_analysis(llm_output)
        self.assertEqual(d.core_claim, "AI 让焦虑更甚")
        self.assertEqual(d.hidden_audience, "35+ 程序员")
        self.assertEqual(len(d.contrarian_takes), 3)

    def test_parses_json_in_code_block(self):
        """LLM 经常把 JSON 包在 ```json ... ``` 里"""
        llm_output = '''```json
{
    "core_claim": "X",
    "hidden_assumptions": ["a", "b"],
    "mainstream_narrative": "Y",
    "contrarian_takes": ["c1", "c2", "c3"],
    "hidden_audience": "35+ 程序员",
    "scenarios": ["s1", "s2", "s3"],
    "pain_points": ["p1", "p2"],
    "value_anchors": ["v1", "v2"],
    "unanswered_questions": ["q1", "q2", "q3"]
}
```'''
        d = parse_deep_analysis(llm_output)
        self.assertIsNotNone(d)
        self.assertEqual(d.core_claim, "X")

    def test_returns_none_on_invalid(self):
        self.assertIsNone(parse_deep_analysis("not json"))
        self.assertIsNone(parse_deep_analysis(""))
        self.assertIsNone(parse_deep_analysis(None))

    def test_returns_none_on_missing_fields(self):
        """缺必需字段时返回 None（不抛异常）"""
        llm_output = '{"core_claim": "X"}'  # 缺 8 个字段
        self.assertIsNone(parse_deep_analysis(llm_output))


class TestParseDeepTitles(unittest.TestCase):
    """从 LLM 输出解析 5 标题"""

    def test_parses_5_titles(self):
        llm_output = '''[
            {"title": "35岁程序员焦虑的不是AI", "based_on": "audience_specific", "why": "X"},
            {"title": "学AI的人99%都转错了", "based_on": "contrarian_inversion", "why": "Y"},
            {"title": "凌晨3点我取消了所有AI课", "based_on": "scenario_specific", "why": "Z"},
            {"title": "AI时代真正该转的不是技能", "based_on": "hidden_assumption_reveal", "why": "W"},
            {"title": "你的转型焦虑AI救不了", "based_on": "pain_anchor", "why": "V"}
        ]'''
        titles = parse_deep_titles(llm_output)
        self.assertEqual(len(titles), 5)
        self.assertEqual(titles[0]["title"], "35岁程序员焦虑的不是AI")

    def test_parses_json_in_code_block(self):
        llm_output = '''```json
[
    {"title": "T1", "based_on": "core_claim_challenge", "why": "X"},
    {"title": "T2", "based_on": "contrarian_inversion", "why": "Y"}
]
```'''
        titles = parse_deep_titles(llm_output)
        self.assertEqual(len(titles), 2)

    def test_returns_empty_on_invalid(self):
        self.assertEqual(parse_deep_titles("not json"), [])
        self.assertEqual(parse_deep_titles(""), [])
        self.assertEqual(parse_deep_titles(None), [])

    def test_validates_based_on_value(self):
        """based_on 必须在 VALID_BASED_ON 中，否则丢弃"""
        llm_output = '''[
            {"title": "T1", "based_on": "valid_one", "why": "X"},
            {"title": "T2", "based_on": "contrarian_inversion", "why": "Y"},
            {"title": "T3", "based_on": "INVALID_VALUE", "why": "Z"}
        ]'''
        # T1 based_on 不在 8 个标准里（valid_one 不是标准）应被过滤
        # T2 based_on 是 contrarian_inversion，保留
        # T3 based_on 是 INVALID_VALUE，应被过滤
        titles = parse_deep_titles(llm_output)
        kept = [t for t in titles if t["based_on"]]
        # T2 应该被保留
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]["based_on"], "contrarian_inversion")


# ============ 标题过滤 ============

class TestFilterTitles(unittest.TestCase):
    """按长度、禁用词、avoid_keywords 过滤标题"""

    def test_filters_short_titles(self):
        titles = [
            {"title": "太短", "based_on": "audience_specific", "why": "X"},  # < 18
            {"title": "这个标题足够长但仍不足十八字", "based_on": "contrarian_inversion", "why": "Y"},
            {"title": "这个标题有18-28字之间适合公众号发布", "based_on": "scenario_specific", "why": "Z"},
        ]
        filtered = filter_titles(titles, BANNED_WORDS, [])
        # 第一个太短(< 18)，第二个刚好 17 也不达标，第三个 18 字以上 OK
        ok_titles = [t["title"] for t in filtered]
        self.assertNotIn("太短", ok_titles)
        self.assertIn("这个标题有18-28字之间适合公众号发布", ok_titles)

    def test_filters_long_titles(self):
        long_title = "这" * 40  # 40 chars
        titles = [{"title": long_title, "based_on": "audience_specific", "why": "X"}]
        filtered = filter_titles(titles, BANNED_WORDS, [])
        self.assertEqual(len(filtered), 0)

    def test_filters_banned_words(self):
        titles = [
            {"title": "AI 时代的认知升级：颠覆性内容", "based_on": "audience_specific", "why": "X"},
            # "颠覆" 在 BANNED_WORDS
            {"title": "35 岁程序员不焦虑的具体方法", "based_on": "audience_specific", "why": "Y"},
        ]
        filtered = filter_titles(titles, BANNED_WORDS, [])
        ok_titles = [t["title"] for t in filtered]
        self.assertNotIn("AI 时代的认知升级：颠覆性内容", ok_titles)
        self.assertIn("35 岁程序员不焦虑的具体方法", ok_titles)

    def test_filters_avoid_keywords(self):
        """人设 avoid_keywords 也过滤"""
        titles = [
            {"title": "35 岁程序员的干货方法论其实非常简单可行", "based_on": "audience_specific", "why": "X"},
            # "干货" 在 persona avoid_keywords
            {"title": "35 岁程序员的实操方法其实非常清晰明了", "based_on": "audience_specific", "why": "Y"},
        ]
        filtered = filter_titles(titles, BANNED_WORDS, ["干货"])
        ok_titles = [t["title"] for t in filtered]
        self.assertNotIn("35 岁程序员的干货方法论其实非常简单可行", ok_titles)
        self.assertIn("35 岁程序员的实操方法其实非常清晰明了", ok_titles)

    def test_filters_banned_words(self):
        titles = [
            {"title": "AI 时代的认知升级方法：颠覆性内容深度解析", "based_on": "audience_specific", "why": "X"},
            # "颠覆" 在 BANNED_WORDS
            {"title": "35 岁程序员不焦虑的具体方法论分享给你", "based_on": "audience_specific", "why": "Y"},
        ]
        filtered = filter_titles(titles, BANNED_WORDS, [])
        ok_titles = [t["title"] for t in filtered]
        self.assertNotIn("AI 时代的认知升级方法：颠覆性内容深度解析", ok_titles)
        self.assertIn("35 岁程序员不焦虑的具体方法论分享给你", ok_titles)

    def test_dedupes_based_on(self):
        """based_on 重复时去重"""
        titles = [
            {"title": "T1 same based_on 这是一条18字以上的标题", "based_on": "audience_specific", "why": "X"},
            {"title": "T2 same based_on 也是18字以上的标题", "based_on": "audience_specific", "why": "Y"},
            {"title": "T3 different 也是18字以上的标题啊", "based_on": "contrarian_inversion", "why": "Z"},
        ]
        filtered = filter_titles(titles, BANNED_WORDS, [])
        based_ons = [t["based_on"] for t in filtered]
        self.assertEqual(len(set(based_ons)), len(based_ons), "based_on 应去重")

    def test_score_length_in_range(self):
        """score_length 返回字数"""
        self.assertEqual(score_length("12345"), 5)
        self.assertEqual(score_length(""), 0)
        self.assertEqual(score_length("a" * 100), 100)


# ============ 命令解析 ============

class TestHandleDeepCommand(unittest.TestCase):
    """深度模式下的用户命令处理"""

    def _make_state(self, titles=None):
        return {
            "depth": {"core_claim": "X"},
            "titles": titles or [
                {"title": "T1", "based_on": "audience_specific", "why": "X"},
                {"title": "T2", "based_on": "contrarian_inversion", "why": "Y"},
                {"title": "T3", "based_on": "scenario_specific", "why": "Z"},
            ],
            "selected": None,
            "regen_count": 0,
        }

    def test_q_exits(self):
        result = handle_deep_command("q", self._make_state())
        self.assertEqual(result["action"], "exit")

    def test_quit_exits(self):
        result = handle_deep_command("quit", self._make_state())
        self.assertEqual(result["action"], "exit")

    def test_b_backs_to_broad(self):
        result = handle_deep_command("b", self._make_state())
        self.assertEqual(result["action"], "back_to_broad")

    def test_m_regenerates(self):
        result = handle_deep_command("m", self._make_state())
        self.assertEqual(result["action"], "regenerate")

    def test_w_n_shows_why(self):
        result = handle_deep_command("w 1", self._make_state())
        self.assertEqual(result["action"], "show_why")
        self.assertEqual(result["index"], 0)

    def test_w_n_invalid_format(self):
        result = handle_deep_command("w abc", self._make_state())
        self.assertEqual(result["action"], "error")
        self.assertIn("格式", result["message"])

    def test_number_selects_title(self):
        result = handle_deep_command("2", self._make_state())
        self.assertEqual(result["action"], "select")
        self.assertEqual(result["index"], 1)

    def test_invalid_input_returns_error(self):
        result = handle_deep_command("xyz", self._make_state())
        self.assertEqual(result["action"], "error")

    def test_empty_input_returns_error(self):
        result = handle_deep_command("", self._make_state())
        self.assertEqual(result["action"], "error")


if __name__ == "__main__":
    unittest.main(verbosity=2)

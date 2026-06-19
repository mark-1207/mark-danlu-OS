"""social 模块测试

- platforms：3 平台的规则 + 校验
- picker：LLM 容错 + 启发式评分
- prompts：模板构建
- generator：1 段草稿生成
- orchestrator social 端到端：3 平台 + mock LLM
"""
from __future__ import annotations

import json
import re

import pytest

from lu.config.loader import SocraticStopSignal, StyleProfile
from lu.draft.models import Draft
from lu.pipeline.orchestrator import Orchestrator
from lu.social import (
    PLATFORMS,
    PLATFORM_TOUTIAO,
    PLATFORM_TWITTER,
    PLATFORM_WEIBO,
    generate_social_draft,
    generate_social_titles,
    get_platform,
    parse_titles_response,
    pick_best_title,
)
from lu.social.platforms import (
    VALID_PLATFORMS,
    PlatformConfig,
)
from lu.thinking_models.registry import FrameworkRegistry, ThinkingModelRegistry


class TestPlatforms:
    def test_three_platforms_defined(self) -> None:
        assert set(PLATFORMS.keys()) == {"weibo", "toutiao", "twitter"}
        assert set(VALID_PLATFORMS) == {"weibo", "toutiao", "twitter"}

    def test_weibo_max_2000(self) -> None:
        assert PLATFORM_WEIBO.max_length == 2000
        assert PLATFORM_WEIBO.hashtag_format == "#"

    def test_toutiao_longer(self) -> None:
        assert PLATFORM_TOUTIAO.max_length == 2000
        assert PLATFORM_TOUTIAO.min_length == 500

    def test_twitter_short_280(self) -> None:
        assert PLATFORM_TWITTER.max_length == 280

    def test_validate_length_pass(self) -> None:
        assert PLATFORM_WEIBO.validate_length("x" * 200)
        assert PLATFORM_TWITTER.validate_length("x" * 200)

    def test_validate_length_fail(self) -> None:
        assert not PLATFORM_TWITTER.validate_length("x" * 500)
        assert not PLATFORM_WEIBO.validate_length("x")

    def test_get_platform_unknown_raises(self) -> None:
        with pytest.raises(ValueError, match="未知平台"):
            get_platform("wechat")

    def test_format_hashtags(self) -> None:
        s = PLATFORM_WEIBO.format_hashtags(["AI", "杠杆者"])
        assert "#AI #杠杆者" == s

    def test_format_hashtags_truncate(self) -> None:
        """hashtag_count 之外的多余 tag 被截断"""
        s = PLATFORM_WEIBO.format_hashtags(["a", "b", "c", "d", "e"])
        assert len(s.split()) == 3


class TestPicker:
    def test_pick_best_prefers_data(self) -> None:
        candidates = [
            "一个普通观点",  # 无加分
            "80% 的 AI 项目都失败了",  # 数字 +2 → 2.0
        ]
        assert pick_best_title(candidates) == "80% 的 AI 项目都失败了"

    def test_pick_best_prefers_question(self) -> None:
        candidates = [
            "陈述句",
            "为什么 AI 没用？",  # 反问 +1.5 + 问号 +0.5 = 2.0
        ]
        assert pick_best_title(candidates) == "为什么 AI 没用？"

    def test_pick_best_empty(self) -> None:
        assert pick_best_title([]) == ""

    def test_parse_titles_array(self) -> None:
        raw = json.dumps({"titles": ["A", "B", "C"]}, ensure_ascii=False)
        assert parse_titles_response(raw) == ["A", "B", "C"]

    def test_parse_titles_pure_list(self) -> None:
        raw = json.dumps(["A", "B", "C"])
        assert parse_titles_response(raw) == ["A", "B", "C"]

    def test_parse_titles_code_fence(self) -> None:
        raw = "```json\n" + json.dumps({"titles": ["A"]}) + "\n```"
        assert parse_titles_response(raw) == ["A", "A", "A"]  # 不足补齐

    def test_parse_titles_invalid_json(self) -> None:
        raw = "not json at all"
        result = parse_titles_response(raw, expected_n=3)
        # 解析失败时返回 raw text 复制 3 次
        assert len(result) == 3
        assert all("not json" in r for r in result)

    def test_parse_titles_empty(self) -> None:
        assert parse_titles_response("") == []


class TestGenerateSocialTitles:
    def test_calls_llm_and_parses(self) -> None:
        calls: list[str] = []

        def llm(prompt: str) -> str:
            calls.append(prompt)
            return json.dumps({"titles": ["A", "B", "C"]}, ensure_ascii=False)

        result = generate_social_titles("test prop", llm_call=llm, n=3)
        assert result == ["A", "B", "C"]
        assert len(calls) == 1
        assert "test prop" in calls[0]


class TestGenerateSocialDraft:
    def _make_llm(self, content: str = "草稿正文", hashtags: list[str] | None = None):
        def llm(prompt: str) -> str:
            return json.dumps(
                {"content": content, "hashtags": hashtags or []},
                ensure_ascii=False,
            )
        return llm

    def test_generates_draft_with_hashtags(self) -> None:
        platform = PLATFORM_WEIBO
        draft = generate_social_draft(
            proposition="AI 杠杆者",
            title="AI 杠杆者陷阱",
            platform=platform,
            llm_call=self._make_llm(hashtags=["AI", "杠杆"]),
        )
        assert isinstance(draft, Draft)
        assert draft.title == "AI 杠杆者陷阱"
        assert len(draft.sections) == 1
        assert draft.sections[0].content is not None
        assert "#AI #杠杆" in draft.sections[0].content
        assert draft.total_word_count > 0

    def test_generates_draft_without_hashtags(self) -> None:
        platform = PLATFORM_TWITTER
        draft = generate_social_draft(
            proposition="X",
            title="X",
            platform=platform,
            llm_call=self._make_llm(hashtags=[]),
        )
        assert isinstance(draft, Draft)
        assert draft.sections[0].content is not None
        assert "#" not in draft.sections[0].content

    def test_twitter_english_prompt(self) -> None:
        """推特平台用英文 prompt"""
        captured_prompt: list[str] = []

        def llm(prompt: str) -> str:
            captured_prompt.append(prompt)
            return json.dumps({"content": "test", "hashtags": []})

        generate_social_draft(
            proposition="X",
            title="X",
            platform=PLATFORM_TWITTER,
            llm_call=llm,
        )
        assert "twitter" in captured_prompt[0].lower() or "英文" in captured_prompt[0]

    def test_parses_llm_markdown_fence(self) -> None:
        def llm(prompt: str) -> str:
            return "```json\n" + json.dumps({"content": "X", "hashtags": []}) + "\n```"

        draft = generate_social_draft(
            proposition="p",
            title="t",
            platform=PLATFORM_WEIBO,
            llm_call=llm,
        )
        assert draft.sections[0].content is not None
        assert "X" in draft.sections[0].content


class TestOrchestratorSocialEndToEnd:
    def _style(self) -> StyleProfile:
        return StyleProfile(
            socratic_stop_signal=SocraticStopSignal(
                saturation_keywords=["够了"], typical_rounds=2
            )
        )

    def _llm(self, titles: list[str], content: str = "草稿正文", hashtags: list[str] | None = None):
        def llm(prompt: str) -> str:
            if "标题" in prompt or "titles" in prompt:
                return json.dumps({"titles": titles}, ensure_ascii=False)
            return json.dumps(
                {"content": content, "hashtags": hashtags or []},
                ensure_ascii=False,
            )
        return llm

    def _orch(self) -> Orchestrator:
        sp = self._style()
        fr = FrameworkRegistry([])
        mr = ThinkingModelRegistry([])
        return Orchestrator(style_profile=sp, model_registry=mr, framework_registry=fr, mode="social")

    def test_social_weibo_runs_4_steps(self) -> None:
        orch = self._orch()
        ctx = orch.run(
            proposition="AI 杠杆者陷阱",
            llm_call=self._llm(
                titles=["AI 杠杆者陷阱", "为什么 AI 没用", "80% 失败"],
                content="AI 把工作变便宜，不让你变贵",
                hashtags=["AI", "杠杆"],
            ),
            social_args={"platform": "weibo"},
        )
        assert ctx.state.value == "completed"
        assert ctx.draft is not None
        assert len(ctx.draft.sections) == 1
        assert ctx.blueprint_title in [
            "AI 杠杆者陷阱",
            "为什么 AI 没用",
            "80% 失败",
        ]
        # auto-pick：80% 失败有数字 → 2.0 分；为什么 AI 没用 有反问 → 2.0 分
        # 评分需要看具体打分；只要是其中之一即可
        assert ctx.social_platform == "weibo"

    def test_social_invalid_platform_raises(self) -> None:
        orch = self._orch()
        with pytest.raises(ValueError, match="未知 social 平台"):
            orch.run(
                proposition="x",
                llm_call=self._llm(titles=["A", "B", "C"]),
                social_args={"platform": "wechat"},
            )

    def test_social_default_platform_is_weibo(self) -> None:
        orch = self._orch()
        ctx = orch.run(
            proposition="x",
            llm_call=self._llm(titles=["A", "B", "C"]),
        )
        assert ctx.social_platform == "weibo"

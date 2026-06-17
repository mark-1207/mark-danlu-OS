"""draft/generator.py 测试

DraftGenerator.generate(blueprint, style, llm_call) → Draft
- 每段独立 LLM 调用
- 解析 JSON {content, self_confidence}
- 单段失败重试 2 次后跳过
"""
from __future__ import annotations

import json

import pytest

from lu.blueprint.models import (
    AntiAIAnchors,
    Blueprint,
    Section,
    SectionRole,
)
from lu.config.loader import StyleProfile
from lu.draft.generator import DraftGenerator
from lu.draft.models import Draft


def _blueprint_with_sections() -> Blueprint:
    sections = [
        Section(role=SectionRole.HOOK, must_have=[], word_limit=100, style_hint="短"),
        Section(role=SectionRole.ANTI_CONSENSUS, must_have=[], word_limit=300, style_hint="反共识"),
        Section(role=SectionRole.CASE, must_have=[], word_limit=400, style_hint="案例"),
    ]
    return Blueprint(
        proposition="p",
        stance="s",
        framework="problem_decomposition",
        framework_output={},
        audience="a",
        core_anti_consensus="c",
        cases=[],
        data=[],
        quotes=[],
        forbidden=[],
        sections=sections,
        anti_ai_anchors=AntiAIAnchors(),
    )


def _style() -> StyleProfile:
    return StyleProfile(version=1)


def _ok_response(content: str, confidence: float = 0.85) -> str:
    return json.dumps({"content": content, "self_confidence": confidence}, ensure_ascii=False)


def _tracking_llm(responses: list[str]):
    calls: list[str] = []
    iterator = iter(responses)

    def call(prompt: str) -> str:
        calls.append(prompt)
        try:
            return next(iterator)
        except StopIteration:
            return "[NO_MORE]"

    return call, calls


class TestGenerateHappyPath:
    def test_returns_draft(self):
        llm, _ = _tracking_llm([
            _ok_response("钩子", 0.9),
            _ok_response("反共识", 0.8),
            _ok_response("案例", 0.7),
        ])
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert isinstance(d, Draft)
        assert len(d.sections) == 3
        assert d.failed_sections == []

    def test_section_content_filled(self):
        llm, _ = _tracking_llm([
            _ok_response("钩子内容"),
            _ok_response("反共识内容"),
            _ok_response("案例内容"),
        ])
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.sections[0].content == "钩子内容"
        assert d.sections[1].content == "反共识内容"
        assert d.sections[2].content == "案例内容"

    def test_section_confidence_filled(self):
        llm, _ = _tracking_llm([
            _ok_response("a", 0.95),
            _ok_response("b", 0.65),
            _ok_response("c", 0.5),
        ])
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.sections[0].self_confidence == 0.95
        assert d.sections[1].self_confidence == 0.65
        assert d.sections[2].self_confidence == 0.5

    def test_total_word_count_calculated(self):
        llm, _ = _tracking_llm([
            _ok_response("abc"),  # 3 chars
            _ok_response("defgh"),  # 5 chars
            _ok_response("ij"),  # 2 chars
        ])
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.total_word_count == 10

    def test_one_llm_call_per_section(self):
        llm, calls = _tracking_llm([
            _ok_response("a"),
            _ok_response("b"),
            _ok_response("c"),
        ])
        gen = DraftGenerator(llm_call=llm)

        gen.generate(_blueprint_with_sections(), _style())

        assert len(calls) == 3


class TestGenerateFailures:
    def test_invalid_json_retries(self):
        llm, calls = _tracking_llm([
            "not json",
            _ok_response("ok retry"),
            _ok_response("ok"),
            _ok_response("ok"),
        ])
        gen = DraftGenerator(llm_call=llm, max_retries=2)

        d = gen.generate(_blueprint_with_sections(), _style())

        # 第 1 段：失败 → 重试 1 次 → 成功
        assert d.sections[0].content == "ok retry"
        # 总调用：3 sections + 1 retry = 4
        assert len(calls) == 4

    def test_section_failed_after_max_retries(self):
        llm, _ = _tracking_llm([
            "bad1", "bad2", "bad3",  # 第 1 段全部失败
            _ok_response("ok"),
            _ok_response("ok"),
        ])
        gen = DraftGenerator(llm_call=llm, max_retries=2)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.failed_sections == [SectionRole.HOOK]
        assert len(d.sections) == 2  # 其他两段正常

    def test_all_sections_failed(self):
        llm, _ = _tracking_llm(["bad"] * 9)  # 3 sections * 3 tries
        gen = DraftGenerator(llm_call=llm, max_retries=2)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.failed_sections == [
            SectionRole.HOOK,
            SectionRole.ANTI_CONSENSUS,
            SectionRole.CASE,
        ]
        assert len(d.sections) == 0

    def test_default_max_retries_is_2(self):
        gen = DraftGenerator(llm_call=lambda _: "")
        assert gen.max_retries == 2


class TestGenerateMetadata:
    def test_title_derived_from_proposition(self):
        llm, _ = _tracking_llm([
            _ok_response("a"),
            _ok_response("b"),
            _ok_response("c"),
        ])
        gen = DraftGenerator(llm_call=llm)
        bp = _blueprint_with_sections()

        d = gen.generate(bp, _style())

        assert d.title == "p"

    def test_generated_at_set(self):
        llm, _ = _tracking_llm([_ok_response("a")] * 3)
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.generated_at is not None

    def test_generation_duration_recorded(self):
        llm, _ = _tracking_llm([_ok_response("a")] * 3)
        gen = DraftGenerator(llm_call=llm)

        d = gen.generate(_blueprint_with_sections(), _style())

        assert d.generation_duration_sec >= 0
"""draft/models.py 测试

Draft 草稿数据模型：
- title 标题
- sections 已填充 content 的段位列表
- total_word_count 总字数
- generated_at / generation_duration_sec
- failed_sections 生成失败的段位
"""
from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from lu.blueprint.models import Section, SectionRole
from lu.draft.models import Draft


def _section_with_content(role: SectionRole, content: str = "段落正文") -> Section:
    return Section(
        role=role,
        must_have=[],
        word_limit=200,
        style_hint="直白",
        content=content,
        self_confidence=0.8,
    )


class TestDraftConstruction:
    def test_minimal(self):
        d = Draft(
            title="为什么学 AI 赚不到钱",
            sections=[_section_with_content(SectionRole.HOOK, "钩子正文")],
            total_word_count=100,
        )
        assert d.title == "为什么学 AI 赚不到钱"
        assert len(d.sections) == 1
        assert d.failed_sections == []

    def test_defaults(self):
        d = Draft(title="x", sections=[], total_word_count=0)
        assert d.failed_sections == []
        assert d.generation_duration_sec == 0.0
        assert isinstance(d.generated_at, datetime)

    def test_failed_sections_populated(self):
        d = Draft(
            title="x",
            sections=[_section_with_content(SectionRole.HOOK, "ok")],
            total_word_count=50,
            failed_sections=[SectionRole.THINKING],
        )
        assert d.failed_sections == [SectionRole.THINKING]

    def test_total_word_count_must_be_non_negative(self):
        with pytest.raises(ValidationError):
            Draft(title="x", sections=[], total_word_count=-1)


class TestDraftJsonRoundtrip:
    def test_roundtrip(self):
        d = Draft(
            title="x",
            sections=[_section_with_content(SectionRole.HOOK, "ok")],
            total_word_count=50,
        )
        j = d.model_dump_json()
        d2 = Draft.model_validate_json(j)
        assert d2 == d
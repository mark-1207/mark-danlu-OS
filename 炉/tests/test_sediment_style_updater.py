"""sediment/style_updater.py 测试

StyleUpdater.update(harvested, profile) → StyleProfile
- 合并 forbidden_candidates 到 profile.forbidden
- 去重
"""
from __future__ import annotations

from lu.config.loader import ForbiddenTerm, StyleProfile
from lu.sediment.models import Harvested
from lu.sediment.style_updater import StyleUpdater


def _profile() -> StyleProfile:
    return StyleProfile(
        version=1,
        voice="直白",
        forbidden=[ForbiddenTerm(term="赋能", severity="medium")],
    )


class TestStyleUpdaterUpdate:
    def test_returns_profile(self):
        h = Harvested()
        p = StyleUpdater.update(h, _profile())
        assert isinstance(p, StyleProfile)

    def test_empty_harvested_keeps_profile(self):
        h = Harvested()
        p = StyleUpdater.update(h, _profile())
        assert "赋能" in [t.term for t in p.forbidden]

    def test_adds_new_forbidden_terms(self):
        h = Harvested(forbidden_candidates=["闭环", "抓手"])
        p = StyleUpdater.update(h, _profile())
        terms = [t.term for t in p.forbidden]
        assert "闭环" in terms
        assert "抓手" in terms

    def test_does_not_duplicate_existing(self):
        h = Harvested(forbidden_candidates=["赋能", "闭环"])  # 赋能已存在
        p = StyleUpdater.update(h, _profile())
        # "赋能" 只出现一次
        assert [t.term for t in p.forbidden].count("赋能") == 1
        assert "闭环" in [t.term for t in p.forbidden]

    def test_preserves_voice(self):
        h = Harvested(forbidden_candidates=["x"])
        p = StyleUpdater.update(h, _profile())
        assert p.voice == "直白"

    def test_does_not_mutate_input(self):
        h = Harvested(forbidden_candidates=["闭环"])
        original = _profile()
        StyleUpdater.update(h, original)
        # 原 profile 不变
        assert "闭环" not in [t.term for t in original.forbidden]

    def test_new_terms_default_severity(self):
        h = Harvested(forbidden_candidates=["新词"])
        p = StyleUpdater.update(h, _profile())
        new_term = next(t for t in p.forbidden if t.term == "新词")
        assert new_term.severity == "medium"
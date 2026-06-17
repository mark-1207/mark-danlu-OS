"""StyleProfile ↔ Bitable 序列化测试"""
from __future__ import annotations

from lu.config.loader import ForbiddenTerm, SocraticStopSignal, StyleProfile
from lu.feishu.style_profile import from_bitable, to_bitable


def _sample_profile() -> StyleProfile:
    return StyleProfile(
        version=2,
        voice="犀利直接",
        forbidden=[
            ForbiddenTerm(term="赋能", severity="high"),
            ForbiddenTerm(term="让我们来看看", severity="medium"),
        ],
        socratic_stop_signal=SocraticStopSignal(
            typical_rounds=4.0,
            saturation_keywords=["够了", "差不多了"],
            auto_stop_enabled=False,
            sample_count=10,
        ),
    )


def _sample_bitable_fields() -> dict:
    return {
        "version": 2,
        "voice": "犀利直接",
        "forbidden_terms": ["赋能", "让我们来看看"],
        "forbidden_severity": ["high", "medium"],
        "stop_typical_rounds": 4.0,
        "stop_saturation_keywords": ["够了", "差不多了"],
        "stop_auto_enabled": False,
        "stop_sample_count": 10,
    }


class TestStyleProfileBitable:
    def test_to_bitable_round_trip(self) -> None:
        profile = _sample_profile()
        fields = to_bitable(profile)
        restored = from_bitable(fields)
        assert restored.version == profile.version
        assert restored.voice == profile.voice
        assert [t.term for t in restored.forbidden] == [t.term for t in profile.forbidden]
        assert restored.socratic_stop_signal.typical_rounds == 4.0

    def test_to_bitable_minimal_profile(self) -> None:
        minimal = StyleProfile()
        fields = to_bitable(minimal)
        assert fields["version"] == 1
        assert fields["voice"] is None or fields["voice"] == ""

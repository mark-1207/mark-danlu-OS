"""StyleProfile ↔ Bitable 序列化"""
from __future__ import annotations

from lu.config.loader import ForbiddenTerm, SocraticStopSignal, StyleProfile


def to_bitable(profile: StyleProfile) -> dict:
    """StyleProfile → Bitable fields dict

    Bitable schema (固定 v1.2):
    - version: Number
    - voice: SingleLine
    - forbidden_terms: MultiLine
    - forbidden_severity: MultiLine（与 forbidden_terms 等长）
    - stop_typical_rounds: Number
    - stop_saturation_keywords: MultiLine
    - stop_auto_enabled: Checkbox
    - stop_sample_count: Number
    """
    return {
        "version": profile.version,
        "voice": profile.voice or "",
        "forbidden_terms": [t.term for t in profile.forbidden],
        "forbidden_severity": [t.severity for t in profile.forbidden],
        "stop_typical_rounds": profile.socratic_stop_signal.typical_rounds,
        "stop_saturation_keywords": list(profile.socratic_stop_signal.saturation_keywords),
        "stop_auto_enabled": profile.socratic_stop_signal.auto_stop_enabled,
        "stop_sample_count": profile.socratic_stop_signal.sample_count,
    }


def from_bitable(fields: dict) -> StyleProfile:
    """Bitable fields dict → StyleProfile"""
    terms = fields.get("forbidden_terms", []) or []
    severities = fields.get("forbidden_severity", []) or []
    forbidden: list[ForbiddenTerm] = []
    for i, t in enumerate(terms):
        sev = severities[i] if i < len(severities) else "medium"
        forbidden.append(ForbiddenTerm(term=str(t), severity=str(sev)))

    return StyleProfile(
        version=int(fields.get("version", 1)),
        voice=(fields.get("voice") or None),
        forbidden=forbidden,
        socratic_stop_signal=SocraticStopSignal(
            typical_rounds=float(fields.get("stop_typical_rounds", 3.0)),
            saturation_keywords=list(fields.get("stop_saturation_keywords", []) or []),
            auto_stop_enabled=bool(fields.get("stop_auto_enabled", False)),
            sample_count=int(fields.get("stop_sample_count", 0)),
        ),
    )


__all__ = ["to_bitable", "from_bitable"]

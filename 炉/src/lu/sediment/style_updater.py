"""StyleUpdater：合并 forbidden_candidates 到 StyleProfile.forbidden（去重）

参考 docs/03-MODULE-DESIGN.md 3.6
"""
from __future__ import annotations

from lu.config.loader import ForbiddenTerm, StyleProfile
from lu.sediment.models import Harvested


class StyleUpdater:
    """风格画像更新器"""

    @staticmethod
    def update(harvested: Harvested, profile: StyleProfile) -> StyleProfile:
        existing = {t.term for t in profile.forbidden}
        new_terms = [t for t in harvested.forbidden_candidates if t and t not in existing]

        merged = list(profile.forbidden) + [
            ForbiddenTerm(term=t, severity="medium") for t in new_terms
        ]

        return profile.model_copy(update={"forbidden": merged})
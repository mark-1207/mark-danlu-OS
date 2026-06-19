"""social 模块：social 模式 4 步全自动 + 平台分支

触发场景：写微博/头条/推特等社交平台短内容（v3 P0 决定）
"""
from __future__ import annotations

from lu.social.generator import generate_social_draft
from lu.social.picker import generate_social_titles, parse_titles_response, pick_best_title
from lu.social.platforms import (
    PLATFORMS,
    PLATFORM_TOUTIAO,
    PLATFORM_TWITTER,
    PLATFORM_WEIBO,
    PlatformConfig,
    VALID_PLATFORMS,
    get_platform,
)

__all__ = [
    "PLATFORMS",
    "PLATFORM_TOUTIAO",
    "PLATFORM_TWITTER",
    "PLATFORM_WEIBO",
    "PlatformConfig",
    "VALID_PLATFORMS",
    "generate_social_draft",
    "generate_social_titles",
    "get_platform",
    "parse_titles_response",
    "pick_best_title",
]

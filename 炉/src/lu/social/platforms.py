"""平台规则：social 模式各平台的字数/格式/标签约束

每个平台定义一个 PlatformConfig，约束：
- max_length: 最大字数
- min_length: 最小字数
- hashtag_count: 期望 hashtag 数量
- hashtag_format: "#xxx" 或 "##xxx"
- tone: 平台特定语气
- content_rules: 列表，每条是一条规则（用于 prompt 注入）

参考微博/头条/推特等平台规则。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PlatformConfig:
    name: str
    max_length: int
    min_length: int
    hashtag_count: int
    hashtag_format: str
    tone: str
    content_rules: tuple[str, ...] = field(default_factory=tuple)

    def validate_length(self, text: str) -> bool:
        return self.min_length <= len(text) <= self.max_length

    def format_hashtags(self, tags: list[str]) -> str:
        if not tags:
            return ""
        prefix = self.hashtag_format[0] if self.hashtag_format else "#"
        return " ".join(f"{prefix}{t}" for t in tags[: self.hashtag_count])


PLATFORM_WEIBO = PlatformConfig(
    name="weibo",
    max_length=2000,
    min_length=50,
    hashtag_count=3,
    hashtag_format="#",
    tone="犀利直接，口语化，1-2 句一段，留互动钩子",
    content_rules=(
        "开头不要'今天/最近/我发现'，直接抛观点或事件",
        "控制在 200 字内（不要超 2000 上限，目标是 140-200 字）",
        "结尾用反问或挑战式收束，引评论",
        "话题标签 2-3 个，# 开头，置于文末",
    ),
)


PLATFORM_TOUTIAO = PlatformConfig(
    name="toutiao",
    max_length=2000,
    min_length=500,
    hashtag_count=2,
    hashtag_format="##",
    tone="理性分析，数据支撑，有完整论证链",
    content_rules=(
        "开头抛数据点或反常识事实",
        "中间 2-3 段论证，逻辑递进",
        "结尾给出可操作的建议或开放问题",
        "控制在 800-1500 字最佳",
        "话题标签 1-2 个，## 开头",
    ),
)


PLATFORM_TWITTER = PlatformConfig(
    name="twitter",
    max_length=280,
    min_length=80,
    hashtag_count=2,
    hashtag_format="#",
    tone="英文，简洁有力，1 句 1 观点",
    content_rules=(
        "英文撰写，控制在 280 字符内（包含 hashtag）",
        "1 句话 1 个观点，不分多段",
        "可加 1-2 个英文标签",
        "避免中文标点；句末用 . 或无标点",
    ),
)


PLATFORMS: dict[str, PlatformConfig] = {
    "weibo": PLATFORM_WEIBO,
    "toutiao": PLATFORM_TOUTIAO,
    "twitter": PLATFORM_TWITTER,
}


VALID_PLATFORMS: tuple[str, ...] = ("weibo", "toutiao", "twitter")


def get_platform(name: str) -> PlatformConfig:
    if name not in PLATFORMS:
        raise ValueError(f"未知平台: {name}，可选: {VALID_PLATFORMS}")
    return PLATFORMS[name]


__all__ = [
    "PLATFORM_TOUTIAO",
    "PLATFORM_TWITTER",
    "PLATFORM_WEIBO",
    "PLATFORMS",
    "PlatformConfig",
    "VALID_PLATFORMS",
    "get_platform",
]

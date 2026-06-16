"""6 个固定问题 + 动态追问触发器

参考 02-ARCHITECTURE 2.2 + D-004
- Q1 命题浅层
- Q2 底层逻辑
- Q3 潜在诉求
- Q4 风格倾向
- Q5 具体案例
- Q6 反共识候选
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable


@dataclass(frozen=True)
class TriggerRule:
    id: str
    condition: str
    followup: str
    detector: Callable[[str], bool] = field(default=lambda _: False, repr=False)
    skippable: bool = True


@dataclass(frozen=True)
class Question:
    id: str
    theme: str
    prompt: str
    dynamic_triggers: list[TriggerRule] = field(default_factory=list)


def _is_vague_short(s: str) -> bool:
    s = s.strip()
    if not s:
        return True
    if len(s) <= 2:
        return True
    vague_words = ["没想好", "不知道", "随便", "都行", "都可以", "不确定", "没什么"]
    if any(w in s for w in vague_words):
        return True
    return False


def _has_question_keyword(s: str) -> bool:
    return any(kw in s for kw in ["为什么", "怎么", "为何", "原因", "什么"])


def _lacks_target_audience(s: str) -> bool:
    audience_keywords = [
        "读者", "用户", "受众", "谁", "给", "面向", "目标", "人群", "用户群",
        "读者群", "同学", "朋友", "同事", "客户",
    ]
    return not any(kw in s for kw in audience_keywords)


def _is_uncertain(s: str) -> bool:
    uncertain = ["不知道", "不确定", "随便", "都行", "都可以", "没想好", "没想法"]
    return any(kw in s for kw in uncertain)


def _lacks_concrete_case(s: str) -> bool:
    case_keywords = [
        "案例", "例子", "我", "朋友", "同事", "客户", "用户", "他", "她",
        "上次", "曾经", "当时", "今年", "去年", "上个月",
    ]
    return not any(kw in s for kw in case_keywords)


def _is_not_contrarian(s: str) -> bool:
    contrarian_signals = [
        "但是", "不过", "反过", "实际上", "真相是", "很多人错", "大多数人都",
        "其实", "反常识", "反共识", "换个角度",
    ]
    return not any(kw in s for kw in contrarian_signals)


QUESTION_TEMPLATES: list[Question] = [
    Question(
        id="Q1",
        theme="命题浅层",
        prompt="这个命题，你具体想讨论它的哪个方面？",
        dynamic_triggers=[
            TriggerRule(
                id="Q1.vague",
                condition="答案含糊（空 / 1-2 字 / '没想好'）",
                followup="能更具体些吗？比如一个具体场景或切入点。",
                detector=_is_vague_short,
            ),
        ],
    ),
    Question(
        id="Q2",
        theme="底层逻辑",
        prompt="你为什么想讨论这个？背后真正触动你的是什么？",
        dynamic_triggers=[
            TriggerRule(
                id="Q2.shallow",
                condition="答案较浅（无'为什么/原因/什么'）",
                followup="继续追问：你看到的现象，最让你不安/好奇的是哪一点？",
                detector=lambda s: not _has_question_keyword(s) and len(s.strip()) < 20,
            ),
        ],
    ),
    Question(
        id="Q3",
        theme="潜在诉求",
        prompt="你希望谁读到你写的东西？",
        dynamic_triggers=[
            TriggerRule(
                id="Q3.no_audience",
                condition="答案未提及目标读者",
                followup="想一下：写完你最想转发给谁？为什么是他们？",
                detector=_lacks_target_audience,
            ),
        ],
    ),
    Question(
        id="Q4",
        theme="风格倾向",
        prompt="你希望文章什么风格？",
        dynamic_triggers=[
            TriggerRule(
                id="Q4.uncertain",
                condition="答案不确定",
                followup="给你 3 个风格样本：(A)犀利一针见血 (B)理性事实导向 (C)暖故事叙述。哪个最接近？",
                detector=_is_uncertain,
            ),
        ],
    ),
    Question(
        id="Q5",
        theme="具体案例",
        prompt="你身边有人这样吗？或者你见过的具体例子？",
        dynamic_triggers=[
            TriggerRule(
                id="Q5.no_case",
                condition="答案缺乏具体案例",
                followup="想一个真实的人 / 你亲眼见到 / 你自己经历过的具体场景。",
                detector=_lacks_concrete_case,
            ),
        ],
    ),
    Question(
        id="Q6",
        theme="反共识候选",
        prompt="反过来说呢？这个命题的反面是什么？有没有极端反例？",
        dynamic_triggers=[
            TriggerRule(
                id="Q6.not_contrarian",
                condition="答案未体现反共识",
                followup="试试：'大多数人会说X，但实际上Y' 这种结构。",
                detector=_is_not_contrarian,
            ),
        ],
    ),
]


def should_followup(answer: str, rule: TriggerRule) -> bool:
    return rule.detector(answer)


def next_question(index: int) -> Question | None:
    if 0 <= index < len(QUESTION_TEMPLATES):
        return QUESTION_TEMPLATES[index]
    return None

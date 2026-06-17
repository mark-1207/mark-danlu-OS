"""雷达测试

- suggest_propositions(history, llm) → list[PropositionCandidate]
- LLM 失败时返回空列表
- 历史为空时返回空列表
"""
from __future__ import annotations

import json

from lu.pipeline.models import Context
from lu.report.radar import PropositionCandidate, suggest_propositions


def _llm_with_candidates(_prompt: str = "") -> str:
    return json.dumps(
        {
            "candidates": [
                {"proposition": "候选1", "rationale": "基于杠杆者主题", "related_themes": ["杠杆者"]},
                {"proposition": "候选2", "rationale": "基于反共识", "related_themes": ["反共识"]},
            ]
        },
        ensure_ascii=False,
    )


def _llm_bad(_prompt: str = "") -> str:
    return "not json"


def _empty_history() -> list[Context]:
    return []


def test_suggest_propositions_success() -> None:
    candidates = suggest_propositions(_empty_history(), _llm_with_candidates)
    assert len(candidates) == 2
    assert candidates[0].proposition == "候选1"
    assert candidates[0].related_themes == ["杠杆者"]


def test_suggest_propositions_bad_json_returns_empty() -> None:
    candidates = suggest_propositions(_empty_history(), _llm_bad)
    assert candidates == []


def test_suggest_propositions_empty_history_uses_llm() -> None:
    """空历史时也调用 LLM（LLM 可基于通用知识）"""
    candidates = suggest_propositions(_empty_history(), _llm_with_candidates)
    assert len(candidates) == 2


def test_proposition_candidate_dataclass() -> None:
    c = PropositionCandidate(proposition="x", rationale="r", related_themes=["t"])
    assert c.proposition == "x"
    assert c.rationale == "r"
    assert c.related_themes == ["t"]

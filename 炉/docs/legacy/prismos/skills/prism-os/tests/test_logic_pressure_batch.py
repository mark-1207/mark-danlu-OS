"""
B3-E 回归测试: audit_batch 1 次 LLM + 3 层防御
"""
import json
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def test_audit_batch_full_match():
    """返回数组长度匹配 → 全部用批量结果"""
    from logic_pressure import audit_batch

    titles = ["T1", "T2", "T3"]
    fake_response = json.dumps([
        {"title": "T1", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
        {"title": "T2", "has_fallacy": True, "fallacy_type": "幸存者偏差", "severity": 0.5},
        {"title": "T3", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
    ], ensure_ascii=False)

    with patch("logic_pressure._call_llm_raw", return_value=fake_response):
        result = audit_batch(titles)

    assert len(result) == 3
    assert result[1]["has_fallacy"] is True
    assert result[1]["fallacy_type"] == "幸存者偏差"


def test_audit_batch_length_mismatch_retry():
    """首次返回 2 项（缺 1）→ retry 后返回 3 项 → 用 retry 结果"""
    from logic_pressure import audit_batch

    titles = ["T1", "T2", "T3"]
    short = json.dumps([
        {"title": "T1", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
        {"title": "T2", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
    ], ensure_ascii=False)
    full = json.dumps([
        {"title": "T1", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
        {"title": "T2", "has_fallacy": True, "fallacy_type": "因果倒置", "severity": 0.7},
        {"title": "T3", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
    ], ensure_ascii=False)

    with patch("logic_pressure._call_llm_raw", side_effect=[short, full]):
        result = audit_batch(titles)

    assert len(result) == 3
    # T2 应有正确 audit（来自 retry）
    assert result[1]["fallacy_type"] == "因果倒置"


def test_audit_batch_length_mismatch_fallback():
    """首次 + retry 都缺 → fallback audit_title 补缺失项"""
    from logic_pressure import audit_batch, audit_title

    titles = ["T1", "T2", "T3"]
    short = json.dumps([
        {"title": "T1", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
    ], ensure_ascii=False)
    # retry 也只返回 1 项
    same_short = json.dumps([
        {"title": "T1", "has_fallacy": False, "fallacy_type": "无", "severity": 0.0},
    ], ensure_ascii=False)

    # audit_title fallback 也用 mock
    def fallback_audit(title):
        return {
            "has_fallacy": title == "T2",
            "fallacy_type": "幸存者偏差" if title == "T2" else "无",
            "explanation": f"fallback for {title}",
            "severity": 0.6 if title == "T2" else 0.0,
            "suggestion": ""
        }

    with patch("logic_pressure._call_llm_raw", side_effect=[short, same_short]), \
         patch("logic_pressure.audit_title", side_effect=fallback_audit):
        result = audit_batch(titles)

    # 应该有 3 项
    assert len(result) == 3
    # T2 应来自 fallback
    t2 = next(r for r in result if r["title"] == "T2")
    assert t2["has_fallacy"] is True
    assert t2["fallacy_type"] == "幸存者偏差"
    # T3 也应来自 fallback
    t3 = next(r for r in result if r["title"] == "T3")
    assert t3["fallacy_type"] == "无"


def test_audit_batch_empty():
    """空列表不调用 LLM"""
    from logic_pressure import audit_batch

    with patch("logic_pressure._call_llm_raw") as mock_call:
        result = audit_batch([])
    assert result == []
    mock_call.assert_not_called()


def test_audit_batch_llm_fails():
    """LLM 全部失败 → 全部 fallback audit_title"""
    from logic_pressure import audit_batch

    titles = ["T1", "T2"]
    with patch("logic_pressure._call_llm_raw", return_value=None), \
         patch("logic_pressure.audit_title", return_value={
             "has_fallacy": False, "fallacy_type": "无",
             "explanation": "fb", "severity": 0.0, "suggestion": ""
         }) as mock_audit:
        result = audit_batch(titles)

    assert len(result) == 2
    # 2 次 retry + 2 次 fallback audit_title = 2 calls
    assert mock_audit.call_count == 2

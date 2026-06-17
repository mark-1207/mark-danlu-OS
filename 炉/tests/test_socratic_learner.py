"""Socratic Learner 测试

- 阶段 1（<30 样本）：user_decides（无系统判断）
- 阶段 2（30-100）：suggest_stop（高比例样本在 N 轮停则建议）
- 阶段 3（100+）：auto_stop（高置信度直接停）
"""
from __future__ import annotations

from lu.config.loader import SocraticStopSignal
from lu.socratic.learner import LearningPhase, SocraticLearner, predict_should_stop
from lu.socratic.sample_store import SocraticSample, SampleStore


def _store_with(n: int, rounds: int = 3, user_stop: bool = True) -> SampleStore:
    import tempfile
    import os
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    os.close(fd)
    store = SampleStore(path)
    for _ in range(n):
        store.write(SocraticSample(proposition="x", rounds=rounds, user_says_stop=user_stop))
    return store


def test_phase1_user_decides() -> None:
    """<30 样本：阶段 1"""
    store = _store_with(10)
    phase = SocraticLearner(store).phase()
    assert phase is LearningPhase.PHASE1


def test_phase2_suggests_stop() -> None:
    """30-100 样本：阶段 2"""
    store = _store_with(50)
    phase = SocraticLearner(store).phase()
    assert phase is LearningPhase.PHASE2


def test_phase3_auto_stops() -> None:
    """>=100 样本：阶段 3"""
    store = _store_with(120)
    phase = SocraticLearner(store).phase()
    assert phase is LearningPhase.PHASE3


def test_predict_phase1_returns_none() -> None:
    """阶段 1：不预测"""
    store = _store_with(5)
    signal = SocraticStopSignal(typical_rounds=3.0)
    result = predict_should_stop(store, signal, current_rounds=3)
    assert result is None  # 阶段 1 让用户决定


def test_predict_phase2_high_user_stop_ratio() -> None:
    """阶段 2：用户 80% 在 3 轮停 → 建议停"""
    store = _store_with(50, rounds=3, user_stop=True)
    signal = SocraticStopSignal(typical_rounds=3.0)
    result = predict_should_stop(store, signal, current_rounds=3)
    assert result is not None
    assert result.action == "suggest"
    assert result.reason  # 非空


def test_predict_phase3_high_confidence_stops() -> None:
    """阶段 3：>=100 样本 + 高 user_stop 比例 + rounds >= typical → auto"""
    store = _store_with(120, rounds=3, user_stop=True)
    signal = SocraticStopSignal(typical_rounds=3.0)
    result = predict_should_stop(store, signal, current_rounds=4)
    assert result is not None
    assert result.action == "auto"


def test_predict_phase3_no_samples_collected() -> None:
    """阶段 3 但样本全是 user_stop=False → 仍 auto（无建议）"""
    store = _store_with(120, rounds=3, user_stop=False)
    signal = SocraticStopSignal(typical_rounds=3.0)
    result = predict_should_stop(store, signal, current_rounds=4)
    # 0% user_stop 比例不满足条件
    assert result is None


def test_engine_appends_sample_to_store() -> None:
    """SocraticEngine.run() 完成后应写一条样本到 sample_store"""
    import tempfile
    import os
    import json
    from lu.socratic.engine import SocraticEngine
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    os.close(fd)

    from lu.socratic.sample_store import SampleStore
    store = SampleStore(path)
    signal = SocraticStopSignal(typical_rounds=3.0)

    refined_json = json.dumps({
        "surface": "s", "underlying": "u", "audience": "a",
        "style_recommendation": {"voice": "v", "tone": "t", "examples": []},
        "contrarian_candidates": [], "framework_candidates": [],
        "risks": [], "falsifiability": "",
    }, ensure_ascii=False)

    engine = SocraticEngine(
        proposition="测试",
        signal=signal,
        ask_user=lambda prompt: "因为...",
        ask_yes_no=lambda prompt: True,
        llm_call=lambda prompt: refined_json,
        sample_store=store,
    )
    result = engine.run()
    assert result.rounds_completed == 6
    samples = store.read_all()
    assert len(samples) == 1
    assert samples[0].proposition == "测试"
    assert samples[0].rounds == 6

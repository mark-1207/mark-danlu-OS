#!/usr/bin/env python3
"""
PRISM-OS 冲突检测模块 (M3 基础)

3 类冲突:
- A 命题撞车: 当前命题 vs 历史命题的文本相似度
- B 角度撞车: 当前标题候选 vs 历史标题的语义相似度
- C 受众疲劳: 同受众 30 天内出现频次
- D 数据撞车: v1 跳过（v2 启用）

全部 warn 放行，不阻断。Phase 1.5 一次检测。
"""
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional


# 默认阈值（plan 已确认）
DEFAULT_THSIS_THRESHOLD = 0.6   # A 命题撞车
DEFAULT_ANGLE_THRESHOLD = 0.55   # B 角度撞车
DEFAULT_AUDIENCE_WARN = 5        # C 受众疲劳 warn
DEFAULT_AUDIENCE_HIGH = 8        # C 受众疲劳 high
DEFAULT_LOOKBACK_DAYS = 30       # 时间窗口


# ============ 工具函数 ============

def jaccard_similarity(a: str, b: str) -> float:
    """字符级 Jaccard 相似度（中英文都按单字）"""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    # 单字集合
    chars_a = set(re.sub(r"\s+", "", a.lower()))
    chars_b = set(re.sub(r"\s+", "", b.lower()))
    if not chars_a or not chars_b:
        return 0.0
    intersection = chars_a & chars_b
    union = chars_a | chars_b
    return len(intersection) / len(union)


def _parse_ts(ts: Optional[str]) -> Optional[datetime]:
    """解析 ISO 格式时间戳"""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


def filter_recent_history(history: List[Dict], lookback_days: int = DEFAULT_LOOKBACK_DAYS,
                          now: Optional[datetime] = None) -> List[Dict]:
    """按时间窗口过滤历史（无时间戳的默认保留）"""
    if now is None:
        now = datetime.now()
    cutoff = now - timedelta(days=lookback_days)
    result = []
    for entry in history:
        ts = _parse_ts(entry.get("timestamp"))
        if ts is None or ts >= cutoff:
            result.append(entry)
    return result


# ============ A 命题撞车 ============

def detect_thesis_collision(thesis: str, history: List[Dict],
                           threshold: float = DEFAULT_THSIS_THRESHOLD) -> List[Dict]:
    """
    检测命题撞车：当前命题 vs 历史命题的 jaccard 相似度。

    Returns:
        [{"thesis": str, "similarity": float, "date": str}, ...]  # 超过阈值的
    """
    if not thesis or not history:
        return []
    collisions = []
    for h in history:
        past_thesis = h.get("thesis", "")
        if not past_thesis:
            continue
        sim = jaccard_similarity(thesis, past_thesis)
        if sim > threshold:
            collisions.append({
                "thesis": past_thesis,
                "similarity": sim,
                "date": h.get("timestamp", ""),
            })
    return sorted(collisions, key=lambda x: x["similarity"], reverse=True)


# ============ B 角度撞车 ============

def detect_angle_collision(candidate_title: str, history: List[Dict],
                          threshold: float = DEFAULT_ANGLE_THRESHOLD) -> List[Dict]:
    """
    检测角度撞车：当前标题 vs 历史标题的相似度。
    角度相似 = 相似句式 + 相似关键词（粗略 jaccard）。
    """
    if not candidate_title or not history:
        return []
    collisions = []
    for h in history:
        past_title = h.get("title", "")
        if not past_title:
            continue
        sim = jaccard_similarity(candidate_title, past_title)
        if sim > threshold:
            collisions.append({
                "title": past_title,
                "similarity": sim,
                "date": h.get("timestamp", ""),
            })
    return sorted(collisions, key=lambda x: x["similarity"], reverse=True)


# ============ C 受众疲劳 ============

def detect_audience_fatigue(audience: str, history: List[Dict],
                             threshold_warn: int = DEFAULT_AUDIENCE_WARN,
                             threshold_high: int = DEFAULT_AUDIENCE_HIGH) -> Dict:
    """
    检测受众疲劳：30 天内同受众出现频次。

    Returns:
        {"level": "none"|"warn"|"high", "count": int, "audience": str}
    """
    if not audience or not history:
        return {"level": "none", "count": 0, "audience": audience}
    count = sum(1 for h in history if h.get("audience", "") == audience)
    if count >= threshold_high:
        level = "high"
    elif count >= threshold_warn:
        level = "warn"
    else:
        level = "none"
    return {"level": level, "count": count, "audience": audience}


# ============ 主入口 ============

def detect_conflicts(thesis: str, history: List[Dict],
                    now: Optional[datetime] = None,
                    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
                    audience: str = "",
                    thesis_threshold: float = DEFAULT_THSIS_THRESHOLD,
                    angle_threshold: float = DEFAULT_ANGLE_THRESHOLD,
                    audience_warn: int = DEFAULT_AUDIENCE_WARN,
                    audience_high: int = DEFAULT_AUDIENCE_HIGH,
                    current_series_id: Optional[str] = None) -> Dict:
    """
    3 类冲突统一检测（D 类 v1 跳过）。

    Args:
        current_series_id: 当前 run 的 series_id；同 series_id 的历史项豁免冲突。

    Returns:
        {
            "thesis_collisions": List[Dict],
            "angle_collisions": List[Dict],   # 当前空（候选标题需在棱镜后传入）
            "audience_fatigue": Dict,
            "data_collisions": {"enabled": False, "note": "v1 暂不支持"},
            "lookback_days": int,
        }
    """
    if now is None:
        now = datetime.now()
    recent = filter_recent_history(history, lookback_days, now)

    # series 豁免：剔除同 series_id 的历史项
    if current_series_id:
        recent = [h for h in recent if h.get("series_id") != current_series_id]

    # 角度撞车暂不在主入口（候选标题在棱镜后才生成）
    return {
        "thesis_collisions": detect_thesis_collision(thesis, recent, thesis_threshold),
        "angle_collisions": [],
        "audience_fatigue": detect_audience_fatigue(audience, recent, audience_warn, audience_high),
        "data_collisions": {"enabled": False, "note": "v1 暂不支持，v2 等'写完提取证据'机制到位后启用"},
        "lookback_days": lookback_days,
    }


def detect_conflicts_with_candidates(thesis: str, candidate_titles: List[str],
                                     history: List[Dict],
                                     now: Optional[datetime] = None,
                                     lookback_days: int = DEFAULT_LOOKBACK_DAYS,
                                     audience: str = "",
                                     current_series_id: Optional[str] = None,
                                     **kwargs) -> Dict:
    """含候选标题的版本（棱镜后调用）。current_series_id 同上豁免。"""
    if now is None:
        now = datetime.now()
    recent = filter_recent_history(history, lookback_days, now)

    if current_series_id:
        recent = [h for h in recent if h.get("series_id") != current_series_id]

    # 命题撞车
    thesis_collisions = detect_thesis_collision(thesis, recent,
                                                kwargs.get("thesis_threshold", DEFAULT_THSIS_THRESHOLD))
    # 角度撞车：每个候选标题都查
    angle_collisions = []
    seen = set()
    for cand in candidate_titles:
        for h in recent:
            past_title = h.get("title", "")
            if not past_title:
                continue
            sim = jaccard_similarity(cand, past_title)
            if sim > kwargs.get("angle_threshold", DEFAULT_ANGLE_THRESHOLD):
                key = (cand, past_title)
                if key not in seen:
                    seen.add(key)
                    angle_collisions.append({
                        "candidate": cand,
                        "past_title": past_title,
                        "similarity": sim,
                        "date": h.get("timestamp", ""),
                    })
    angle_collisions.sort(key=lambda x: x["similarity"], reverse=True)

    # 受众疲劳
    audience_fatigue = detect_audience_fatigue(audience, recent,
                                                kwargs.get("audience_warn", DEFAULT_AUDIENCE_WARN),
                                                kwargs.get("audience_high", DEFAULT_AUDIENCE_HIGH))

    return {
        "thesis_collisions": thesis_collisions,
        "angle_collisions": angle_collisions,
        "audience_fatigue": audience_fatigue,
        "data_collisions": {"enabled": False, "note": "v1 暂不支持，v2 等'写完提取证据'机制到位后启用"},
        "lookback_days": lookback_days,
    }


# ============ 报告格式化 ============

def format_report(report: Dict) -> str:
    """格式化冲突检测报告为可读文本"""
    lines = ["\n[冲突检测报告]"]
    has_warnings = False

    # 命题撞车
    tcs = report.get("thesis_collisions", [])
    if tcs:
        has_warnings = True
        lines.append(f"  ⚠ 命题撞车: {len(tcs)} 条")
        for tc in tcs[:3]:  # 最多展示 3 条
            lines.append(f"    - [{tc['similarity']:.2f}] {tc['thesis'][:50]}")
    else:
        lines.append("  ✓ 命题无撞车")

    # 角度撞车
    acs = report.get("angle_collisions", [])
    if acs:
        has_warnings = True
        lines.append(f"  ⚠ 角度撞车: {len(acs)} 条")
        for ac in acs[:3]:
            cand = ac.get("candidate") or ac.get("title", "")
            past = ac.get("past_title") or ac.get("thesis", "")
            lines.append(f"    - [{ac['similarity']:.2f}] 候选「{cand[:20]}」≈「{past[:20]}」")
    else:
        lines.append("  ✓ 角度无撞车")

    # 受众疲劳
    af = report.get("audience_fatigue", {})
    if af.get("level") == "high":
        has_warnings = True
        lines.append(f"  ⚠ 受众高度疲劳: 30 天内 {af['count']} 篇（受众: {af.get('audience', '?')}）")
    elif af.get("level") == "warn":
        has_warnings = True
        lines.append(f"  ⚠ 受众疲劳: 30 天内 {af['count']} 篇（受众: {af.get('audience', '?')}）")
    else:
        lines.append("  ✓ 受众无疲劳")

    # 数据撞车
    dc = report.get("data_collisions", {})
    if not dc.get("enabled", False):
        lines.append(f"  ⊘ 数据撞车: {dc.get('note', 'v1 暂不支持')}")

    if not has_warnings:
        lines.append("\n  ✓ 全部通过，可继续")

    return "\n".join(lines)


# ============ CLI ============

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python conflict_detect.py \"<命题>\"", file=sys.stderr)
        sys.exit(1)

    thesis = sys.argv[1]
    # 简单 demo
    demo_history = [
        {"title": "AI 时代如何转型", "thesis": "AI 时代如何转型",
         "audience": "25-35 职场人", "timestamp": "2026-06-08T10:00:00"},
        {"title": "AI 让程序员失业", "thesis": "AI 时代程序员失业问题",
         "audience": "25-35 职场人", "timestamp": "2026-06-07T10:00:00"},
    ]
    report = detect_conflicts_with_candidates(
        thesis, ["AI 时代如何转型的另一种思路"], demo_history,
        audience="25-35 职场人",
        now=datetime(2026, 6, 10),
    )
    print(format_report(report))

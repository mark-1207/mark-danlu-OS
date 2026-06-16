#!/usr/bin/env python3
"""
PRISM-OS A1 认知张力评分 + A3 风格连贯性 + 统一排序 (M4+M6, v1.1)

score_tension(): 从 LLM 输出 dict 提取 tension_score (1-5)
compute_style_consistency(): 与历史标题的风格一致性 (0-1)
sort_by_score(): A1×0.6 + A3×5×0.4 综合排序
"""
from typing import Dict, List, Optional, Tuple, Union


# v1.1 拍脑袋权重（v2 接入真实数据后调）
# A1 张力（1-5）× 0.6 + A3 风格（0-1）× 5 × 0.4
# → A1 主导：5×0.6=3.0 vs A3×5×0.4=2.0
WEIGHT_A1 = 0.6
WEIGHT_A3 = 0.4
DEFAULT_TENSION = 3
DEFAULT_CONSISTENCY = 0.5


def score_tension(title_or_response: Union[Dict, str, None]) -> float:
    """从 dict 或字符串提取 tension_score，范围 1-5。

    - dict 有 tension_score 字段 → 解析并 clamp 到 1-5
    - dict 无该字段 → 默认 3
    - 非 dict → 默认 3
    """
    if not isinstance(title_or_response, dict):
        return float(DEFAULT_TENSION)

    raw = title_or_response.get("tension_score")
    if raw is None:
        return float(DEFAULT_TENSION)

    try:
        val = float(raw)
    except (TypeError, ValueError):
        return float(DEFAULT_TENSION)

    # clamp 到 1-5
    if val < 1:
        return 1.0
    if val > 5:
        return 5.0
    return val


def compute_sort_score(tension: float, consistency: float) -> float:
    """计算综合排序分。"""
    return tension * WEIGHT_A1 + consistency * 5 * WEIGHT_A3


def sort_by_score(candidates: List[Dict]) -> List[Dict]:
    """按 A1×0.6 + A3×5×0.4 综合分降序排序。不修改原列表。"""
    def _key(c: Dict) -> float:
        tension = score_tension(c)
        consistency = c.get("consistency_score")
        if consistency is None:
            consistency = DEFAULT_CONSISTENCY
        else:
            try:
                consistency = float(consistency)
            except (TypeError, ValueError):
                consistency = DEFAULT_CONSISTENCY
        return compute_sort_score(tension, consistency)

    return sorted(candidates, key=_key, reverse=True)


# ============ A3 风格连贯性 (M6, v1.1) ============

# top_n=20: 中期窗口（约 1-2 个月发文频率）
# 太小（如 5）→ 太局部，受最近 1-2 篇波动
# 太大（如 100）→ 太全局，漂移检测不到
STYLE_TOP_N = 20


def compute_style_consistency(
    title: str,
    history_titles: List[str],
    top_n: int = STYLE_TOP_N,
) -> Tuple[float, str]:
    """
    与最近 top_n 条历史标题的余弦相似度均值。

    v1.1: 从 embedding.py 的缓存拿 embedding，不重算。
    v2: 接飞书互动数据，加权。

    Returns:
        (score, explain) — score ∈ [0, 1]，无历史返回 (0.5, "...")
    """
    if not history_titles:
        return 0.5, "无历史数据，给中性分"

    from embedding import embed, cosine_similarity

    recent = history_titles[-top_n:]
    title_vec = embed(title)
    if title_vec is None:
        return 0.5, "embedding 失败"

    sims = []
    for ht in recent:
        hv = embed(ht)
        if hv is not None:
            sims.append(cosine_similarity(title_vec, hv))

    if not sims:
        return 0.5, "历史 embedding 全部失败"

    avg_sim = sum(sims) / len(sims)
    if avg_sim >= 0.75:
        explain = f"风格高度一致（均相似度 {avg_sim:.2f}）"
    elif avg_sim >= 0.5:
        explain = f"风格部分一致（均相似度 {avg_sim:.2f}）"
    else:
        explain = f"风格较新（均相似度 {avg_sim:.2f}，可能开拓新方向）"

    return avg_sim, explain

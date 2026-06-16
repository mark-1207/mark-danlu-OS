#!/usr/bin/env python3
"""
PRISM-OS 系列模式模块 (M3b, v1.1)

基于已选锚点标题，规划 3 篇系列文章。
- 5 维 LLM 适配性分析（含 time_sensitivity / depth_potential 硬规则覆盖）
- 复用 title_deep.generate_titles_with_retry 生成 3 个后续标题
- positioning 标注 (deepen / expand / contrarian) — 不假装 embedding 距离
- series_id 含 nanoid（防同日同命题冲突）
"""
import json
import re
import secrets
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


# 复用 title_deep 的 banned_words / JSON 解析
sys.path.insert(0, str(Path(__file__).resolve().parent))


# ============ Positioning（不假装算 embedding 距离）============

POSITIONINGS = ("deepen", "expand", "contrarian")
MIN_TENSION = 3  # 张力过滤阈值


# ============ Suitability LLM Prompt ============

SERIES_SUITABILITY_PROMPT = """分析以下命题是否适合做系列文章。

# 5 个评估维度（1-5 分）
1. depth_potential: 话题深度（能否撑 3+ 篇不同角度的文章）
2. topic_type_fit: 类型适配（方法/观点/系统类适合；新闻/快讯不适合）
3. time_sensitivity: 时效性（5=极强时效，1=无时效）
4. persona_alignment: 与人设 topic_domains 的契合度
5. audience_breadth: 受众广度（5=不同人，1=同一群人）

# 输出（必须严格 JSON）
{{
  "suitable": true/false,
  "confidence": 0.0-1.0,
  "primary_reason": "一句话原因（用户能看到）",
  "suggested_length": 3,
  "suggested_positioning": "deepen" | "expand" | "contrarian",
  "dimension_scores": {{"depth_potential": 4, "topic_type_fit": 4, "time_sensitivity": 1, "persona_alignment": 4, "audience_breadth": 3}}
}}

# 判定逻辑（硬规则）
- time_sensitivity >= 4 → suitable=false
- depth_potential <= 2 → suitable=false
- 否则：suitable=(depth_potential >= 3 AND topic_type_fit >= 3 AND persona_alignment >= 3)

# 用户人设 topic_domains
{topic_domains}

# 命题
{thesis}
"""


# ============ JSON 解析（复用 title_deep 模式）============

def _extract_json(text: str) -> Optional[str]:
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    start_obj = text.find("{")
    start_arr = text.find("[")
    if start_obj == -1 and start_arr == -1:
        return None
    if start_obj == -1:
        start = start_arr
    elif start_arr == -1:
        start = start_obj
    else:
        start = min(start_obj, start_arr)
    end_obj = text.rfind("}")
    end_arr = text.rfind("]")
    end = max(end_obj, end_arr)
    if end <= start:
        return None
    return text[start:end + 1]


def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM 拿原始输出（隔离便于 mock）"""
    try:
        from call_llm import call_llm_raw
        return call_llm_raw(prompt, temperature=0.5, scene="writing-cn",
                            error_prefix="[series LLM]")
    except Exception as e:
        print(f"[series] LLM 调用失败: {e}", file=sys.stderr)
        return None


# ============ 适配性分析 ============

def _apply_hard_rules(parsed: Dict) -> Dict:
    """硬规则覆盖 LLM 输出。time_sens>=4 或 depth<=2 强制 unsuitable。"""
    scores = parsed.get("dimension_scores", {}) or {}
    time_sens = scores.get("time_sensitivity", 0)
    depth = scores.get("depth_potential", 0)
    type_fit = scores.get("topic_type_fit", 0)
    persona_align = scores.get("persona_alignment", 0)

    forced = False
    if time_sens >= 4:
        parsed["suitable"] = False
        parsed["primary_reason"] = "时效性话题，系列展开空间有限"
        parsed["forced_reason"] = "time_sensitivity>=4"
        forced = True
    elif depth <= 2:
        parsed["suitable"] = False
        parsed["primary_reason"] = "命题深度不足，难撑 3+ 篇"
        parsed["forced_reason"] = "depth_potential<=2"
        forced = True

    if not forced:
        parsed["suitable"] = bool(
            depth >= 3 and type_fit >= 3 and persona_align >= 3
        )
    return parsed


def analyze_suitability(thesis: str, persona: Dict) -> Dict:
    """
    5 维适配性分析。失败返回 unsuitable + 原因。

    Returns:
        {
            "suitable": bool,
            "confidence": float,
            "primary_reason": str,
            "suggested_length": int,
            "suggested_positioning": str,
            "dimension_scores": Dict,
        }
    """
    if not thesis or not thesis.strip():
        return {
            "suitable": False, "confidence": 0.0,
            "primary_reason": "空命题",
            "suggested_length": 0, "suggested_positioning": "deepen",
            "dimension_scores": {},
        }

    topic_domains = "、".join(persona.get("topic_domains", []) or [])
    prompt = SERIES_SUITABILITY_PROMPT.format(
        thesis=thesis[:200],
        topic_domains=topic_domains or "（未设置）",
    )

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "suitable": False, "confidence": 0.0,
            "primary_reason": "适配性分析 LLM 调用失败",
            "suggested_length": 0, "suggested_positioning": "deepen",
            "dimension_scores": {},
        }

    json_str = _extract_json(result)
    if not json_str:
        return {
            "suitable": False, "confidence": 0.0,
            "primary_reason": "LLM 返回格式异常",
            "suggested_length": 0, "suggested_positioning": "deepen",
            "dimension_scores": {},
        }

    try:
        parsed = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        return {
            "suitable": False, "confidence": 0.0,
            "primary_reason": "LLM JSON 解析失败",
            "suggested_length": 0, "suggested_positioning": "deepen",
            "dimension_scores": {},
        }

    if not isinstance(parsed, dict):
        return {
            "suitable": False, "confidence": 0.0,
            "primary_reason": "LLM 返回非 mapping",
            "suggested_length": 0, "suggested_positioning": "deepen",
            "dimension_scores": {},
        }

    return _apply_hard_rules(parsed)


# ============ 系列标题生成（复用 title_deep）============

def _reuse_title_deep_gen(thesis: str, depth, avoid_keywords: List[str],
                          count: int) -> List[Dict]:
    """
    薄包装：复用 title_deep.generate_titles_with_retry。
    隔离便于测试 mock。
    """
    from title_deep import generate_titles_with_retry, DepthAnalysis
    if depth is None:
        depth = DepthAnalysis()  # 空 depth, prompt 仍能跑
    return generate_titles_with_retry(
        thesis=thesis,
        depth=depth,
        avoid_keywords=avoid_keywords,
        count=count,
    )


def _filter_low_tension(titles: List[Dict], min_score: int = MIN_TENSION) -> List[Dict]:
    """剔除张力 < min_score 的标题"""
    out = []
    for t in titles:
        score = t.get("tension_score", 0)
        try:
            score = float(score)
        except (TypeError, ValueError):
            score = 0
        if score >= min_score:
            out.append(t)
    return out


def _assign_positioning(titles: List[Dict]) -> List[Dict]:
    """前 3 个分别打 deepen / expand / contrarian 标签"""
    for i, t in enumerate(titles):
        if i < len(POSITIONINGS):
            t["positioning"] = POSITIONINGS[i]
    return titles


def generate_series_titles(anchor_title: str, anchor_thesis: str,
                          anchor_depth: Optional[Dict],
                          persona: Dict, count: int = 3,
                          max_retries: int = 1) -> List[Dict]:
    """
    基于锚点生成 count 个后续标题。
    张力过滤 + positioning 标注 + 重试。
    """
    avoid_keywords = persona.get("avoid_keywords", []) or []

    # 首次生成 + 张力过滤
    titles = _reuse_title_deep_gen(anchor_thesis, anchor_depth,
                                   avoid_keywords, count=count)
    filtered = _filter_low_tension(titles)

    # 张力过滤后不足则重试
    for _ in range(max_retries):
        if len(filtered) >= count:
            break
        titles = _reuse_title_deep_gen(anchor_thesis, anchor_depth,
                                       avoid_keywords, count=count)
        filtered = _filter_low_tension(titles)

    final = filtered[:count]
    return _assign_positioning(final)


# ============ Series ID（防同日同命题冲突）============

_SLUG_PATTERN = re.compile(r"[^a-zA-Z0-9_]")


def _slugify(thesis: str, max_len: int = 20) -> str:
    """命题转 slug（保留拉丁字符/数字，其余转 _）"""
    clean = _SLUG_PATTERN.sub("_", thesis.strip())
    clean = re.sub(r"_+", "_", clean).strip("_")
    return clean[:max_len] if clean else "untitled"


def make_series_id(thesis: str) -> str:
    """series_id 格式: series-YYYYMMDD-<slug>-<6 字符 nanoid>"""
    date = datetime.now().strftime("%Y%m%d")
    slug = _slugify(thesis)
    nanoid = secrets.token_hex(3)  # 6 字符 hex
    return f"series-{date}-{slug}-{nanoid}"


# ============ 命令解析（在系列模式内）============

def handle_series_command(user_input: str, state: Dict) -> Dict:
    """
    解析用户在系列模式下的输入。
    state: {"series_id": str, "titles": [...]}

    Returns:
        {"action": "select"|"regenerate"|"save_all"|"skip"|"error", ...}
    """
    cmd = (user_input or "").strip().lower()

    if cmd in ("q", "quit", "exit"):
        return {"action": "skip"}  # q = 跳过系列，只用锚点
    if cmd == "s":
        return {"action": "save_all"}
    if cmd == "m":
        return {"action": "regenerate"}
    if cmd == "b":
        return {"action": "back"}

    # 数字选择 1-N
    try:
        idx = int(cmd) - 1
        titles = state.get("titles", [])
        if 0 <= idx < len(titles):
            return {"action": "select", "index": idx}
        return {"action": "error", "message": f"编号 {cmd} 超出范围"}
    except ValueError:
        pass

    if cmd == "":
        return {"action": "error", "message": "空输入"}
    return {"action": "error", "message": f"未知命令: {user_input!r}"}


# ============ CLI（调试用）============

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python series.py suitability|generate \"<命题>\" [\"<锚点>\"]",
              file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    thesis = sys.argv[2] if len(sys.argv) > 2 else ""

    if cmd == "suitability":
        from persona import load as load_persona
        try:
            persona = load_persona("default")
        except Exception:
            persona = {}
        result = analyze_suitability(thesis, persona)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif cmd == "generate":
        anchor = sys.argv[3] if len(sys.argv) > 3 else thesis
        from persona import load as load_persona
        try:
            persona = load_persona("default")
        except Exception:
            persona = {}
        titles = generate_series_titles(anchor, thesis, None, persona, count=3)
        for i, t in enumerate(titles, 1):
            print(f"{i}. {t['title']}  [{t.get('positioning','?')}, tension={t.get('tension_score','?')}]")
    elif cmd == "id":
        print(make_series_id(thesis))
    else:
        print(f"未知命令: {cmd}", file=sys.stderr)
        sys.exit(1)

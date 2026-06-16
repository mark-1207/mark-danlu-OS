#!/usr/bin/env python3
"""
PRISM-OS 标题深度模块

对命题做 9 维深度拆解 + 基于拆解生成 5 个真正够锐的候选标题。
替代原"标题精修"（旧版只做风格变换，错了）。
"""
import sys
import re
import json
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict


# 8 个标准化子角度
VALID_BASED_ON = (
    "core_claim_challenge",
    "hidden_assumption_reveal",
    "contrarian_inversion",
    "audience_specific",
    "scenario_specific",
    "pain_anchor",
    "value_promise",
    "unanswered_question",
)


def _banned_words_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "banned_words.yaml"


def _load_banned_words() -> List[str]:
    """从 banned_words.yaml 加载禁用词列表（平铺）"""
    path = _banned_words_path()
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        words = []
        for cat in data.values():
            if isinstance(cat, list):
                words.extend(cat)
        return words
    except Exception:
        return []


BANNED_WORDS = _load_banned_words()


# ============ 9 维深度拆解的数据结构 ============

@dataclass
class DepthAnalysis:
    """9 维深度拆解。"""
    core_claim: str = ""                            # 1 句核心主张
    hidden_assumptions: List[str] = field(default_factory=list)   # 1-3 个隐含假设
    mainstream_narrative: str = ""                  # 1 句主流叙事
    contrarian_takes: List[str] = field(default_factory=list)     # 3-5 个反主流
    hidden_audience: str = ""                       # 比"职场人"更具体
    scenarios: List[str] = field(default_factory=list)           # 3-5 个场景切片
    pain_points: List[str] = field(default_factory=list)         # 1-3 个痛点
    value_anchors: List[str] = field(default_factory=list)       # 2-4 个价值锚点
    unanswered_questions: List[str] = field(default_factory=list) # 3-5 个未答问题

    def validate(self) -> List[str]:
        """返回所有违规项。空列表 = 通过。"""
        issues = []
        if not self.core_claim or len(self.core_claim) > 100:
            issues.append("core_claim 长度异常（应 1-100 字）")
        if not (1 <= len(self.hidden_assumptions) <= 3):
            issues.append("hidden_assumptions 应为 1-3 个")
        if not (3 <= len(self.contrarian_takes) <= 5):
            issues.append("contrarian_takes 应为 3-5 个")
        if not (3 <= len(self.scenarios) <= 5):
            issues.append("scenarios 应为 3-5 个")
        if not (1 <= len(self.pain_points) <= 3):
            issues.append("pain_points 应为 1-3 个")
        if not (2 <= len(self.value_anchors) <= 4):
            issues.append("value_anchors 应为 2-4 个")
        if not (3 <= len(self.unanswered_questions) <= 5):
            issues.append("unanswered_questions 应为 3-5 个")
        vague = ("职场人", "年轻人", "所有人", "大家", "人们")
        if self.hidden_audience in vague or len(self.hidden_audience) < 4:
            issues.append("hidden_audience 不够具体")
        return issues

    def to_dict(self) -> Dict:
        return {
            "core_claim": self.core_claim,
            "hidden_assumptions": list(self.hidden_assumptions),
            "mainstream_narrative": self.mainstream_narrative,
            "contrarian_takes": list(self.contrarian_takes),
            "hidden_audience": self.hidden_audience,
            "scenarios": list(self.scenarios),
            "pain_points": list(self.pain_points),
            "value_anchors": list(self.value_anchors),
            "unanswered_questions": list(self.unanswered_questions),
        }


# ============ LLM Prompt 常量 ============

DEPTH_ANALYSIS_PROMPT = """你是内容策略师，擅长认知拆解。

# 任务
对用户命题做 9 维深度拆解，输出 JSON。

# 9 维定义（严格按此输出）
- core_claim: 这个命题的**字面主张**是什么？（1 句话）
- hidden_assumptions: 这个主张**隐含**了哪些未被质疑的前提？（1-3 个）
- mainstream_narrative: 当前**主流叙事**是什么？（1 句话）
- contrarian_takes: **反主流**的可能方向有哪些？（3-5 个，每个 1 句）
- hidden_audience: 真正会被打动的**具体人群**是谁？（比"职场人"更具体）
- scenarios: **具体场景切片**有哪些？（3-5 个，每个 1 句话描述画面）
- pain_points: 读者最痛的 1-3 个**痛点**是什么？
- value_anchors: 涉及哪些**价值锚点**？（从 {安全感, 收入, 意义感, 自由度, 地位, 关系, 健康, 时间} 中选 2-4 个）
- unanswered_questions: 这个命题**没回答**但读者关心的问题有哪些？（3-5 个）

# 输出（必须严格 JSON，不要其他文字）
{{
  "core_claim": "...",
  "hidden_assumptions": ["...", "..."],
  "mainstream_narrative": "...",
  "contrarian_takes": ["...", "...", "..."],
  "hidden_audience": "35+ 中层程序员",
  "scenarios": ["...", "...", "..."],
  "pain_points": ["...", "..."],
  "value_anchors": ["...", "..."],
  "unanswered_questions": ["...", "...", "..."]
}}

# 用户命题
{thesis}
"""

DEEP_TITLE_GEN_PROMPT = """你是爆款标题策划师。基于给定的"命题深度拆解"，生成 {count} 个真正够锐的候选标题。

# 关键约束
1. **每个标题必须基于不同的子角度**（从 8 个标准角度中选，每个标题角度不能重复）
   标准角度: core_claim_challenge, hidden_assumption_reveal, contrarian_inversion, audience_specific, scenario_specific, pain_anchor, value_promise, unanswered_question
2. **每个标题要标注 based_on**（基于哪个子角度）
3. **每个标题要写 why**（1 句话：为什么这个角度能打动人）
4. **基于具体场景的标题必须有具体锚点**（年龄/职业/数字/具体画面）
5. **避免：震惊体、绝对化、空泛主语**

# 输出（必须严格 JSON）
[
  {{
    "title": "标题文本",
    "based_on": "8 个标准角度之一",
    "why": "为什么这个角度有效",
    "tension_score": 4
  }},
  ...（共 {count} 个，based_on 各不相同）
]

# A1 认知张力自评（每个标题打 1-5 分）
- 5: 强烈对立，挑战主流共识
- 4: 明确反方/新视角
- 3: 一定观点倾向
- 2: 接近通用建议
- 1: 完全信息陈述

# 深度拆解结果
{depth_json}

# 用户命题
{thesis}
"""


# ============ JSON 解析 ============

def _extract_json(text: str) -> Optional[str]:
    """从 LLM 输出提取 JSON 字符串（处理 ```json ... ``` 包裹）"""
    if not text:
        return None
    # 1) 尝试 ```json ... ``` 代码块
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    # 2) 尝试找最外层 { ... } 或 [ ... ]
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


def parse_deep_analysis(llm_output: Optional[str]) -> Optional[DepthAnalysis]:
    """从 LLM 输出 JSON 解析为 DepthAnalysis。失败返回 None。"""
    json_str = _extract_json(llm_output)
    if not json_str:
        return None
    try:
        data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    # 必需字段检查
    required = ("core_claim", "hidden_assumptions", "mainstream_narrative",
                "contrarian_takes", "hidden_audience", "scenarios",
                "pain_points", "value_anchors", "unanswered_questions")
    if not all(k in data for k in required):
        return None
    try:
        return DepthAnalysis(
            core_claim=str(data.get("core_claim", "")),
            hidden_assumptions=[str(x) for x in data.get("hidden_assumptions", [])],
            mainstream_narrative=str(data.get("mainstream_narrative", "")),
            contrarian_takes=[str(x) for x in data.get("contrarian_takes", [])],
            hidden_audience=str(data.get("hidden_audience", "")),
            scenarios=[str(x) for x in data.get("scenarios", [])],
            pain_points=[str(x) for x in data.get("pain_points", [])],
            value_anchors=[str(x) for x in data.get("value_anchors", [])],
            unanswered_questions=[str(x) for x in data.get("unanswered_questions", [])],
        )
    except Exception:
        return None


def parse_deep_titles(llm_output: Optional[str]) -> List[Dict]:
    """从 LLM 输出 JSON 解析标题列表。失败返回 []。"""
    json_str = _extract_json(llm_output)
    if not json_str:
        return []
    try:
        data = json.loads(json_str)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    result = []
    for item in data:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        based_on = str(item.get("based_on", "")).strip()
        why = str(item.get("why", "")).strip()
        if not title:
            continue
        # 过滤 invalid based_on
        if based_on not in VALID_BASED_ON:
            based_on = ""
        # A1 tension_score（1-5，缺失默认 3）
        raw_ts = item.get("tension_score")
        try:
            tension_score = max(1, min(5, int(float(raw_ts)))) if raw_ts is not None else 3
        except (TypeError, ValueError):
            tension_score = 3
        result.append({"title": title, "based_on": based_on, "why": why, "tension_score": tension_score})
    return result


# ============ 标题过滤 ============

def score_length(title: str) -> int:
    """返回标题字符数"""
    return len(title)


def _has_any(text: str, keywords: List[str]) -> bool:
    """text 是否含 keywords 任一"""
    return any(kw in text for kw in keywords if kw)


def filter_titles(titles: List[Dict], banned_words: List[str],
                  avoid_keywords: List[str]) -> List[Dict]:
    """按长度 18-28 + banned_words + avoid_keywords + based_on 去重 过滤"""
    result = []
    seen_based_on = set()
    for t in titles:
        title = t.get("title", "")
        based_on = t.get("based_on", "")
        # 长度
        n = score_length(title)
        if n < 18 or n > 28:
            continue
        # 禁用词
        if _has_any(title, banned_words):
            continue
        # 人设 avoid
        if _has_any(title, avoid_keywords):
            continue
        # based_on 去重（保留首次）
        if based_on and based_on in seen_based_on:
            continue
        if based_on:
            seen_based_on.add(based_on)
        result.append(t)
    return result


# ============ LLM 调用 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM 拿原始输出。"""
    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from call_llm import call_llm_raw
        return call_llm_raw(prompt, temperature=0.7, scene="writing-cn",
                            error_prefix="[title_deep LLM]")
    except Exception as e:
        print(f"[title_deep] LLM 调用失败: {e}", file=sys.stderr)
        return None


def deep_analyze(thesis: str) -> Optional[DepthAnalysis]:
    """对命题做 9 维深度拆解。失败返回 None。"""
    if not thesis or not thesis.strip():
        return None
    if len(thesis) > 200:
        thesis = thesis[:200]
    prompt = DEPTH_ANALYSIS_PROMPT.format(thesis=thesis)
    result = _call_llm_raw(prompt)
    if not result:
        return None
    depth = parse_deep_analysis(result)
    if depth is None:
        return None
    issues = depth.validate()
    if issues:
        # 重试 1 次
        result2 = _call_llm_raw(prompt)
        if result2:
            depth2 = parse_deep_analysis(result2)
            if depth2 and not depth2.validate():
                return depth2
        return None  # 重试也失败
    return depth


def generate_deep_titles(thesis: str, depth: DepthAnalysis,
                         count: int = 5) -> List[Dict]:
    """基于拆解生成 count 个标题。失败返回 []。"""
    if not thesis:
        return []
    depth_json = json.dumps(depth.to_dict(), ensure_ascii=False, indent=2)
    prompt = DEEP_TITLE_GEN_PROMPT.format(
        count=count, depth_json=depth_json, thesis=thesis
    )
    result = _call_llm_raw(prompt)
    if not result:
        return []
    return parse_deep_titles(result)


def generate_titles_with_retry(thesis: str, depth: DepthAnalysis,
                               avoid_keywords: List[str],
                               count: int = 5,
                               max_retries: int = 1) -> List[Dict]:
    """生成 + 过滤 + 重试。返回过滤后的标题。"""
    titles = generate_deep_titles(thesis, depth, count=count)
    filtered = filter_titles(titles, BANNED_WORDS, avoid_keywords)
    if len(filtered) >= 3:
        return filtered[:count]
    # 重试
    for _ in range(max_retries):
        titles = generate_deep_titles(thesis, depth, count=count)
        filtered = filter_titles(titles, BANNED_WORDS, avoid_keywords)
        if len(filtered) >= 3:
            return filtered[:count]
    return filtered  # 仍失败，返回现有（可能 < 3）


# ============ 用户命令处理 ============

def handle_deep_command(user_input: str, state: Dict) -> Dict:
    """
    解析用户在深度模式下的输入。
    state: {"depth": ..., "titles": [...], "selected": None|int, "regen_count": int}
    返回: {"action": str, ...}
      action in: "select", "regenerate", "back_to_broad", "show_why", "exit", "error"
    """
    cmd = (user_input or "").strip().lower()

    if cmd in ("q", "quit", "exit"):
        return {"action": "exit"}
    if cmd == "b":
        return {"action": "back_to_broad"}
    if cmd == "m":
        return {"action": "regenerate"}
    if cmd.startswith("w "):
        rest = cmd[2:].strip()
        try:
            idx = int(rest) - 1
            if 0 <= idx < len(state.get("titles", [])):
                return {"action": "show_why", "index": idx}
            return {"action": "error", "message": f"编号 {rest} 超出范围"}
        except ValueError:
            return {"action": "error", "message": "格式: w N（N 是 1-5 的整数）"}
    # 数字选择
    try:
        idx = int(cmd) - 1
        if 0 <= idx < len(state.get("titles", [])):
            return {"action": "select", "index": idx}
        return {"action": "error", "message": f"编号 {cmd} 超出范围"}
    except ValueError:
        pass

    if cmd == "":
        return {"action": "error", "message": "空输入"}

    return {"action": "error", "message": f"未知命令: {user_input!r}"}


# ============ CLI（调试用） ============

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python title_deep.py analyze|generate \"<命题>\"", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    thesis = sys.argv[2] if len(sys.argv) > 2 else ""

    if cmd == "analyze":
        d = deep_analyze(thesis)
        if d:
            print(json.dumps(d.to_dict(), ensure_ascii=False, indent=2))
        else:
            print("[Error] 拆解失败", file=sys.stderr)
            sys.exit(1)
    elif cmd == "generate":
        d = deep_analyze(thesis)
        if not d:
            print("[Error] 拆解失败", file=sys.stderr)
            sys.exit(1)
        titles = generate_titles_with_retry(thesis, d, avoid_keywords=[])
        for i, t in enumerate(titles, 1):
            print(f"{i}. {t['title']}  [based_on={t.get('based_on','')}]")
    else:
        print(f"未知命令: {cmd}", file=sys.stderr)
        sys.exit(1)

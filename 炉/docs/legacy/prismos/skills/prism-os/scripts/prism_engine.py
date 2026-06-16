#!/usr/bin/env python3
"""
PRISM-OS Phase 2: 棱镜引擎（Prism Engine）
四维标题生成脚本

用法:
    python prism_engine.py generate "<命题>"
    python prism_engine.py validate "<命题>"
"""

import sys
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

_SCRIPT_DIR = Path(__file__).resolve().parent
_BANNED_WORDS_YAML_PATH = _SCRIPT_DIR.parent / "data" / "banned_words.yaml"

# ============ Phase 2: 四维标题生成 ============

DIMENSIONS = {
    "reversal": {
        "name": "逆向拆解",
        "description": "颠覆常识，揭示反直觉真相",
        "formula": "为什么'常识A'其实是'真相B'？"
    },
    "benefit_anchor": {
        "name": "利益锚点",
        "description": "绑住用户的钱/前途/认知/效率",
        "formula": "为什么'做X'能让用户'得到Y'？"
    },
    "micro_scene": {
        "name": "微观切片",
        "description": "聚焦具体场景或人群",
        "formula": "在'场景X'中，'现象Y'如何发生？"
    },
    "contrarian": {
        "name": "反向论证",
        "description": "反对主流共识，揭示反方证据",
        "formula": "大家都说'A是真的'，但'B'才是真相"
    }
}

# 旧 4 维（保留为 --preset-flavor legacy 选项）
LEGACY_DIMENSIONS = {
    "reversal": {
        "name": "逆向拆解",
        "description": "颠覆常识，揭示反直觉真相",
        "formula": "为什么'常识A'其实是'真相B'？"
    },
    "micro_scene": {
        "name": "微观切片",
        "description": "聚焦具体场景或人群",
        "formula": "在'场景X'中，'现象Y'如何发生？"
    },
    "systemic_flaw": {
        "name": "系统归因",
        "description": "指向结构性问题",
        "formula": "'现象X'的根源是'系统缺陷Y'。"
    },
    "bridge": {
        "name": "认知脚手架",
        "description": "提供方法论或工具",
        "formula": "如何用'方法X'解决'问题Y'？"
    }
}

# ============ 读者标题原型（Phase 2 v2.0）============

TITLE_ARCHETYPES = {
    "opinion_assertion": {
        "name": "观点断言型",
        "description": "一个明确判断句，不解释、不铺垫，直接亮态度",
        "formula": "核心观点+具体对象+反常识标签",
        "reader_trigger": "立场/态度 - 这人敢这么说?"
    },
    "identity_label": {
        "name": "身份标签型",
        "description": "把读者划入一个身份，让ta觉得这说的就是我",
        "formula": "身份标签+共同困境/特征+悬念",
        "reader_trigger": "代入/归属 - XX的人，都..."
    },
    "scene_suspense": {
        "name": "场景悬念型",
        "description": "用具体场景开头，悬念不解释，逼读者点进来找答案",
        "formula": "具体场景+反预期结果+不说为什么",
        "reader_trigger": "好奇/画面 - 发生了什么?"
    },
    "data_counter_ask": {
        "name": "数据反问型",
        "description": "用具体数字制造冲击，再用反问让读者自己站队",
        "formula": "数据+对立面+反问",
        "reader_trigger": "冲击/反思 - 这个数字意味着什么?"
    },
    "story_hook": {
        "name": "故事钩子型",
        "description": "用第一人称真实经历开头，故事未讲完就截断",
        "formula": "我/他+做了X+发现Y+没说结论",
        "reader_trigger": "共情/代入 - 后来呢?"
    }
}

# 认知维度 → 标题原型推荐映射（PRD 4 维）
DIMENSION_TO_ARCHETYPE = {
    "reversal": ["opinion_assertion", "data_counter_ask"],
    "benefit_anchor": ["identity_label", "opinion_assertion"],
    "micro_scene": ["scene_suspense", "story_hook"],
    "contrarian": ["opinion_assertion", "data_counter_ask"],
}

def _load_banned_words_yaml() -> Dict:
    """加载 banned_words.yaml，按 6 类别分组。文件缺失或解析失败时返回空 dict。"""
    if not _BANNED_WORDS_YAML_PATH.exists():
        return {}
    try:
        with open(_BANNED_WORDS_YAML_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return data if isinstance(data, dict) else {}
    except (yaml.YAMLError, OSError) as e:
        print(f"[Warning] banned_words.yaml 解析失败: {e}", file=sys.stderr)
        return {}


def _build_banned_words() -> List[str]:
    """按类别顺序把 yaml 里的词平铺为单一列表（去重）。"""
    data = _load_banned_words_yaml()
    seen: set = set()
    flat: List[str] = []
    for category_words in data.values():
        if not isinstance(category_words, list):
            continue
        for w in category_words:
            if isinstance(w, str) and w and w not in seen:
                seen.add(w)
                flat.append(w)
    return flat


BANNED_WORDS = _build_banned_words()


# ============ A2: 反面示例库（4 → 24 条）============
# 用于 prompt 中让 LLM 看到"绝对不能这么写"的典型反例
# 分类覆盖：说教式 / AI 腔问句 / 揭秘真相党 / 数字诱饵 / 空洞陈述 / 小红书钩子 / 情绪堆砌 / 伪深度

NEGATIVE_TITLE_EXAMPLES = [
    # 说教式（3）
    ("AI时代，你必须知道的5个职场真相", "说教+套路"),
    ("职场人必看的AI使用指南", "说教+模板"),
    ("AI不会淘汰你，但会淘汰不会用AI的人", "二元对立说教"),
    # AI 腔问句（3）
    ("为什么学AI的人都赚不到钱？", "AI腔问句"),
    ("AI时代的核心竞争力到底是什么？", "宏大空问"),
    ("深度思考：AI将如何改变未来？", "空泛宏大"),
    # 揭秘/真相党（3）
    ("揭秘！AI裁员背后的惊人真相", "AI腔+禁用词"),
    ("AI的真相，90%的人都不知道", "揭秘+数字诱饵"),
    ("原来，AI一直在这样改变职场", "AI 套路句式"),
    # 数字诱饵（3）
    ("99%的职场人都在用AI做这件事", "数字诱饵+悬念"),
    ("聪明人都在用的3个AI技巧", "人群标签+技巧党"),
    ("月入过万的人，都在偷偷学AI", "夸张收益"),
    # 空洞陈述（3）
    ("AI时代下，裁员已成必然趋势", "空洞陈述"),
    ("AI正在深刻改变我们的工作方式", "官方腔"),
    ("未来已来，AI将颠覆所有行业", "陈词滥调"),
    # 小红书钩子（3）
    ("建议收藏｜AI小白保姆级入门指南", "信息流党"),
    ("手把手教你用AI，副业月入过万", "保姆级+夸张收益"),
    ("0基础也能学会的AI干货，码住！", "钩子堆砌"),
    # 情绪堆砌（3）
    ("看完真的破防了！AI的真相太震撼", "情绪+揭秘"),
    ("哭死！原来AI已经这样了", "情绪+套路"),
    ("炸裂！AI时代最让人震惊的事实", "情绪+震惊体"),
    # 伪深度（3）
    ("穿透AI本质：底层逻辑深度解读", "伪深度"),
    ("思维模型：AI时代必学的认知升级", "伪深度+认知党"),
    ("深度好文：AI时代的认知革命", "伪深度+陈词"),
]


# ============ A3: 正面示例库（3 → 18 条）============
# 用于 prompt 中让 LLM 学习"应该这么写"的口语化、有场景、人称清晰的标题
# 分类覆盖：第一人称场景 / 观点断言 / 身份标签 / 场景悬念 / 数据反问 / 故事钩子

POSITIVE_TITLE_EXAMPLES = [
    # 第一人称 + 场景（4）— 3 原始 + 1 新
    ("我被AI替代的那天，才明白一个道理", "第一人称+场景+悬念"),
    ("同事被裁后，我偷偷学了3个月AI", "具体场景+人称+行动"),
    ("35岁，我决定不再假装不懂AI", "年龄标签+情绪+决定"),
    ("我用AI写完周报第二天，就被领导看穿了", "具体场景+反差+行动"),
    # 观点断言（3）
    ("学AI最快的方式，是先别急着去学AI本身", "反常识+断言"),
    ("AI不会让你失业，但会让你降薪到哭", "观点+情绪+反预期"),
    ("我见过最努力的AI学习者，最后都没赢", "第一人称+反直觉"),
    # 身份标签（3）
    ("35岁还在写代码的人，现在都怎么样了", "年龄标签+悬念"),
    ("被AI替掉的那批人，有个共同点", "身份群像+共性+悬念"),
    ("真正用AI赚到钱的人，从不公开讨论AI", "人群+反差+观点"),
    # 场景悬念（3）
    ("凌晨3点，ChatGPT 给我回了一段话", "时间+反预期+悬念"),
    ("公司开了个AI分享会，全场只来了2个人", "具体场景+反差+悬念"),
    ("我用AI帮同事写简历，结果她被辞了", "第一人称+行动+反预期"),
    # 数据反问（2）
    ("100个用AI的同事，97个在假装用", "数据+反问+洞察"),
    ("AI让效率提升10倍，为什么公司反而开始裁员", "数据+反问+洞察"),
    # 故事钩子（3）
    ("他用AI写了封辞职信，老板看完回了一句话", "他+行动+反预期"),
    ("她辞掉月薪3万的工作去学AI，3个月后老板找上门", "她+决策+反预期"),
    ("我帮老板用AI写PPT，他看完就让我走人", "第一人称+行动+反预期"),
]


def _estimate_dimension_scores(thesis: str) -> Dict[str, float]:
    """
    基于命题文本特征估算4维认知得分（规则版，不调用LLM）

    Returns:
        {"reversal": float, "micro_scene": float, "systemic_flaw": float, "bridge": float}
    """
    scores = {"reversal": 0.3, "micro_scene": 0.3, "systemic_flaw": 0.3, "bridge": 0.3}

    # reversal: 反常识/逆向关键词
    reversal_kw = ["其实", "却", "反直觉", "真相", "误区", "不是", "错了", "你以为", "颠覆"]
    scores["reversal"] = min(0.3 + sum(1 for kw in reversal_kw if kw in thesis) * 0.15, 1.0)

    # micro_scene: 具体场景/人称
    scene_kw = ["在", "当", "一个", "我", "你", "他/她", "公司", "团队", "一个人", "身边", "每天"]
    scores["micro_scene"] = min(0.3 + sum(1 for kw in scene_kw if kw in thesis) * 0.12, 1.0)

    # systemic_flaw: 结构性问题/系统归因
    flaw_kw = ["系统", "结构", "根源", "制度", "机制", "循环", "体系", "底层", "资本", "社会"]
    scores["systemic_flaw"] = min(0.3 + sum(1 for kw in flaw_kw if kw in thesis) * 0.18, 1.0)

    # bridge: 方法/工具/框架
    bridge_kw = ["如何", "怎么", "方法", "模型", "框架", "步骤", "技巧", "策略", "方案", "工具"]
    scores["bridge"] = min(0.3 + sum(1 for kw in bridge_kw if kw in thesis) * 0.15, 1.0)

    return scores


def check_banned_words(title: str) -> Tuple[bool, List[str]]:
    """检查标题是否包含禁用词"""
    found = []
    for word in BANNED_WORDS:
        if word in title:
            found.append(word)
    return len(found) > 0, found


def check_title_semantics(title: str) -> Tuple[bool, List[str]]:
    """
    语义级标题验证（超越禁用词匹配）

    检测范围：
    1. 问号感叹号堆砌（中英文 ≥ 2 个）
    2. 省略号悬念（中英文 .../……）
    3. 极端长度（< 10 字 或 > 35 字）
    4. 数字+个模板（"5个XX" 党）
    5. 模板式开头（"原来"/"揭秘"/"一文看懂" 等）
    6. 空泛主语（"人们"/"大家"/"所有人" 等）

    Returns:
        (ok, issues) — ok=True 表示无问题；issues 是问题描述列表
    """
    if not title or not title.strip():
        return False, ["空标题"]

    issues: List[str] = []

    # 1. 问号 / 感叹号 堆砌（中英文合并计算，≥ 2 视为堆砌）
    q_count = title.count("？") + title.count("?")
    if q_count >= 2:
        issues.append(f"问号堆砌（{q_count} 个）")
    e_count = title.count("！") + title.count("!")
    if e_count >= 2:
        issues.append(f"感叹号堆砌（{e_count} 个）")

    # 2. 省略号悬念（中英文）
    if "..." in title or "…" in title or "……" in title:
        issues.append("省略号悬念")

    # 3. 极端长度（语义级比生成时的 18-28 略宽松）
    char_count = len(title)
    if char_count < 10:
        issues.append(f"标题过短（{char_count} 字）")
    elif char_count > 35:
        issues.append(f"标题过长（{char_count} 字）")

    # 4. 数字+个模板（"\d+\s*个"）
    if re.search(r"\d+\s*个", title):
        issues.append("数字+个模板（'X个Y' 党）")

    # 5. 模板式开头
    template_starts = (
        "你不知道", "你知道", "为什么说", "原来", "揭秘", "真相是",
        "万万没想到", "细思极恐", "一文看懂", "深度", "不可不知",
    )
    for t in template_starts:
        if title.startswith(t):
            issues.append(f"模板式开头：{t}")
            break

    # 6. 空泛主语
    vague_subjects = ("人们", "大家", "所有人", "我们这代人", "我们每个人")
    for subj in vague_subjects:
        if title.startswith(subj):
            issues.append(f"空泛主语：{subj}")
            break

    return len(issues) == 0, issues


def generate_dimension_titles(thesis: str, dimension: str, identity_role: str = "", audience: str = "") -> List[Dict]:
    """
    生成单个维度的3个候选标题

    Args:
        thesis: 命题
        dimension: 维度名称
        identity_role: 用户身份
        audience: 目标受众

    Returns:
        [{"title": str, "rationale": str}, ...]
    """
    dim_config = DIMENSIONS.get(dimension, DIMENSIONS["reversal"])

    negative_block = "\n".join(
        f'- ❌ "{title}"（{reason}）'
        for title, reason in NEGATIVE_TITLE_EXAMPLES
    )
    positive_block = "\n".join(
        f'- ✓ "{title}"（{reason}）'
        for title, reason in POSITIVE_TITLE_EXAMPLES
    )

    prompt = f"""你是顶级选题策划师，专注爆款内容策划。根据用户命题，生成{dimension}维度的3个候选标题。

**维度定义：**
{dim_config['name']}（{dim_config['description']}）
公式：{dim_config['formula']}

**爆款标题核心特征：**
1. **情绪触发**：引发好奇、惊讶、焦虑、共鸣等情绪反应
2. **认知冲突**：打破读者固有认知，制造"原来如此"的顿悟感
3. **悬念感**：留下未解之谜，激发点击欲望
4. **利益相关**：与读者的钱途、职业发展、认知升级直接相关
5. **具体可信**：有数字、场景、人物、时间等具体元素

**约束条件：**
- 每个标题必须在18-28字之间
- 禁止使用：赋能、降维打击、破圈、必须知道、震惊等陈词滥调
- **禁止 AI 套路化句式**：揭秘/真相/竟然/原来/惊人/意外发现/一文看懂/你不知道/…省略号悬念/问号感叹号堆砌
- **风格要求**：像真人写的朋友圈/即刻/小红书文案，不像营销号或 AI 生成；口语化、有具体人称、有真实场景
- 必须包含"认知落差"（旧认知 vs 新认知）
- 必须有具体数字、场景或对比
- 避免使用"你必须知道"等说教式开头
- **必须引发情绪反应**（好奇/惊讶/焦虑/共鸣）
- **必须与读者利益相关**（赚钱/职业/认知/效率）

**反面示例（禁止生成这类标题）：**
{negative_block}

**正面示例（参考风格）：**
{positive_block}

用户命题：{thesis}
{f"用户身份：{identity_role}" if identity_role else ""}
{f"目标受众：{audience}" if audience else ""}

返回JSON格式：
{{
  "candidates": [
    {{"title": "标题1", "rationale": "标题理由（说明情绪触发点和利益点）", "tension_score": 4}},
    {{"title": "标题2", "rationale": "标题理由（说明情绪触发点和利益点）", "tension_score": 3}},
    {{"title": "标题3", "rationale": "标题理由（说明情绪触发点和利益点）", "tension_score": 5}}
  ]
}}

# A1 认知张力自评（每个标题打 1-5 分）
- 5: 强烈对立，挑战主流共识
- 4: 明确反方/新视角
- 3: 一定观点倾向
- 2: 接近通用建议
- 1: 完全信息陈述"""

    result = _call_llm_raw(prompt)
    if not result:
        return []

    parsed = _parse_llm_json(result)
    if not parsed or "candidates" not in parsed:
        return []

    # 验证和清理
    valid_candidates = []
    for c in parsed["candidates"]:
        title = c.get("title", "").strip()
        rationale = c.get("rationale", "").strip()

        # 检查长度（18-28字）
        char_count = len(title)
        if char_count < 18 or char_count > 28:
            continue

        # 检查禁用词
        has_banned, found = check_banned_words(title)
        if has_banned:
            continue

        # A1 tension_score（1-5，缺失默认 3）
        raw_ts = c.get("tension_score")
        try:
            tension_score = max(1, min(5, int(float(raw_ts)))) if raw_ts is not None else 3
        except (TypeError, ValueError):
            tension_score = 3

        valid_candidates.append({
            "title": title,
            "rationale": rationale,
            "dimension": dimension,
            "char_count": char_count,
            "tension_score": tension_score
        })

    return valid_candidates


# v1.1: 维度组合生成（2 维 1 次 LLM 调用，省 2 calls）
DIMENSION_GROUPS = {
    "challenges": ["reversal", "contrarian"],         # 认知挑战类
    "grounded":   ["benefit_anchor", "micro_scene"],  # 落地具体类
}


def generate_dimension_group(
    thesis: str,
    dimensions: List[str],
    identity_role: str = "",
    audience: str = "",
) -> List[Dict]:
    """
    一次 LLM 调用生成 2 个维度的标题（每维 3 个，共 6 个）。

    v1.1: 取代 4 次单维调用，节省 2 calls。语义分组（挑战 vs 落地）让 prompt 焦点更集中。

    Args:
        thesis: 命题
        dimensions: 2 个维度名（如 ["reversal", "contrarian"]）
        identity_role, audience: 用户上下文

    Returns:
        [{"title", "rationale", "dimension", "char_count", "tension_score"}, ...]
    """
    if len(dimensions) != 2:
        # fallback: 退化为单维
        all_titles = []
        for dim in dimensions:
            all_titles.extend(generate_dimension_titles(thesis, dim, identity_role, audience))
        return all_titles

    dim1, dim2 = dimensions
    c1 = DIMENSIONS.get(dim1, DIMENSIONS["reversal"])
    c2 = DIMENSIONS.get(dim2, DIMENSIONS["reversal"])

    negative_block = "\n".join(
        f'- ❌ "{title}"（{reason}）'
        for title, reason in NEGATIVE_TITLE_EXAMPLES
    )
    positive_block = "\n".join(
        f'- ✓ "{title}"（{reason}）'
        for title, reason in POSITIVE_TITLE_EXAMPLES
    )

    dim_section_1 = f"""
**维度1：{c1['name']}（{c1['description']}）**
公式：{c1['formula']}
"""
    dim_section_2 = f"""
**维度2：{c2['name']}（{c2['description']}）**
公式：{c2['formula']}
"""

    prompt = f"""你是顶级选题策划师。根据用户命题，生成 2 个维度的候选标题（每维 3 个 = 共 6 个）。
{dim_section_1}{dim_section_2}

**爆款标题核心特征：**
1. **情绪触发**：引发好奇、惊讶、焦虑、共鸣等情绪反应
2. **认知冲突**：打破读者固有认知
3. **悬念感**：留下未解之谜
4. **利益相关**：与读者的钱途/职业/认知/效率直接相关
5. **具体可信**：有数字、场景、人物、时间等具体元素

**约束：**
- 每个标题 18-28 字
- 禁止：赋能、降维打击、破圈、必须知道、震惊等陈词滥调
- 禁止 AI 套路句式：揭秘/真相/竟然/原来/惊人/意外发现
- 必须包含"认知落差"（旧认知 vs 新认知）
- 必须有具体数字、场景或对比

**反面示例（禁止）：**
{negative_block}

**正面示例（参考）：**
{positive_block}

用户命题：{thesis}
{f"用户身份：{identity_role}" if identity_role else ""}
{f"目标受众：{audience}" if audience else ""}

返回JSON：
{{
  "{dim1}": [
    {{"title": "标题1", "rationale": "理由", "tension_score": 4}},
    {{"title": "标题2", "rationale": "理由", "tension_score": 3}},
    {{"title": "标题3", "rationale": "理由", "tension_score": 5}}
  ],
  "{dim2}": [
    {{"title": "标题1", "rationale": "理由", "tension_score": 4}},
    {{"title": "标题2", "rationale": "理由", "tension_score": 3}},
    {{"title": "标题3", "rationale": "理由", "tension_score": 5}}
  ]
}}

# A1 认知张力自评（每个标题 1-5）
- 5: 强烈对立，挑战主流共识
- 4: 明确反方/新视角
- 3: 一定观点倾向
- 2: 接近通用建议
- 1: 完全信息陈述"""

    result = _call_llm_raw(prompt)
    if not result:
        # fallback: 退化到 2 次单维
        return (generate_dimension_titles(thesis, dim1, identity_role, audience) +
                generate_dimension_titles(thesis, dim2, identity_role, audience))

    parsed = _parse_llm_json(result)
    if not parsed:
        return (generate_dimension_titles(thesis, dim1, identity_role, audience) +
                generate_dimension_titles(thesis, dim2, identity_role, audience))

    valid_candidates = []
    for dim_key in [dim1, dim2]:
        dim_candidates = parsed.get(dim_key, [])
        if not isinstance(dim_candidates, list):
            continue
        for c in dim_candidates:
            if not isinstance(c, dict):
                continue
            title = c.get("title", "").strip()
            rationale = c.get("rationale", "").strip()
            char_count = len(title)
            if char_count < 18 or char_count > 28:
                continue
            has_banned, _ = check_banned_words(title)
            if has_banned:
                continue
            raw_ts = c.get("tension_score")
            try:
                tension_score = max(1, min(5, int(float(raw_ts)))) if raw_ts is not None else 3
            except (TypeError, ValueError):
                tension_score = 3
            valid_candidates.append({
                "title": title,
                "rationale": rationale,
                "dimension": dim_key,
                "char_count": char_count,
                "tension_score": tension_score,
            })

    # 不足时退化单维补
    if len(valid_candidates) < 6:
        extra = (generate_dimension_titles(thesis, dim1, identity_role, audience) +
                 generate_dimension_titles(thesis, dim2, identity_role, audience))
        valid_candidates.extend(extra[: 6 - len(valid_candidates)])

    return valid_candidates[:6]


def select_title_archetypes(dimension_scores: Dict[str, float]) -> List[str]:
    """
    根据认知维度得分，推荐最适合的标题原型（2-4个）

    Args:
        dimension_scores: {"reversal": float, "micro_scene": float, "systemic_flaw": float, "bridge": float}

    Returns:
        推荐的 archetype key 列表（按优先级排序）
    """
    archetype_scores = {}
    for archetype_key in TITLE_ARCHETYPES:
        archetype_scores[archetype_key] = 0.0

    # 累计每个原型的得分（通过维度映射）
    for dimension, score in dimension_scores.items():
        if dimension in DIMENSION_TO_ARCHETYPE:
            for archetype in DIMENSION_TO_ARCHETYPE[dimension]:
                archetype_scores[archetype] = archetype_scores.get(archetype, 0.0) + score

    # 按得分降序排列
    ranked = sorted(archetype_scores.items(), key=lambda x: x[1], reverse=True)

    # 取前2-4个（得分>0.2的优先）
    selected = [k for k, v in ranked if v > 0.2]
    if len(selected) < 2:
        selected = [k for k, v in ranked[:2]]  # 至少2个
    if len(selected) > 4:
        selected = selected[:4]  # 至多4个

    return selected


def generate_archetype_titles(thesis: str, archetype: str,
                               identity_role: str = "", audience: str = "",
                               count: int = 2) -> List[Dict]:
    """
    按指定原型生成候选标题

    Args:
        thesis: 命题
        archetype: 原型 key（如 "opinion_assertion"）
        identity_role: 用户身份
        audience: 目标受众
        count: 生成几个（1-3）

    Returns:
        [{"title": str, "rationale": str, "archetype": str, "char_count": int}, ...]
    """
    arch_config = TITLE_ARCHETYPES.get(archetype)
    if not arch_config:
        return []

    prompt = f"""你是顶级选题策划师，专注爆款内容策划。用「{arch_config['name']}」的方式为命题生成 {count} 个候选标题。

**原型定义：**
- 名称：{arch_config['name']}
- 核心手法：{arch_config['description']}
- 公式：{arch_config['formula']}
- 读者触发点：{arch_config['reader_trigger']}

**爆款标题核心特征：**
1. **有观点**：标题像一个人在说话，不是一个主题概括
2. **有节奏**：短-长-短、问-答-问、数-感-问，读起来有呼吸感
3. **有人称**：出现"你"或"我"，制造对话感
4. **有情绪**：愤怒/惊讶/好奇/共鸣，不能是中性陈述
5. **有悬念**：说完一半，留一半，逼人点进去

**禁止格式：**
- 禁止：为什么XX，其实是YY？（AI腔过重）
- 禁止：XX的本质是YY（教科书标题）
- 禁止：你必须知道的XX个ZZ（说教式）
- 禁止以"如何"开头除非是故事钩子型

**长度要求：**
- 公众号：20-30字
- 小红书：15-22字（如有平台参数）

用户命题：{thesis}
{f"用户身份：{identity_role}" if identity_role else ""}
{f"目标受众：{audience}" if audience else ""}
原型：{arch_config['name']}

返回JSON：
{{
  "candidates": [
    {{"title": "标题1", "rationale": "标题理由（说明使用了什么手法、触发什么情绪）"}},
    ...
  ]
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return []

    parsed = _parse_llm_json(result)
    if not parsed or "candidates" not in parsed:
        return []

    valid_candidates = []
    for c in parsed["candidates"]:
        title = c.get("title", "").strip()
        rationale = c.get("rationale", "").strip()

        if not title:
            continue

        # 检查长度（18-28 字）
        char_count = len(title)
        if char_count < 18 or char_count > 28:
            continue

        # 检查禁用词
        has_banned, found = check_banned_words(title)
        if has_banned:
            continue

        valid_candidates.append({
            "title": title,
            "rationale": rationale,
            "archetype": archetype,
            "char_count": len(title)
        })

    return valid_candidates[:count]


def generate_all_titles(thesis: str, identity_role: str = "", audience: str = "", flavor: str = "prd") -> List[Dict]:
    """
    遍历 4 维，每维生成 3 个候选标题 = 总计 12 个

    流程：
    1. 遍历 4 维（reversal / benefit_anchor / micro_scene / contrarian）
    2. 每维调 generate_dimension_titles(thesis, dim, count=3)
    3. 失败/不足时补生成（同一维重试一次）
    4. 总计 12 个选题

    Args:
        thesis: 命题
        identity_role: 用户身份
        audience: 目标受众
        flavor: "prd"（默认）或 "legacy"（旧 4 维）

    Returns:
        所有候选标题列表
    """
    # v1.1: 按 2 组（每组 2 维）调用，省 2 LLM calls
    if flavor == "legacy":
        # legacy 4 维不分组（兼容性）
        dimensions = list(LEGACY_DIMENSIONS.keys())
        all_candidates = []
        for dim in dimensions:
            dim_titles = generate_dimension_titles(thesis, dim, identity_role, audience)
            if len(dim_titles) < 3:
                retry = generate_dimension_titles(thesis, dim, identity_role, audience)
                dim_titles.extend(retry)
            all_candidates.extend(dim_titles[:3])
        return all_candidates

    # PRD 默认：分 2 组
    all_candidates = []
    for group_dims in DIMENSION_GROUPS.values():
        group_titles = generate_dimension_group(
            thesis, group_dims, identity_role, audience
        )
        all_candidates.extend(group_titles)

    return all_candidates


def calculate_jaccard_similarity(title_a: str, title_b: str) -> float:
    """计算 Jaccard 相似度"""
    tokens_a = set(re.findall(r'\w+', title_a.lower()))
    tokens_b = set(re.findall(r'\w+', title_b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union > 0 else 0.0


def _precompute_embeddings(titles: List[str]) -> Dict[str, Optional[List[float]]]:
    """预计算所有标题的向量（有缓存，失败返回 None）"""
    try:
        from embedding import embed
    except ImportError:
        return {}

    vectors = {}
    for title in titles:
        vec = embed(title)
        if vec is not None:
            vectors[title] = vec
    return vectors


def _calculate_similarity(title_a: str, title_b: str, vectors: Dict[str, List[float]]) -> float:
    """综合相似度：Jaccard×0.4 + Cosine×0.6（无向量时降级到纯 Jaccard）"""
    jaccard = calculate_jaccard_similarity(title_a, title_b)

    vec_a = vectors.get(title_a)
    vec_b = vectors.get(title_b)
    if vec_a and vec_b:
        try:
            from embedding import cosine_similarity
            cosine = cosine_similarity(vec_a, vec_b)
            return 0.4 * jaccard + 0.6 * cosine
        except ImportError:
            pass

    return jaccard


def check_orthogonality(candidates: List[Dict]) -> List[Dict]:
    """
    检查候选标题的正交性（相似度 < 0.75）
    使用 Embedding Cosine + Jaccard 综合相似度，Embedding 不可用时降级到纯 Jaccard

    Returns:
        带相似度标记的候选列表
    """
    titles = [c["title"] for c in candidates]
    vectors = _precompute_embeddings(titles)

    marked = []
    for i, candidate in enumerate(candidates):
        max_similarity = 0.0
        similar_titles = []

        for j, other in enumerate(candidates):
            if i == j:
                continue
            sim = _calculate_similarity(candidate["title"], other["title"], vectors)
            if sim > max_similarity:
                max_similarity = sim
            if sim > 0.5:
                similar_titles.append(other["title"][:20])

        candidate["max_similarity"] = max_similarity
        candidate["similar_titles"] = similar_titles[:3]
        candidate["orthogonal"] = max_similarity < 0.75

        marked.append(candidate)

    return marked


def prism_engine(thesis: str, identity_role: str = "", audience: str = "") -> Dict:
    """
    棱镜引擎主流程

    Args:
        thesis: 命题
        identity_role: 用户身份
        audience: 目标受众

    Returns:
        {
            "status": "success" | "partial" | "error",
            "candidates": [...],
            "orthogonal_count": int,
            "warnings": [...]
        }
    """
    # Step 1: 生成所有标题
    candidates = generate_all_titles(thesis, identity_role, audience)

    if not candidates:
        return {
            "status": "error",
            "candidates": [],
            "orthogonal_count": 0,
            "warnings": ["标题生成失败"]
        }

    # Step 2: 检查正交性
    candidates = check_orthogonality(candidates)

    # 统计
    orthogonal_count = sum(1 for c in candidates if c["orthogonal"])
    warnings = []

    # 添加相似度警告
    for c in candidates:
        if not c["orthogonal"]:
            warnings.append(f"标题 '{c['title'][:20]}...' 与其他候选相似度较高")

    status = "success" if orthogonal_count >= 5 else "partial"

    return {
        "status": status,
        "candidates": candidates,
        "orthogonal_count": orthogonal_count,
        "total_count": len(candidates),
        "warnings": warnings
    }


# ============ 辅助函数 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    from call_llm import call_llm_raw
    return call_llm_raw(prompt, temperature=0.7, scene="writing-cn", error_prefix="LLM 调用错误:")


def _parse_llm_json(text: str) -> Optional[Dict]:
    """从 LLM 输出中解析 JSON"""
    if not text:
        return None

    # 尝试提取 JSON 代码块
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试找到 JSON 对象
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[Warning] JSON 解析失败: {e}", file=sys.stderr)

    return None


# ============ CLI 入口 ============

def _safe_print(obj):
    """修复 Windows GBK 编码问题"""
    output = json.dumps(obj, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")


def main():
    if len(sys.argv) < 3:
        _safe_print({
            "error": "用法: python prism_engine.py <命令> <命题>",
            "commands": {
                "generate": "python prism_engine.py generate <命题> - 生成候选标题",
                "validate": "python prism_engine.py validate <命题> - 生成并校验正交性"
            }
        })
        sys.exit(1)

    command = sys.argv[1]
    thesis = sys.argv[2]

    if command == "generate":
        candidates = generate_all_titles(thesis)
        _safe_print({
            "candidates": candidates,
            "total_count": len(candidates)
        })

    elif command == "validate":
        result = prism_engine(thesis)
        _safe_print(result)

    else:
        _safe_print({"error": f"未知命令: {command}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
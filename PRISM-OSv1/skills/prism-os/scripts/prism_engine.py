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
from typing import Dict, List, Optional, Tuple

# ============ Phase 2: 四维标题生成 ============

DIMENSIONS = {
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

BANNED_WORDS = [
    "赋能", "降维打击", "破圈", "必须知道", "震惊",
    "惊呆了", "重磅", "震撼", "颠覆", "必看"
]


def check_banned_words(title: str) -> Tuple[bool, List[str]]:
    """检查标题是否包含禁用词"""
    found = []
    for word in BANNED_WORDS:
        if word in title:
            found.append(word)
    return len(found) > 0, found


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
- 必须包含"认知落差"（旧认知 vs 新认知）
- 必须有具体数字、场景或对比
- 避免使用"你必须知道"等说教式开头
- **必须引发情绪反应**（好奇/惊讶/焦虑/共鸣）
- **必须与读者利益相关**（赚钱/职业/认知/效率）

用户命题：{thesis}
{f"用户身份：{identity_role}" if identity_role else ""}
{f"目标受众：{audience}" if audience else ""}

返回JSON格式：
{{
  "candidates": [
    {{"title": "标题1", "rationale": "标题理由（说明情绪触发点和利益点）"}},
    {{"title": "标题2", "rationale": "标题理由（说明情绪触发点和利益点）"}},
    {{"title": "标题3", "rationale": "标题理由（说明情绪触发点和利益点）"}}
  ]
}}"""

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

        valid_candidates.append({
            "title": title,
            "rationale": rationale,
            "dimension": dimension,
            "char_count": char_count
        })

    return valid_candidates


def generate_all_titles(thesis: str, identity_role: str = "", audience: str = "") -> List[Dict]:
    """
    生成所有四个维度的候选标题（共12个）

    Args:
        thesis: 命题
        identity_role: 用户身份
        audience: 目标受众

    Returns:
        所有候选标题列表
    """
    all_candidates = []

    for dimension in DIMENSIONS.keys():
        candidates = generate_dimension_titles(thesis, dimension, identity_role, audience)
        all_candidates.extend(candidates)

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

    status = "success" if orthogonal_count >= 8 else "partial"

    return {
        "status": status,
        "candidates": candidates,
        "orthogonal_count": orthogonal_count,
        "total_count": len(candidates),
        "warnings": warnings
    }


# ============ 辅助函数 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM，返回原始文本"""
    from call_llm import call_llm

    # Phase 2 使用 writing-cn scene
    scene = os.environ.get("GATEWAY_SCENE", "writing-cn")
    os.environ["GATEWAY_SCENE"] = scene

    result = call_llm(prompt)

    if result.get("error"):
        print(f"LLM 调用错误: {result['error']}", file=sys.stderr)
        return None

    return result.get("content")


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
    except:
        pass

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
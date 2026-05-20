#!/usr/bin/env python3
"""
PRISM-OS Phase 5: 内容生成模块
从 CCOS 大纲到完整初稿的分模块生成

用法:
    python prism_os.py generate "<标题>" --platform wechat
    python prism_os.py generate "<标题>" --platform xiaohongshu
"""

import sys
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

# ============ LLM 调用 ============

def _call_llm_raw(prompt: str, temperature: float = 0.7) -> Optional[str]:
    """调用 LLM，返回原始文本"""
    os.environ["GATEWAY_SCENE"] = "writing-cn"
    sys.path.insert(0, str(Path(__file__).parent))
    from call_llm import call_llm as _call_llm
    result = _call_llm(prompt, temperature=temperature)
    if result.get("error"):
        print(f"[LLM Error] {result['error']}", file=sys.stderr)
        return None
    return result.get("content", "")


def _parse_llm_json(text: str) -> Optional[Dict]:
    """从 LLM 输出解析 JSON"""
    if not text:
        return None
    code_block_pattern = r"```(?:json)?\s*([\s\S]*?)```"
    match = re.search(code_block_pattern, text)
    if match:
        text = match.group(1)
    else:
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        json_pattern = r"\{[\s\S]*\}"
        match = re.search(json_pattern, text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return None


# ============ 素材召回（按模块类型）============

def _get_obsidian_module():
    """懒加载 obsidian_knowledge"""
    obsidian_path = Path(__file__).parent.parent.parent / ".claude" / "obsidian_knowledge.py"
    if not obsidian_path.exists():
        return None
    import importlib.util
    spec = importlib.util.spec_from_file_location("obsidian_knowledge", obsidian_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# 素材类型 → Obsidian 子目录映射
MODULE_MATERIAL_PRIORITY = {
    "HOOK": {
        "primary": ["洞察库"],  # 反常识洞察
        "secondary": ["原子库"],
        "reason": "HOOK 需要反直觉案例/冲突性数据"
    },
    "CASE": {
        "primary": ["原子库", "案例库"],
        "secondary": ["洞察库"],
        "reason": "CASE 需要具体场景/人物故事"
    },
    "EXPLAIN": {
        "primary": ["原子库"],
        "secondary": ["洞察库"],
        "reason": "EXPLAIN 需要分析框架/因果解释"
    },
    "MODEL": {
        "primary": ["原子库", "思维模型"],
        "secondary": ["原子库"],
        "reason": "MODEL 需要认知模型/方法论框架"
    },
    "COUNTER": {
        "primary": ["洞察库"],
        "secondary": ["原子库"],
        "reason": "COUNTER 需要反直觉观点"
    },
    "ACTION": {
        "primary": ["原子库", "方法库"],
        "secondary": [],
        "reason": "ACTION 需要操作步骤/清单"
    },
    "BOUNDARY": {
        "primary": ["洞察库", "原子库"],
        "secondary": [],
        "reason": "BOUNDARY 需要适用边界条件"
    },
    "EVIDENCE": {
        "primary": ["原子库", "洞察库"],
        "secondary": [],
        "reason": "EVIDENCE 需要数据/案例支撑"
    }
}


def recall_materials_by_module(
    topic: str,
    module_type: str,
    vault_path: Path = None
) -> List[Dict]:
    """
    按模块类型召回 Obsidian 素材

    Args:
        topic: 命题
        module_type: 模块类型 HOOK/CASE/EXPLAIN/MODEL/ACTION/COUNTER/BOUNDARY/EVIDENCE
        vault_path: Obsidian vault 路径

    Returns:
        [{"name": str, "type": str, "content": str, "relevance": float, "quality_score": float}, ...]
    """
    obsidian = _get_obsidian_module()
    if not obsidian:
        return []

    if vault_path is None:
        vault_path = Path(r"D:\软件\obsidian笔记\内容素材库")

    priority = MODULE_MATERIAL_PRIORITY.get(module_type, MODULE_MATERIAL_PRIORITY["CASE"])

    all_results = []
    seen_names = set()

    # 优先搜索 primary 目录
    for subdir in priority["primary"] + priority["secondary"]:
        # 构造查询词
        query = f"{topic} {priority['reason']}"
        results = obsidian.full_text_search(query, vault_path, limit=15)
        for r in results:
            if r["name"] not in seen_names:
                r["material_type"] = module_type
                r["priority"] = "primary" if subdir in priority["primary"] else "secondary"
                all_results.append(r)
                seen_names.add(r["name"])

    # 质量过滤
    filtered = obsidian.filter_quality(all_results, threshold=7)

    # 按相关性和质量排序
    filtered.sort(key=lambda x: (x.get("relevance", 0) * 0.6 + x.get("quality_score", 0) / 10 * 0.4), reverse=True)

    return filtered[:8]


# ============ 素材缺口检测 ============

def detect_material_gaps(
    topic: str,
    ccos_outline: Dict,
    vault_path: Path = None
) -> Dict[str, List[str]]:
    """
    检测每个模块的素材缺口

    Args:
        topic: 命题
        ccos_outline: CCOS 14项输出
        vault_path: Obsidian vault 路径

    Returns:
        {
            "HOOK": {"has_gap": bool, "gap_description": str, "recalled_count": int},
            ...
        }
    """
    module_flow = ccos_outline.get("认知模块流", [])
    gaps = {}

    for module in module_flow:
        mod_type = module.get("模块", "")
        mod_content = module.get("内容摘要", "")

        # 召回素材
        materials = recall_materials_by_module(topic, mod_type, vault_path)

        if len(materials) < 1:
            gaps[mod_type] = {
                "has_gap": True,
                "gap_description": f"缺少 {mod_type} 类型素材，建议补充：{MODULE_MATERIAL_PRIORITY.get(mod_type, {}).get('reason', '相关素材')}",
                "recalled_count": 0,
                "materials": []
            }
        else:
            gaps[mod_type] = {
                "has_gap": False,
                "gap_description": "",
                "recalled_count": len(materials),
                "materials": [
                    {
                        "name": m["name"],
                        "type": m["type"],
                        "relevance": round(m.get("relevance", 0), 2),
                        "quality_score": m.get("quality_score", 0)
                    }
                    for m in materials[:5]
                ]
            }

    return gaps


# ============ 文章抓取（autocli）============

AUTOCLI_PATH = r"D:\myproject\内容系统v1\contentforge\autocli.exe"


def _run_autocli(args: List[str], timeout: int = 60) -> str:
    """运行 autocli 命令"""
    import subprocess
    cmd = [AUTOCLI_PATH] + args
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return ""
    except Exception as e:
        return f"[autocli error] {e}"


def scrape_article(url: str, format: str = "json") -> Optional[Dict]:
    """
    用 autocli 抓取文章内容

    Args:
        url: 文章 URL
        format: 输出格式 (json/text/markdown)

    Returns:
        {"title": str, "content": str, "url": str} 或 None
    """
    # 微信公众号用专用命令
    if "mp.weixin.qq.com" in url:
        output = _run_autocli(["weixin", "download", url, "--format", "json"])
        if not output or output.startswith("[autocli error]"):
            return None
        try:
            parsed = json.loads(output)
            if isinstance(parsed, list):
                parsed = parsed[0]
            if parsed.get("status") != "ok":
                return None
            title = parsed.get("title", "")
            md_path = parsed.get("path", "")
            if md_path:
                try:
                    with open(md_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    content = re.sub(r"^---[\s\S]*?---\n", "", content).strip()
                    import os
                    os.remove(md_path)
                except Exception:
                    content = ""
            else:
                content = parsed.get("content", "")
            return {"title": title, "content": content, "url": url}
        except Exception:
            return None

    # 其他 URL 用通用 read 命令
    output = _run_autocli(["read", url, "--format", format])
    if not output or output.startswith("[autocli error]"):
        return None

    if format == "json":
        try:
            return json.loads(output)
        except Exception:
            return None
    else:
        # text/markdown: 返回 title 和 content
        lines = output.strip().split("\n", 1)
        title = lines[0] if lines else ""
        content = lines[1] if len(lines) > 1 else ""
        return {"title": title, "content": content, "url": url}


def extract_key_content(scrape_result: Dict, module_type: str) -> Dict:
    """
    从抓取结果中提取关键段落用于素材库

    Args:
        scrape_result: scrape_article 返回结果
        module_type: 模块类型（决定提取策略）

    Returns:
        {"summary": str, "key_paragraphs": List[str], "suggested_type": str}
    """
    content = scrape_result.get("content", "")
    if not content:
        return {"summary": "", "key_paragraphs": [], "suggested_type": "case"}

    # 用 LLM 提取关键内容
    prompt = f"""从以下文章内容中提取适合素材库的关键段落。

文章标题：{scrape_result.get('title', '')}

内容：
{content[:3000]}

模块类型：{module_type}
- HOOK：需要反直觉案例、冲突性数据
- CASE：需要具体场景、人物故事、决策过程
- MODEL：需要分析框架、因果解释
- ACTION：需要操作步骤、清单
- EXPLAIN：需要深度解读、维度分析

提取 2-3 个关键段落（每个 100-300 字），返回 JSON：
{{
  "summary": "200字以内的内容摘要",
  "key_paragraphs": ["段落1", "段落2", "段落3"],
  "suggested_type": "case/atom/insight"
}}"""

    raw = _call_llm_raw(prompt, temperature=0.3)
    if not raw:
        return {"summary": content[:500], "key_paragraphs": [content[:1000]], "suggested_type": "case"}

    parsed = _parse_llm_json(raw)
    if not parsed:
        return {"summary": content[:500], "key_paragraphs": [content[:1000]], "suggested_type": "case"}

    return parsed


# ============ 素材缺口提示 → 搜索推荐 ============

def generate_gap_search_query(
    topic: str,
    module_type: str,
    gap_description: str
) -> str:
    """生成缺口搜索提示"""
    return f"{topic} {gap_description}"


def search_gap_articles(
    topic: str,
    module_type: str,
    gap_description: str,
    max_results: int = 5
) -> List[Dict]:
    """
    搜索缺口相关文章（Tavily / DuckDuckGo 多源）

    Args:
        topic: 命题
        module_type: 模块类型
        gap_description: 缺口描述
        max_results: 最大结果数

    Returns:
        [{"title": str, "url": str, "snippet": str, "source": str}, ...]
    """
    query = generate_gap_search_query(topic, module_type, gap_description)
    results = []

    # 尝试 Tavily API
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if tavily_key:
        try:
            import urllib.request
            import urllib.error
            payload = json.dumps({
                "query": query,
                "max_results": max_results,
                "api_key": tavily_key
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.tavily.com/search",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for item in data.get("results", [])[:max_results]:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "snippet": item.get("content", "")[:200],
                        "source": "tavily"
                    })
        except Exception as e:
            print(f"[Warning] Tavily 搜索失败: {e}", file=sys.stderr)

    # 尝试 DuckDuckGo（备选）
    if len(results) < 3:
        try:
            import urllib.request
            import urllib.error
            import html
            encoded_query = urllib.request.quote(query)
            ddg_url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1"
            req = urllib.request.Request(ddg_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for topic_item in data.get("RelatedTopics", [])[:max_results]:
                    if topic_item.get("Text") and topic_item.get("FirstURL"):
                        results.append({
                            "title": html.unescape(topic_item.get("Text", "")[:100]),
                            "url": topic_item.get("FirstURL", ""),
                            "snippet": topic_item.get("Text", "")[:200],
                            "source": "duckduckgo"
                        })
        except Exception as e:
            print(f"[Warning] DuckDuckGo 搜索失败: {e}", file=sys.stderr)

    # 如果都失败，返回 LLM 推荐的搜索词
    if not results:
        results = [{
            "title": "搜索建议",
            "url": "",
            "snippet": f"建议搜索：{query}（请手动搜索相关素材入库）",
            "source": "llm_fallback"
        }]

    return results[:max_results]


# ============ 抓取并入库完整流程 ============

def scrape_and_import_material(
    url: str,
    module_type: str,
    topic: str,
    vault_path: Path = None
) -> Dict:
    """
    抓取文章 → 提取关键内容 → 入库 Obsidian

    Args:
        url: 文章 URL
        module_type: 模块类型（决定提取策略）
        topic: 命题（用于关联）
        vault_path: Obsidian vault 路径

    Returns:
        {"status": str, "title": str, "material_type": str, "path": str, "error": str}
    """
    if vault_path is None:
        vault_path = Path(r"D:\软件\obsidian笔记\内容素材库")

    # 1. 抓取
    scrape_result = scrape_article(url, format="json")
    if not scrape_result:
        return {"status": "scrape_failed", "title": "", "material_type": "case", "path": "", "error": "抓取失败"}

    title = scrape_result.get("title", "未命名")
    content = scrape_result.get("content", "")

    # 2. 提取关键内容
    extracted = extract_key_content(scrape_result, module_type)

    # 3. 写入 Obsidian
    obsidian = _get_obsidian_module()
    if not obsidian:
        return {"status": "obsidian_module_not_found", "title": title, "material_type": "case", "path": "", "error": "无法加载 obsidian_knowledge"}

    # 判断素材类型
    suggested_type = extracted.get("suggested_type", "case")
    if module_type == "HOOK":
        subdir = "洞察库"
        material_type = "insight"
    elif suggested_type == "insight":
        subdir = "洞察库"
        material_type = "insight"
    elif suggested_type in ("case", "viewpoint"):
        subdir = "原子库"
        material_type = "atom"
    else:
        subdir = "原子库"
        material_type = "atom"

    # 写入文件（直接写入父目录，方便 scan_vault 递归发现）
    from datetime import datetime
    import re

    safe_title = re.sub(r'[<>:"/\\|?*]', '', title)[:80] or "untitled"
    today = datetime.now().strftime("%Y-%m-%d")

    if material_type == "insight":
        file_path = vault_path / f"40_知识库/{subdir}/{safe_title}.md"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        frontmatter_lines = ["---",
            f"type: insight",
            "status: active",
            f"topics: [{topic}]",
            f"source_url: {url}",
            f"created: {today}",
            f"updated: {today}",
            "---"]
        body = f"# {title}\n\n## 核心观点\n{extracted.get('summary', '')}\n\n## 关键段落\n" + "\n\n".join(f"- {p}" for p in extracted.get("key_paragraphs", []))
        content_full = "\n".join(frontmatter_lines) + "\n" + body
    else:
        file_path = vault_path / f"40_知识库/{subdir}/{safe_title}.md"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        frontmatter_lines = ["---",
            "type: atom",
            "subtype: case",
            "status: active",
            f"topics: [{topic}]",
            f"source_url: {url}",
            f"source_note: {title}",
            f"created: {today}",
            f"updated: {today}",
            "---"]
        body = f"# {title}\n\n## 原子内容\n> {extracted.get('summary', '')}\n\n## 来源\n- 链接：[{title}]({url})\n\n## 关键段落\n" + "\n\n".join(f"- {p}" for p in extracted.get("key_paragraphs", []))
        content_full = "\n".join(frontmatter_lines) + "\n" + body

    try:
        file_path.write_text(content_full, encoding="utf-8")
        return {
            "status": "success",
            "title": title,
            "material_type": material_type,
            "path": str(file_path),
            "error": ""
        }
    except Exception as e:
        return {"status": "write_failed", "title": title, "material_type": material_type, "path": "", "error": str(e)}


# ============ 用户手写润色 ============

def polish_user_material(
    user_text: str,
    platform: str,
    material_type: str = "case"
) -> Dict:
    """
    用户手写素材 → AI 润色

    润色原则：
    - 口语化 → 书面化
    - 精简重复内容
    - 前后逻辑连贯
    - 不改变原意、不扩展内容、不改变第一人称视角

    Returns:
        {"polished": str, "original": str, "changes": List[str]}
    """
    platform_hint = "更书面化，适合公众号深度叙事" if platform == "wechat" else "保留口语感，适合小红书"

    prompt = f"""你是内容润色专家。用户写了一{material_type}素材，需要你润色。

原文：
{user_text}

平台：{platform}（{platform_hint}）

润色要求：
1. 口语化→书面化，但保留真实感
2. 精简重复内容
3. 前后逻辑连贯
4. 不改变原意、不扩展内容、不改变第一人称视角
5. 让内容更像"文章"而非"聊天记录"

返回 JSON：
{{
  "polished": "润色后的文本",
  "original": "原文",
  "changes": ["变更描述1", "变更描述2"]
}}"""

    raw = _call_llm_raw(prompt, temperature=0.3)
    if not raw:
        return {"polished": user_text, "original": user_text, "changes": ["润色失败，保留原文"]}

    parsed = _parse_llm_json(raw)
    if not parsed:
        return {"polished": user_text, "original": user_text, "changes": ["润色解析失败，保留原文"]}

    return parsed


# ============ 模块生成 Prompt 构建 ============

def _build_hook_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 HOOK 模块 prompt"""
    platform_hints = {
        "wechat": {
            "role": "思想产品式的开篇",
            "length": "20-30字",
            "function": "制造认知停顿，让人重新思考",
            "style": "反直觉断言/数据冲击/强冲突场景",
            "forbidden": "正确的废话、温和观点"
        },
        "xiaohongshu": {
            "role": "种草安利式的封面",
            "length": "20字以内，可带emoji",
            "function": "制造情绪共鸣，让人想点进去",
            "style": "身份标签/情绪词/悬念/这说的就是我",
            "forbidden": "平铺直叙、无刺激点"
        }
    }
    hints = platform_hints.get(platform, platform_hints["wechat"])

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:200]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 HOOK（开篇钩子）。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

内容目标：{ccos.get('内容目标', '')}
认知张力：{ccos.get('核心认知冲突', '')}

HOOK 要求：
- 角色：{hints['role']}
- 长度：{hints['length']}
- 功能：{hints['function']}
- 写法：{hints['style']}
- 禁止：{hints['forbidden']}
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 1 个 HOOK，直接输出钩子文本，不要解释。"""


def _build_case_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 CASE 模块 prompt"""
    platform_hints = {
        "wechat": {
            "function": "论据，服务论点",
            "depth": "深度叙事，500字以上",
            "structure": "起承转合，决策/心理变化",
            "perspective": "第三或第一均可",
            "key": "细节够真，有时间感"
        },
        "xiaohongshu": {
            "function": "主角，故事即观点",
            "depth": "短平快场景，200-300字",
            "structure": "情绪弧线，高潮前置",
            "perspective": "第一人称亲历感",
            "key": "情绪共鸣强，能让读者代入"
        }
    }
    hints = platform_hints.get(platform, platform_hints["wechat"])

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 CASE（案例）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
CASE 要求：
- 功能：{hints['function']}
- 深度：{hints['depth']}
- 结构：{hints['structure']}
- 视角：{hints['perspective']}
- 关键：{hints['key']}
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 CASE 模块内容，{'400-600字' if platform == 'wechat' else '200-300字'}，直接输出内容。"""


def _build_explain_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 EXPLAIN 模块 prompt（公众号必有，小红书可选）"""
    if platform == "xiaohongshu":
        return ""  # 小红书 EXPLAIN 可选

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 EXPLAIN（解读分析）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
EXPLAIN 要求：
- 功能：对案例或观点进行深度解读
- 深度：2-3个维度分析
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 EXPLAIN 模块内容，200-400字，直接输出内容。"""


def _build_model_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 MODEL 模块 prompt"""
    if platform == "xiaohongshu":
        return ""  # 小红书 MODEL 可选

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 MODEL（认知模型）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
MODEL 要求：
- 功能：提炼可复用的认知模型或框架
- 命名：需要有模型名称，让人能记住
- 结构：完整框架，3层以上
- 关键：让人能记住模型名字
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 MODEL 模块内容，包含模型名称和框架描述，200-400字，直接输出内容。"""


def _build_counter_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 COUNTER 模块 prompt"""
    if platform == "xiaohongshu":
        return ""  # 小红书 COUNTER 可选

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 COUNTER（反直觉观点）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
COUNTER 要求：
- 功能：制造记忆点，反直觉观点
- 写法：2-3句反直觉内容
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 COUNTER 模块内容，100-200字，直接输出内容。"""


def _build_action_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 ACTION 模块 prompt"""
    platform_hints = {
        "wechat": {"style": "步骤化1-2-3"},
        "xiaohongshu": {"style": "清单化3-5条"}
    }
    hints = platform_hints.get(platform, platform_hints["wechat"])

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 ACTION（行动步骤）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
ACTION 要求：
- 功能：给出具体行动步骤
- 风格：{hints['style']}
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 ACTION 模块内容，{'150-300字' if platform == 'wechat' else '100-200字'}，直接输出内容。"""


def _build_boundary_prompt(topic: str, ccos: Dict, materials: List[Dict], previous_modules: List[Dict], platform: str) -> str:
    """构建 BOUNDARY 模块 prompt"""
    if platform == "xiaohongshu":
        return ""  # 小红书 BOUNDARY 可选

    prev_context = ""
    if previous_modules:
        prevs = [f"- {m.get('模块', m.get('module', 'Unknown'))}：{m.get('draft', '')[:80]}" for m in previous_modules[-2:]]
        prev_context = "前序模块摘要：\n" + "\n".join(prevs) + "\n\n"

    materials_text = ""
    if materials:
        mats = [f"- {m['name']}: {m.get('content', '')[:300]}" for m in materials[:3]]
        materials_text = "\n参考素材：\n" + "\n".join(mats)

    return f"""你是资深内容策划师。为命题生成{platform}平台的 BOUNDARY（适用边界）模块。

命题：{topic}
{ccos.get('最终动态认知大纲', '')}

{prev_context}
BOUNDARY 要求：
- 功能：说明观点的适用边界，提升高级感
- 写法：1-2句边界条件
- 信息密度：{ccos.get('信息密度要求', '')}
- Anti-AI：{ccos.get('Anti-AI要求', '')}

语言风格：{ccos.get('语言风格', '')}

{materials_text}

请生成 BOUNDARY 模块内容，50-100字，直接输出内容。"""


# ============ 模块生成器映射 ============

MODULE_BUILDERS = {
    "HOOK": _build_hook_prompt,
    "CASE": _build_case_prompt,
    "EXPLAIN": _build_explain_prompt,
    "MODEL": _build_model_prompt,
    "COUNTER": _build_counter_prompt,
    "ACTION": _build_action_prompt,
    "BOUNDARY": _build_boundary_prompt,
}

# 平台模块配置
PLATFORM_MODULE_CONFIG = {
    "wechat": ["HOOK", "CASE", "EXPLAIN", "MODEL", "COUNTER", "ACTION", "BOUNDARY"],
    "xiaohongshu": ["HOOK", "CASE", "ACTION", "BOUNDARY"]
}


# ============ 单模块生成 ============

def generate_single_module(
    topic: str,
    module_type: str,
    ccos_outline: Dict,
    materials: List[Dict],
    previous_modules: List[Dict],
    platform: str,
    rewrite_count: int = 0
) -> Dict:
    """
    生成单个模块内容

    Returns:
        {
            "module": str,
            "draft": str,
            "materials_used": List[str],
            "rewrite_count": int,
            "status": str
        }
    """
    builder = MODULE_BUILDERS.get(module_type)
    if not builder:
        return {"module": module_type, "draft": "", "status": "unsupported_module"}

    # 加载风格偏好并注入
    style_prefs = get_style_preferences(platform)
    style_hints = build_style_hints(style_prefs)

    # 小红书可选模块，若无 builder 则跳过
    prompt = builder(topic, ccos_outline, materials, previous_modules, platform)
    if not prompt:
        return {"module": module_type, "draft": "", "status": "skipped_optional"}

    # 追加风格偏好到 prompt
    if style_hints:
        prompt = prompt + "\n\n" + style_hints

    raw = _call_llm_raw(prompt, temperature=0.6)
    if not raw:
        return {"module": module_type, "draft": "", "status": "llm_failed"}

    # 清理输出
    draft = raw.strip()

    return {
        "module": module_type,
        "draft": draft,
        "materials_used": [m["name"] for m in materials[:3]],
        "rewrite_count": rewrite_count,
        "status": "success"
    }


# ============ 修改记录 ============

_MOD_LOG_PATH = Path(__file__).parent.parent / "data" / "modification_log.json"
_modification_log: List[Dict] = []


def _load_mod_log() -> List[Dict]:
    """从磁盘加载修改记录"""
    if not _MOD_LOG_PATH.exists():
        return []
    try:
        with open(_MOD_LOG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_mod_log(log: List[Dict]) -> None:
    """持久化修改记录到磁盘"""
    _MOD_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(_MOD_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Warning] 保存修改记录失败: {e}", file=sys.stderr)


def record_modification(
    module: str,
    original: str,
    modified: str,
    platform: str,
    topic: str,
    user_id: str = "digital_twin"
) -> None:
    """后台静默记录修改（不打断流程）"""
    global _modification_log
    if not _modification_log:
        _modification_log = _load_mod_log()

    entry = {
        "module": module,
        "original": original,
        "modified": modified,
        "user_id": user_id,
        "timestamp": datetime.now().isoformat(),
        "platform": platform,
        "topic": topic
    }
    _modification_log.append(entry)
    _save_mod_log(_modification_log)


def get_modification_log() -> List[Dict]:
    """获取修改记录（含持久化加载）"""
    global _modification_log
    if not _modification_log:
        _modification_log = _load_mod_log()
    return _modification_log


def get_style_preferences(platform: str, min_samples: int = 3) -> Dict[str, Any]:
    """
    从修改记录中学习用户风格偏好

    分析维度：
    - HOOK 风格：长度、用词特点
    - CASE 风格：深度/短平快、叙事视角
    - 共同修改词：高频修改词（可能是用户不喜欢/喜欢替换的词）
    - 删除词 vs 添加词：对比 original vs modified 差异

    Returns:
        {
            "hook_length_avg": float,
            "case_depth": str,  # "long" / "short"
            "case_perspective": str,  # "first" / "third"
            "removed_words": List[str],  # 用户倾向删除的词
            "added_words": List[str],   # 用户倾向添加的词
            "sample_count": int
        }
    """
    global _modification_log
    if not _modification_log:
        _modification_log = _load_mod_log()

    entries = [e for e in _modification_log if e["platform"] == platform]
    if len(entries) < min_samples:
        return {"sample_count": len(entries), "style_summary": ""}

    hook_lengths = []
    case_depths = []
    case_perspectives = []
    removed_words = []
    added_words = []

    for e in entries:
        original = e.get("original", "")
        modified = e.get("modified", "")

        if e["module"] == "HOOK":
            hook_lengths.append(len(modified))
        elif e["module"] == "CASE":
            if len(modified) > 400:
                case_depths.append("long")
            else:
                case_depths.append("short")
            # 简单视角判断：是否包含"我"
            case_perspectives.append("first" if "我" in modified else "third")

        # 词级别差异（简单启发式）
        orig_words = set(original)
        mod_words = set(modified)
        for w in orig_words - mod_words:
            if len(w) > 1:
                removed_words.append(w)
        for w in mod_words - orig_words:
            if len(w) > 1:
                added_words.append(w)

    from collections import Counter
    hook_len_avg = sum(hook_lengths) / len(hook_lengths) if hook_lengths else 0
    case_depth_pref = Counter(case_depths).most_common(1)[0][0] if case_depths else "long"
    case_persp_pref = Counter(case_perspectives).most_common(1)[0][0] if case_perspectives else "first"

    # 高频差异词（至少出现2次）
    removed_counter = Counter(removed_words)
    added_counter = Counter(added_words)
    frequent_removed = [w for w, c in removed_counter.items() if c >= 2]
    frequent_added = [w for w, c in added_counter.items() if c >= 2]

    return {
        "hook_length_avg": round(hook_len_avg, 1),
        "case_depth": case_depth_pref,
        "case_perspective": case_persp_pref,
        "removed_words": frequent_removed[:10],
        "added_words": frequent_added[:10],
        "sample_count": len(entries)
    }


def build_style_hints(prefs: Dict[str, Any]) -> str:
    """将风格偏好转为 prompt hint"""
    if prefs.get("sample_count", 0) == 0:
        return ""
    hints = []
    if prefs.get("hook_length_avg"):
        hints.append(f"HOOK 长度参考：约 {prefs['hook_length_avg']:.0f} 字")
    if prefs.get("case_depth"):
        depth = "深度叙事（500字+）" if prefs["case_depth"] == "long" else "短平快（200-300字）"
        hints.append(f"CASE 深度：{depth}")
    if prefs.get("case_perspective"):
        persp = "第一人称" if prefs["case_perspective"] == "first" else "第三人称"
        hints.append(f"CASE 视角：{persp}")
    if prefs.get("removed_words"):
        removed_str = "、".join(prefs["removed_words"][:5])
        hints.append(f"避免用词：{removed_str}")
    if hints:
        return "用户风格偏好：" + " | ".join(hints) + "。请参考以上偏好。"
    return ""


# ============ 分模块生成流程 ============

def content_generation_workflow(
    topic: str,
    ccos_outline: Dict,
    platform: str,
    vault_path: Path = None
) -> Dict:
    """
    Phase 5 核心流程：分模块生成

    Args:
        topic: 命题
        ccos_outline: CCOS 14项输出
        platform: wechat / xiaohongshu
        vault_path: Obsidian vault 路径

    Returns:
        {
            "status": str,
            "topic": str,
            "platform": str,
            "modules": [
                {
                    "module": str,
                    "draft": str,
                    "status": str,
                    "materials_used": List[str],
                    "rewrite_count": int
                },
                ...
            ],
            "material_gaps": {...},
            "full_draft": str,
            "generation_stats": {
                "total_modules": int,
                "success_count": int,
                "skipped_count": int,
                "failed_count": int
            }
        }
    """
    if vault_path is None:
        vault_path = Path(r"D:\软件\obsidian笔记\内容素材库")

    result = {
        "status": "running",
        "topic": topic,
        "platform": platform,
        "modules": [],
        "material_gaps": {},
        "full_draft": "",
        "generation_stats": {}
    }

    # 1. 素材缺口检测
    gaps = detect_material_gaps(topic, ccos_outline, vault_path)
    result["material_gaps"] = gaps

    # 2. 确定要生成的模块列表
    modules_to_generate = PLATFORM_MODULE_CONFIG.get(platform, PLATFORM_MODULE_CONFIG["wechat"])
    module_flow = ccos_outline.get("认知模块流", [])

    # 按模块流顺序生成
    generated_modules = []
    previous_modules = []

    success_count = 0
    skipped_count = 0
    failed_count = 0

    for mod_info in module_flow:
        mod_type = mod_info.get("模块", "")
        if mod_type not in modules_to_generate:
            continue

        gap_info = gaps.get(mod_type, {})

        # 召回素材
        materials = recall_materials_by_module(topic, mod_type, vault_path)

        # 生成模块
        gen_result = generate_single_module(
            topic, mod_type, ccos_outline,
            materials, previous_modules, platform
        )

        if gen_result["status"] == "success":
            success_count += 1
        elif gen_result["status"] == "skipped_optional":
            skipped_count += 1
        else:
            failed_count += 1

        generated_modules.append({
            **gen_result,
            "gap_detected": gap_info.get("has_gap", False),
            "gap_description": gap_info.get("gap_description", ""),
            "recalled_materials": gap_info.get("materials", [])
        })

        if gen_result["status"] == "success":
            previous_modules.append(gen_result)

    result["modules"] = generated_modules
    result["status"] = "completed"

    # 3. 拼接完整草稿
    full_parts = []
    for m in generated_modules:
        if m["status"] == "success" and m["draft"]:
            full_parts.append(f"【{m['module']}】\n{m['draft']}")

    result["full_draft"] = "\n\n---\n\n".join(full_parts)

    # 4. 统计
    result["generation_stats"] = {
        "total_modules": len(generated_modules),
        "success_count": success_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count
    }

    return result


# ============ 逐模块交互生成 ============

def interactive_content_generation_workflow(
    topic: str,
    ccos_outline: Dict,
    platform: str,
    vault_path: Path = None
) -> Dict:
    """
    Phase 5.5 逐模块交互生成流程

    流程：
    1. 展示缺口检测结果
    2. 逐模块生成 → 显示草稿 → 用户选择：确认/重写/手动修改
    3. 重写最多 2 次，仍不满意提示手动修改
    4. 确认后进入下一模块
    5. 全部完成后输出完整草稿
    """
    if vault_path is None:
        vault_path = Path(r"D:\软件\obsidian笔记\内容素材库")

    gaps = detect_material_gaps(topic, ccos_outline, vault_path)
    modules_to_generate = PLATFORM_MODULE_CONFIG.get(platform, PLATFORM_MODULE_CONFIG["wechat"])
    module_flow = ccos_outline.get("认知模块流", [])
    previous_modules = []
    confirmed_modules = []

    print(f"\n{'='*60}")
    print(f"命题：{topic}  |  平台：{platform}")
    print(f"{'='*60}")

    # 展示缺口概览
    print("\n【素材缺口检测】")
    for mod_type in modules_to_generate:
        gap = gaps.get(mod_type, {})
        if gap.get("has_gap"):
            print(f"  ⚠ {mod_type}: {gap.get('gap_description', '缺素材')}")
        else:
            print(f"  ✅ {mod_type}: 已召回 {gap.get('recalled_count', 0)} 条素材")

    print("\n【开始逐模块生成】输入 q 随时退出\n")

    for mod_info in module_flow:
        mod_type = mod_info.get("模块", "")
        if mod_type not in modules_to_generate:
            continue

        gap = gaps.get(mod_type, {})
        print(f"\n{'─'*50}")
        print(f"▶ 模块 {mod_type}")
        if gap.get("has_gap"):
            print(f"  缺口：{gap.get('gap_description', '')}")
        if gap.get("recalled_materials"):
            mats = gap["recalled_materials"]
            print(f"  素材：{', '.join(m['name'] for m in mats[:3])}")

        rewrite_count = 0
        while True:
            materials = recall_materials_by_module(topic, mod_type, vault_path)
            result = generate_single_module(
                topic, mod_type, ccos_outline,
                materials, previous_modules, platform,
                rewrite_count=rewrite_count
            )

            if result["status"] != "success":
                print(f"  [生成失败: {result['status']}]")
                break

            print(f"\n  【{mod_type} 草稿】")
            print(f"  {result['draft'][:500]}")
            if len(result['draft']) > 500:
                print(f"  ...(共 {len(result['draft'])} 字)")

            # 询问用户
            if rewrite_count >= 2:
                print("  [已达最大重写次数，建议手动修改]")
                action = input("  操作：[回车]确认 [e]编辑 [r]重写 → ").strip().lower()
            else:
                action = input("  操作：[回车]确认 [r]重写 [e]编辑 → ").strip().lower()

            if action == "q":
                print("\n退出。已确认模块：", [m["module"] for m in confirmed_modules])
                return {
                    "status": "interrupted",
                    "topic": topic,
                    "platform": platform,
                    "confirmed_modules": confirmed_modules,
                    "previous_modules": previous_modules
                }
            elif action == "r" and rewrite_count < 2:
                rewrite_count += 1
                continue
            elif action == "e":
                print("  请输入修改后的内容（空行结束输入）：")
                lines = []
                while True:
                    line = input()
                    if line == "":
                        break
                    lines.append(line)
                edited = "\n".join(lines)
                if edited.strip():
                    record_modification(mod_type, result["draft"], edited, platform, topic)
                    result = {**result, "draft": edited, "status": "manually_edited"}
                break
            else:
                # 确认
                record_modification(mod_type, result["draft"], result["draft"], platform, topic)
                break

        confirmed_modules.append(result)
        if result["status"] in ("success", "manually_edited"):
            previous_modules.append(result)

    # 拼接完整草稿
    full_parts = []
    for m in confirmed_modules:
        if m.get("draft"):
            full_parts.append(f"【{m['module']}】\n{m['draft']}")

    print(f"\n{'='*60}")
    print("【完整草稿】")
    print(f"{'='*60}")
    print("\n\n---\n\n".join(full_parts))

    return {
        "status": "completed",
        "topic": topic,
        "platform": platform,
        "confirmed_modules": confirmed_modules,
        "full_draft": "\n\n---\n\n".join(full_parts)
    }


# ============ CLI 入口 ============

def _safe_print(obj: Any) -> None:
    """Windows GBK 安全输出"""
    try:
        text = json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj
        sys.stdout.buffer.write(text.encode("utf-8") + b"\n")
    except Exception as e:
        print(f"[Print Error] {e}", file=sys.stderr)


def _load_ccos_for_topic(topic: str, platform: str) -> Optional[Dict]:
    """从 topic_log.yaml 加载最新的 CCOS 大纲"""
    log_path = Path(__file__).parent.parent / "data" / "topic_log.yaml"
    if not log_path.exists():
        return None

    try:
        import yaml
        with open(log_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not data:
            return None

        # 找最新的有 ccos_outline 的条目
        for entry in reversed(data):
            ccos = entry.get("ccos_outline")
            if ccos:
                # 返回对应平台的 outline
                if platform == "both" and "wechat_cognitive_outline" in ccos:
                    return ccos["wechat_cognitive_outline"]
                elif platform == "wechat" and "wechat_cognitive_outline" in ccos:
                    return ccos["wechat_cognitive_outline"]
                elif platform == "xiaohongshu" and "xiaohongshu_cognitive_outline" in ccos:
                    return ccos["xiaohongshu_cognitive_outline"]
                elif "内容目标" in ccos:
                    return ccos
        return None
    except Exception as e:
        print(f"[Warning] 加载 CCOS 失败: {e}", file=sys.stderr)
        return None


def main():
    if len(sys.argv) < 3:
        _safe_print({
            "error": "用法: python content_generator.py <命令> <标题> [--platform wechat|xiaohongshu]",
            "commands": {
                "generate": "批量生成完整草稿（无交互）",
                "interactive": "逐模块交互生成（确认/重写/编辑）",
                "recall": "测试素材召回",
                "gaps": "测试缺口检测"
            },
            "example": "python content_generator.py interactive 'AI让内容创作更容易' --platform wechat"
        })
        sys.exit(1)

    cmd = sys.argv[1]
    topic = sys.argv[2]
    platform = "wechat"

    for i, arg in enumerate(sys.argv[3:], 3):
        if arg == "--platform" and i < len(sys.argv):
            platform = sys.argv[i]

    if cmd == "generate":
        # 尝试从 topic_log 加载 CCOS 大纲
        ccos_outline = _load_ccos_for_topic(topic, platform)
        if not ccos_outline:
            _safe_print({
                "error": f"未找到命题 '{topic}' 的 CCOS 大纲，请先运行: python prism_os.py ccos '{topic}'",
                "topic": topic,
                "platform": platform
            })
            sys.exit(1)

        result = content_generation_workflow(topic, ccos_outline, platform)
        _safe_print(result)

    elif cmd == "interactive":
        ccos_outline = _load_ccos_for_topic(topic, platform)
        if not ccos_outline:
            print(f"[错误] 未找到命题 '{topic}' 的 CCOS 大纲，请先运行: python prism_os.py ccos '{topic}'")
            sys.exit(1)
        result = interactive_content_generation_workflow(topic, ccos_outline, platform)
        # interactive 函数自己 print 结果，返回 dict 给自动化调用
        _safe_print({"status": result["status"], "topic": topic, "platform": platform})

    elif cmd == "recall":
        # 单独测试素材召回
        module_type = sys.argv[3] if len(sys.argv) > 3 else "CASE"
        materials = recall_materials_by_module(topic, module_type)
        _safe_print({
            "topic": topic,
            "module_type": module_type,
            "materials": materials[:5]
        })

    elif cmd == "gaps":
        # 单独测试缺口检测
        ccos_outline = _load_ccos_for_topic(topic, platform)
        if not ccos_outline:
            _safe_print({"error": "未找到 CCOS 大纲"})
            sys.exit(1)
        gaps = detect_material_gaps(topic, ccos_outline)
        _safe_print({"topic": topic, "gaps": gaps})

    else:
        _safe_print({"error": f"未知命令: {cmd}"})
        sys.exit(1)


if __name__ == "__main__":
    main()

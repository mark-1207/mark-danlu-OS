"""critic 模块：3 种批判分析（刺客/裂缝/数字分身）

来自 PRISM-OS 的核心特性：写完文章后让 AI 自己批判一遍。

- 刺客（Assassin）：反向论证、攻击观点
- 裂缝（Crack）：找出逻辑漏洞和不一致
- 数字分身（Digital Twin）：模拟目标读者反应

输出：list[CritiqueIssue]，每条 issue 含：
- type: "assassin" | "crack" | "twin"
- target_section: 哪个段位
- issue: 简短描述
- suggestion: 改进建议
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class CritiqueIssue:
    type: str  # "assassin" | "crack" | "twin"
    target_section: str
    issue: str
    suggestion: str = ""


# ========== 3 种 critic 的 prompt 模板 ==========


def assassin_prompt(draft_title: str, draft_text: str) -> str:
    """刺客：反向攻击，假设你强烈反对这篇文章"""
    return f"""你是 mark 的"刺客"，强烈反对以下文章。找出最有力的反驳角度。

【标题】
{draft_title}

【文章】
{draft_text[:3000]}

【任务】
作为反对者：你的立场是什么？最强反驳点是什么？作者的逻辑漏洞是什么？

【输出格式】
严格 JSON 数组，每条 {{"type": "assassin", "target_section": "thinking", "issue": "...", "suggestion": "..."}}
不要 markdown 代码块外的内容。
"""


def crack_prompt(draft_title: str, draft_text: str) -> str:
    """裂缝：找出逻辑漏洞和事实不一致"""
    return f"""你是 mark 的"裂缝检查员"，找出以下文章中的逻辑漏洞、事实不一致、论据不充分的地方。

【标题】
{draft_title}

【文章】
{draft_text[:3000]}

【任务】
- 找出 2-3 个具体漏洞（因果倒置/数据无来源/举例片面等）
- 每条指出位置（哪一段）+ 漏洞描述 + 修复建议

【输出格式】
严格 JSON 数组，每条 {{"type": "crack", "target_section": "case", "issue": "...", "suggestion": "..."}}
不要 markdown 代码块外的内容。
"""


def twin_prompt(draft_title: str, draft_text: str, audience: str) -> str:
    """数字分身：模拟目标读者反应"""
    return f"""你是以下目标读者的"数字分身"，模拟你读这篇文章的反应：

【目标读者】
{audience}

【文章】
标题：{draft_title}
正文：{draft_text[:3000]}

【任务】
- 你看完会不会转发？为什么？
- 你会质疑哪一点？
- 你会觉得哪里"假"或"装"？
- 哪个段落最打动你？

【输出格式】
严格 JSON 数组，每条 {{"type": "twin", "target_section": "hook", "issue": "...", "suggestion": "..."}}
不要 markdown 代码块外的内容。
"""


def parse_critique_response(raw: str, critic_type: str) -> list[CritiqueIssue]:
    """解析 LLM 返回的 critique JSON（容错：markdown / 字段缺失）"""
    text = raw.strip()
    if text.startswith("```"):
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```$", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    raw_issues = data if isinstance(data, list) else data.get("issues", [])
    if not isinstance(raw_issues, list):
        return []
    out: list[CritiqueIssue] = []
    for item in raw_issues:
        if isinstance(item, dict):
            out.append(
                CritiqueIssue(
                    type=str(item.get("type", critic_type)),
                    target_section=str(item.get("target_section", "thinking")),
                    issue=str(item.get("issue", "")).strip(),
                    suggestion=str(item.get("suggestion", "")).strip(),
                )
            )
    return out


def run_assassin(
    draft_title: str,
    draft_text: str,
    llm_call: Callable[[str], str],
) -> list[CritiqueIssue]:
    return parse_critique_response(
        llm_call(assassin_prompt(draft_title, draft_text)),
        "assassin",
    )


def run_crack(
    draft_title: str,
    draft_text: str,
    llm_call: Callable[[str], str],
) -> list[CritiqueIssue]:
    return parse_critique_response(
        llm_call(crack_prompt(draft_title, draft_text)),
        "crack",
    )


def run_twin(
    draft_title: str,
    draft_text: str,
    audience: str,
    llm_call: Callable[[str], str],
) -> list[CritiqueIssue]:
    return parse_critique_response(
        llm_call(twin_prompt(draft_title, draft_text, audience)),
        "twin",
    )


def run_all_critics(
    draft_title: str,
    draft_text: str,
    audience: str,
    llm_call: Callable[[str], str],
) -> list[CritiqueIssue]:
    """运行 3 种 critic 并合并（每种 1 次 LLM 调用）"""
    issues: list[CritiqueIssue] = []
    issues.extend(run_assassin(draft_title, draft_text, llm_call))
    issues.extend(run_crack(draft_title, draft_text, llm_call))
    issues.extend(run_twin(draft_title, draft_text, audience, llm_call))
    return issues


__all__ = [
    "CritiqueIssue",
    "assassin_prompt",
    "crack_prompt",
    "parse_critique_response",
    "run_all_critics",
    "run_assassin",
    "run_crack",
    "run_twin",
    "twin_prompt",
]

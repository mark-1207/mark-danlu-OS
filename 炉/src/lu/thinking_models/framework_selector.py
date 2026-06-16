"""framework_selector: 关键词匹配选思想模型框架

v1 不依赖 LLM，纯关键词匹配：
- 按注册表顺序遍历 framework
- 任一 trigger_keywords 命中即返回（first match wins）
- 全部不命中 → 默认 problem_decomposition
"""
from __future__ import annotations

from lu.thinking_models.registry import Framework, FrameworkRegistry


DEFAULT_FRAMEWORK_ID = "problem_decomposition"


def select_framework(proposition: str, registry: FrameworkRegistry) -> Framework:
    for fw in registry:
        for kw in fw.trigger_keywords:
            if kw in proposition:
                return fw
    return registry.get(DEFAULT_FRAMEWORK_ID)

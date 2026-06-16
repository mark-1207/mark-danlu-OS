#!/usr/bin/env python3
"""
PRISM-OS 人设持久化模块

从 data/personas.yaml 加载静态人设，提供 4 个 phase 的格式化注入接口。
维度偏好（dimension_weights）仍走历史学习，不在本模块管。
"""
import sys
import os
import yaml
from pathlib import Path
from typing import Dict, List, Optional


class PersonaNotFoundError(Exception):
    """请求的人设名不存在"""
    pass


class PersonaValidationError(Exception):
    """人设 YAML 格式错误或缺必需字段"""
    pass


# 必需字段（启动时校验）
REQUIRED_FIELDS = ("identity_role", "audience")


def _persona_yaml_path() -> Path:
    """定位 data/personas.yaml（独立函数便于测试 mock）"""
    return Path(__file__).resolve().parent.parent / "data" / "personas.yaml"


def load(name: str = "default") -> Dict:
    """
    加载人设。

    优先级：data/personas.yaml > user_config.yaml 兜底 > 硬编码空 persona
    """
    yaml_path = _persona_yaml_path()

    if yaml_path.exists():
        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise PersonaValidationError(f"personas.yaml 解析失败: {e}")

        if not isinstance(data, dict):
            raise PersonaValidationError("personas.yaml 顶层必须是 mapping")

        if name not in data:
            if name == "default" and data:
                # default 不在但有别的 → 取第一个
                first_key = next(iter(data))
                print(f"[Warning] 'default' persona 不存在，回退到 '{first_key}'", file=sys.stderr)
                return data[first_key]
            raise PersonaNotFoundError(f"persona '{name}' 不存在")

        persona = data[name]
        if not isinstance(persona, dict):
            raise PersonaValidationError(f"persona '{name}' 必须是 mapping")
        return persona

    # YAML 不存在：尝试 user_config 兜底
    fallback = _load_from_user_config()
    if fallback:
        print(f"[Warning] personas.yaml 不存在，使用 user_config.yaml 兜底", file=sys.stderr)
        return fallback

    # 都没有：返回空 persona（必需字段缺失由 validate 报错）
    return {}


def _load_from_user_config() -> Optional[Dict]:
    """从 user_config.yaml 加载兜底人设"""
    try:
        import yaml
        config_path = Path(__file__).resolve().parent.parent / "config" / "user_config.yaml"
        if not config_path.exists():
            return None
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        digital_twin = cfg.get("digital_twin", {})
        tp = digital_twin.get("thinking_pattern", "")
        return {
            "identity_role": tp,
            "audience": "",
            "tone_keywords": ["犀利", "理性", "深刻", "克制"] if tp else [],
            "style_mentors": [],
            "style_keywords": [],
            "avoid_keywords": [],
            "topic_domains": [],
        }
    except Exception:
        return None


def list_names() -> List[str]:
    """列出 personas.yaml 中所有可用人设名"""
    yaml_path = _persona_yaml_path()
    if not yaml_path.exists():
        return []
    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return [k for k, v in data.items() if isinstance(v, dict)]
    except Exception:
        return []


def validate(persona: Dict) -> List[str]:
    """
    验证人设字段完整性，返回缺失字段列表（空列表=通过）。
    """
    missing = [f for f in REQUIRED_FIELDS if not persona.get(f)]
    return missing


def format_for_prism(persona: Dict) -> Dict:
    """
    提取 prism prompt 注入所需字段。
    返回 {identity_role, audience, tone_keywords, style_keywords, avoid_keywords}
    """
    return {
        "identity_role": persona.get("identity_role", ""),
        "audience": persona.get("audience", ""),
        "tone_keywords": persona.get("tone_keywords", []),
        "style_keywords": persona.get("style_keywords", []),
        "avoid_keywords": persona.get("avoid_keywords", []),
    }


def format_for_ccos(persona: Dict) -> Dict:
    """
    提取 CCOS Layer 7 作者性注入所需字段。
    映射到 {认知倾向, 表达气质, 价值倾向, 长期母题}
    """
    style_kws = persona.get("style_keywords", [])
    tone_kws = persona.get("tone_keywords", [])
    style_mentors = persona.get("style_mentors", [])
    value_increments = persona.get("value_increments", [])

    # 表达气质：tone + style_mentors
    if style_mentors:
        表达气质 = "参考" + "、".join(style_mentors) + "风格"
    else:
        表达气质 = "、".join(tone_kws) if tone_kws else "理性深刻"

    # 认知倾向：从 style_keywords 提取
    if style_kws:
        认知倾向 = style_kws[0]
    else:
        认知倾向 = "分析优先"

    # 价值倾向：从 value_increments 提取
    if value_increments:
        价值倾向 = value_increments[0]
    else:
        价值倾向 = "独立思考"

    # 长期母题：style_keywords 前 3 + topic_domains 前 1
    long_term = []
    if style_kws:
        long_term.extend(style_kws[:3])
    domains = persona.get("topic_domains", [])
    if domains:
        long_term.append(domains[0])
    长期母题 = "、".join(long_term) if long_term else "认知升级"

    return {
        "认知倾向": 认知倾向,
        "表达气质": 表达气质,
        "价值倾向": 价值倾向,
        "长期母题": 长期母题,
    }


def format_for_twin(persona: Dict) -> Dict:
    """
    提取 twin 筛选权重所需字段。
    返回 {topic_domains, style_keywords, tone_keywords}
    """
    return {
        "topic_domains": persona.get("topic_domains", []),
        "style_keywords": persona.get("style_keywords", []),
        "tone_keywords": persona.get("tone_keywords", []),
    }


def format_for_narrate(persona: Dict, platform: str = "wechat") -> Dict:
    """
    提取 narrate 风格约束所需字段。
    根据 platform 选择 platform_preference。
    """
    platform_pref = persona.get("platform_preference", {})
    style_pref = platform_pref.get(platform, "")

    return {
        "tone_keywords": persona.get("tone_keywords", []),
        "avoid_keywords": persona.get("avoid_keywords", []),
        "style_keywords": persona.get("style_keywords", []),
        "platform_preference": style_pref,
        "topic_domains": persona.get("topic_domains", []),
    }


def get_topic_domains(persona: Dict) -> List[str]:
    """便利函数：获取 topic_domains 列表"""
    return persona.get("topic_domains", [])


def is_in_domain(text: str, persona: Dict) -> bool:
    """
    便利函数：判断文本是否在 persona 的 topic_domains 内（粗略关键词匹配）。
    """
    domains = get_topic_domains(persona)
    if not domains:
        return True  # 无领域限制 → 全部算
    return any(d in text for d in domains)


if __name__ == "__main__":
    # 简单 CLI 验证
    p = load("default")
    print(f"identity_role: {p.get('identity_role', '?')[:50]}...")
    print(f"audience: {p.get('audience', '?')[:50]}...")
    print(f"missing: {validate(p)}")

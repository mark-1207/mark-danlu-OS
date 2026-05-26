#!/usr/bin/env python3
"""
PRISM-OS LLM 调用脚本
支持 Kimi → Gateway → OpenRouter 三级 fallback

模型优先级：
- Kimi: 主路径，场景动态选择 8k/32k/128k
- Gateway: 备用（免费模型，当前服务不可用）
- OpenRouter: 最终降级（free 模型，自动从 API 刷新）

模型刷新：
  refresh_openrouter_models() 每 10 分钟缓存一次，
  规则：prompt_price=0 且 ctx>=32k，按 ctx 降序排列。

用法: python call_llm.py '<prompt>'
"""

import sys
import json
import os
import time
import ssl
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple
from pathlib import Path

# ============ .env 自动加载（兼容跨机器迁移）============
# 在 key 文件旁边放 .env 文件，自动读取
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

# ============ API Keys & Endpoints ============

# Kimi (Moonshot) - 优先付费
KIMI_API_KEY = os.environ.get("KIMI_API_KEY", "")
KIMI_API_URL = "https://api.moonshot.cn/v1/chat/completions"

# OpenRouter 备用付费
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Kimi 模型场景映射（已验证可用）
KIMI_MODEL_MAP = {
    "reasoning": "moonshot-v1-128k",    # 推理思考（kimi-k2.6 不可用）
    "quality": "moonshot-v1-128k",      # 高质量
    "writing-cn": "moonshot-v1-128k",   # 中文写作
    "writing-en": "moonshot-v1-128k",   # 英文写作
    "translation": "moonshot-v1-128k",  # 翻译
    "fast": "moonshot-v1-32k",          # 快速
    "long-context": "moonshot-v1-128k", # 超长文本
    "summary": "moonshot-v1-128k",      # 总结
    "extraction": "moonshot-v1-128k",   # 提炼
    "multimodal": "moonshot-v1-128k-vision-preview",  # 图片理解
}

# Kimi 场景 → max_tokens 映射（按需分配，控制成本）
KIMI_MAX_TOKENS_MAP = {
    "reasoning": 8192,      # 推理思考，短回复
    "quality": 16384,       # 高质量，中等长度
    "writing-cn": 16384,    # 中文写作
    "writing-en": 16384,   # 英文写作
    "translation": 8192,    # 翻译
    "fast": 4096,           # 快速，短回复
    "long-context": 128000, # 超长文本
    "summary": 8192,        # 总结
    "extraction": 8192,     # 提炼
    "multimodal": 8192,     # 图片理解
}

# OpenRouter 备用模型（当 Kimi 失败时）
# 优先级规则：free > cheap > fast，context_length >= 32k
# 动态从 OpenRouter API 获取，可通过 refresh_openrouter_models() 更新

# 默认兜底模型（API 不可用时使用）
OPENROUTER_FALLBACK_MODELS = [
    "openrouter/owl-alpha",           # 1M ctx, free, 快
    "google/gemma-4-26b-a4b-it:free",  # 262k ctx, free
    "qwen/qwen3-coder:free",           # 262k ctx, free, 编程强
]

# 缓存的模型列表（通过 refresh_openrouter_models 更新）
_openrouter_cached_models: List[str] = []


def refresh_openrouter_models(force: bool = False) -> List[str]:
    """
    从 OpenRouter API 获取可用模型，缓存 free/low-cost 模型列表。
    规则：prompt_price = 0（免费）且 context_length >= 32k，按 ctx 降序排列。

    Args:
        force: True 则强制刷新，False 则用缓存（缓存10分钟有效）

    Returns:
        可用模型 ID 列表
    """
    global _openrouter_cached_models

    # 10分钟缓存
    cache_key = "_openrouter_models_cache_time"
    cache_time = getattr(refresh_openrouter_models, cache_key, 0)
    if not force and _openrouter_cached_models and (time.time() - cache_time < 600):
        return _openrouter_cached_models

    print(f"[OpenRouter] 获取模型列表...", file=sys.stderr)
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        models = data.get("data", [])
        candidates = []

        for m in models:
            price = m.get("pricing", {})
            p_prompt = float(price.get("prompt", -1) or -1)
            ctx = m.get("context_length", 0) or 0
            model_id = m.get("id", "")

            # 规则：免费 + ctx >= 32k
            if p_prompt == 0 and ctx >= 32768:
                candidates.append(model_id)

        # 按模型名排序（稳定顺序）
        candidates.sort()
        _openrouter_cached_models = candidates

        # 更新时间戳
        setattr(refresh_openrouter_models, cache_key, time.time())

        print(f"[OpenRouter] 发现 {len(candidates)} 个符合条件的模型", file=sys.stderr)
        if candidates:
            print(f"[OpenRouter] Top 3: {candidates[:3]}", file=sys.stderr)
        return candidates

    except Exception as e:
        print(f"[OpenRouter] 获取模型列表失败: {e}，使用缓存", file=sys.stderr)
        # 失败时返回默认列表（不爆错）
        return _openrouter_cached_models or OPENROUTER_FALLBACK_MODELS


def get_openrouter_models() -> List[str]:
    """获取当前缓存的 OpenRouter 模型列表"""
    cached = refresh_openrouter_models()
    return cached if cached else OPENROUTER_FALLBACK_MODELS


# ============ 配置加载 ============

def load_config() -> Dict:
    """加载 Gateway 配置"""
    url = os.environ.get("LLM_API_URL", "http://localhost:3000/v1/chat/completions")
    key = os.environ.get("GATEWAY_AUTH_KEY", os.environ.get("LLM_API_KEY", ""))
    return {
        "llm_api_url": url,
        "llm_api_key": key
    }


def get_scene() -> str:
    """获取当前场景"""
    return os.environ.get("GATEWAY_SCENE", "")


def get_kimi_model(scene: str) -> str:
    """根据场景获取 Kimi 模型"""
    return KIMI_MODEL_MAP.get(scene, "moonshot-v1-128k")


def get_kimi_max_tokens(scene: str) -> int:
    """根据场景获取 Kimi 最大 token 数"""
    return KIMI_MAX_TOKENS_MAP.get(scene, 8192)


# ============ Kimi API 调用 ============

def call_kimi(prompt: str, model: str = "kimi-k2", temperature: float = 0.7, max_tokens: int = 4096) -> Dict:
    """
    调用 Kimi (Moonshot) API

    Args:
        prompt: 提示词
        model: Kimi 模型名
        temperature: 温度
        max_tokens: 最大 tokens

    Returns:
        {"content": str, "error": str|null, "model": str, "provider": str}
    """
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {KIMI_API_KEY}"
    }

    req = urllib.request.Request(
        KIMI_API_URL,
        data=data,
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {
                "content": content,
                "error": None,
                "model": model,
                "provider": "kimi",
                "via_backup": True
            }
    except urllib.error.HTTPError as e:
        return {
            "content": None,
            "error": f"HTTP {e.code}: {e.reason}",
            "model": model,
            "provider": "kimi"
        }
    except Exception as e:
        return {
            "content": None,
            "error": str(e),
            "model": model,
            "provider": "kimi"
        }


# ============ OpenRouter API 调用 ============

def call_openrouter(prompt: str, model: str = "google/gemini-2.0-flash-exp", temperature: float = 0.7) -> Dict:
    """
    调用 OpenRouter API（SSL 问题绕过）

    Args:
        prompt: 提示词
        model: OpenRouter 模型名
        temperature: 温度

    Returns:
        {"content": str, "error": str|null, "model": str, "provider": str}
    """
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": 4096
    }

    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}"
    }

    # 创建 SSL 上下文绕过证书问题
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        OPENROUTER_API_URL,
        data=data,
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, context=ssl_context, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {
                "content": content,
                "error": None,
                "model": model,
                "provider": "openrouter",
                "via_backup": True
            }
    except Exception as e:
        return {
            "content": None,
            "error": str(e),
            "model": model,
            "provider": "openrouter"
        }


# ============ Gateway API 调用 ============

def call_gateway(prompt: str, temperature: float = 0.7) -> Dict:
    """
    调用 Gateway（主路径，免费模型）

    Returns:
        {"content": str, "error": str|null, "via_backup": bool}
    """
    config = load_config()

    if not config["llm_api_url"] or not config["llm_api_key"]:
        return {
            "content": None,
            "error": "Gateway 未配置",
            "via_backup": True
        }

    payload = {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature
    }

    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config['llm_api_key']}"
    }
    scene = get_scene()
    if scene:
        headers["X-Gateway-Scene"] = scene

    req = urllib.request.Request(
        config["llm_api_url"],
        data=data,
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"content": content, "error": None, "via_backup": False}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        return {
            "content": None,
            "error": f"HTTP {e.code}: {e.reason} | body: {body[:500]}",
            "via_backup": False
        }
    except Exception as e:
        return {
            "content": None,
            "error": str(e),
            "via_backup": True  # 超时/网络错误切备用
        }


# ============ 日志配置 ============

import datetime

LOGS_DIR = Path(__file__).parent.parent.parent / ".claude" / "logs"
LLM_CALL_LOG = LOGS_DIR / "llm_call_log.json"


def _ensure_logs_dir():
    """确保 logs 目录存在"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


def _load_call_log() -> list:
    """加载调用日志"""
    _ensure_logs_dir()
    if LLM_CALL_LOG.exists():
        try:
            return json.loads(LLM_CALL_LOG.read_text(encoding="utf-8")).get("logs", [])
        except:
            return []
    return []


def _save_call_log(logs: list) -> bool:
    """保存调用日志"""
    try:
        _ensure_logs_dir()
        LLM_CALL_LOG.write_text(
            json.dumps({"logs": logs, "last_updated": datetime.datetime.now().isoformat()}, ensure_ascii=False),
            encoding="utf-8"
        )
        return True
    except Exception as e:
        print(f"[Error] 保存调用日志失败: {e}", file=sys.stderr)
        return False


def _log_llm_call(
    scene: str,
    duration_ms: int,
    status: str,
    provider: str,
    model: str,
    error: str = None,
    tokens: dict = None
) -> bool:
    """
    记录 LLM 调用到日志

    Args:
        scene: 场景
        duration_ms: 耗时（毫秒）
        status: success/timeout/error
        provider: gateway/kimi/openrouter
        model: 模型名
        error: 错误信息
        tokens: {"prompt": int, "completion": int, "total": int}

    Returns:
        bool: 是否成功
    """
    log_entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scene": scene,
        "duration_ms": duration_ms,
        "status": status,
        "provider": provider,
        "model": model,
        "error": error,
        "tokens": tokens
    }

    logs = _load_call_log()
    logs.append(log_entry)

    # 只保留最近 1000 条
    if len(logs) > 1000:
        logs = logs[-1000:]

    return _save_call_log(logs)


# ============ 响应验证 ============

def _validate_response(result: dict, provider: str) -> Tuple[bool, str]:
    """
    验证 LLM 响应格式

    Args:
        result: API 返回的原始 dict
        provider: 提供商

    Returns:
        (是否有效, 错误信息)
    """
    if not isinstance(result, dict):
        return False, f"响应不是 dict 类型: {type(result)}"

    # 检查 choices 字段
    choices = result.get("choices", [])
    if not choices:
        return False, "响应缺少 choices 字段"

    if not isinstance(choices, list):
        return False, f"choices 不是列表: {type(choices)}"

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return False, f"choices[0] 不是 dict: {type(first_choice)}"

    # 检查 message 字段
    message = first_choice.get("message", {})
    if not isinstance(message, dict):
        return False, f"message 不是 dict: {type(message)}"

    # 检查 content 字段
    content = message.get("content")
    if content is None:
        return False, "message.content 为 None"

    if not isinstance(content, str):
        return False, f"content 不是字符串: {type(content)}"

    # 检查 finish_reason
    finish_reason = first_choice.get("finish_reason")
    if finish_reason and finish_reason not in ["stop", "length"]:
        return False, f"非标准 finish_reason: {finish_reason}"

    return True, ""


# ============ 超时配置 ============

DEFAULT_TIMEOUT = 30  # 默认 30 秒


# ============ 重试配置 ============

def _retry_with_backoff(fn, max_retries: int = 2, initial_delay: float = 1.0) -> Dict:
    """
    指数退避重试

    Args:
        fn: 要重试的函数
        max_retries: 最大重试次数
        initial_delay: 初始延迟（秒）

    Returns:
        函数结果
    """
    delay = initial_delay

    for attempt in range(max_retries + 1):
        result = fn()
        if result.get("error") is None:
            return result

        if attempt < max_retries:
            print(f"[重试] {attempt + 1}/{max_retries} 失败，{delay}s 后重试...", file=sys.stderr)
            time.sleep(delay)
            delay *= 2  # 指数退避：1s, 2s

    return result


# ============ 结构化错误 ============

def _make_structured_error(provider: str, error: str, retry_count: int = 0) -> Dict:
    """
    生成结构化错误

    Returns:
        包含 error_type, error_message, retryable, provider 的 dict
    """
    error_type = "unknown"
    retryable = False

    if any(x in error.lower() for x in ["timeout", "timed out"]):
        error_type = "timeout"
        retryable = True
    elif "http 500" in error.lower() or "internal" in error.lower():
        error_type = "server_error"
        retryable = True
    elif "http 4" in error.lower():
        error_type = "client_error"
        retryable = False
    elif "connection" in error.lower():
        error_type = "network"
        retryable = True

    return {
        "content": None,
        "error": error,
        "error_type": error_type,
        "retryable": retryable,
        "retry_count": retry_count,
        "provider": provider,
        "model": "none"
    }


# ============ 错误可重试性判断 ============

def _is_retryable_error(error: str) -> bool:
    """
    判断 LLM 错误是否可重试

    可重试：timeout、connection、network、SSL、502/503/504
    不可重试：401 Unauthorized、403 Forbidden、400 Bad Request（请求本身有问题）
    """
    error_lower = error.lower()
    if any(x in error_lower for x in ["http 401", "http 403", "unauthorized", "forbidden", "bad request", "invalid request"]):
        return False
    if any(x in error_lower for x in ["timeout", "connection", "network", "ssl", "temporary", "502", "503", "504", "reset", "refused"]):
        return True
    return True  # 默认可重试


def _call_with_retry(fn, prompt: str, *args, max_retries: int = 2, initial_delay: float = 1.0, **kwargs) -> Dict:
    """
    带指数退避重试的 provider 调用

    Args:
        fn: 要重试的函数 (prompt, *args, **kwargs) -> result_dict
        prompt: 提示词
        max_retries: 最大重试次数
        initial_delay: 初始延迟（秒）

    Returns:
        函数结果（成功或最终失败）
    """
    delay = initial_delay
    last_result = None

    for attempt in range(max_retries + 1):
        result = fn(prompt, *args, **kwargs)
        last_result = result

        if result.get("error") is None:
            return result  # 成功

        error = result.get("error", "")
        if not _is_retryable_error(error):
            # 不可重试的错误（如 401），直接返回
            return result

        if attempt < max_retries:
            print(f"[重试] {attempt + 1}/{max_retries} 失败，{delay}s 后重试... ({error[:50]})", file=sys.stderr)
            time.sleep(delay)
            delay *= 2  # 指数退避

    return last_result  # 返回最后一次结果


# ============ 主调用函数 ============

def call_llm(prompt: str, model: str = "gpt-4", temperature: float = 0.7) -> Dict:
    """
    三级 fallback 调用（Kimi 优先，Gateway/OpenRouter 降级）：
    1. Kimi (付费) — 主路径，按场景动态选择 8k/32k/128k
    2. Gateway (免费模型) — 备用
    3. OpenRouter (付费备用) — 最终降级

    所有 provider 失败即止，不重试。

    Args:
        prompt: 提示词
        model: 模型名（仅用于 Gateway）
        temperature: 温度

    Returns:
        {"content": str, "error": str|null, "model": str, "provider": str, "via_backup": bool}
    """
    scene = get_scene()
    start_time = time.time()

    # Step 1: Kimi (主路径，场景动态模型，带重试)
    kimi_model = get_kimi_model(scene)
    kimi_max_tokens = get_kimi_max_tokens(scene)
    print(f"[Kimi] {kimi_model}({kimi_max_tokens})...", file=sys.stderr)
    result = _call_with_retry(call_kimi, prompt, kimi_model, temperature, kimi_max_tokens, max_retries=2)
    duration_ms = int((time.time() - start_time) * 1000)
    _log_llm_call(scene, duration_ms, "success" if result["error"] is None else "error",
                   "kimi", kimi_model, result.get("error"))
    if result["error"] is None:
        return result

    kimi_error = result["error"]
    print(f"[Kimi] 失败: {kimi_error}", file=sys.stderr)

    # Step 2: Gateway (免费模型，Kimi 失败后尝试，带重试)
    print(f"[Gateway] 尝试...", file=sys.stderr)
    result = _call_with_retry(call_gateway, prompt, temperature, max_retries=2)
    duration_ms = int((time.time() - start_time) * 1000)
    _log_llm_call(scene, duration_ms, "success" if result["error"] is None else "error",
                   "gateway", model, result.get("error"))
    if result["error"] is None:
        result["model"] = scene or "gateway"
        result["provider"] = "gateway"
        return result

    gw_error = result["error"]
    print(f"[Gateway] 失败: {gw_error}", file=sys.stderr)

    # Step 3: OpenRouter 最终降级（使用动态模型列表，带重试）
    for or_model in get_openrouter_models():
        print(f"[OpenRouter] {or_model}...", file=sys.stderr)
        result = _call_with_retry(call_openrouter, prompt, or_model, temperature, max_retries=2)
        duration_ms = int((time.time() - start_time) * 1000)
        _log_llm_call(scene, duration_ms, "success" if result["error"] is None else "error",
                       "openrouter", or_model, result.get("error"))
        if result["error"] is None:
            return result
        print(f"[OpenRouter] 失败: {result['error']}", file=sys.stderr)

    return _make_structured_error("none", f"所有 provider 都失败: {kimi_error}")


# ============ CLI 入口 ============

def main():
    # 启动时刷新 OpenRouter 模型列表
    refresh_openrouter_models()
    print(f"[OpenRouter] 当前模型: {get_openrouter_models()[:3]}...", file=sys.stderr)

    if len(sys.argv) < 2:
        print(json.dumps({"error": "用法: python call_llm.py '<prompt>'"}))
        sys.exit(1)

    prompt = sys.argv[1]
    result = call_llm(prompt)

    # 输出（修复 Windows GBK 编码）
    output = json.dumps(result, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")


if __name__ == "__main__":
    main()
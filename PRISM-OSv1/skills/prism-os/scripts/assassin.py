#!/usr/bin/env python3
"""
PRISM-OS Phase 7: 刺客机制 & 知识拓扑
历史爆款逻辑反转 + 认知地图构建

用法:
    python assassin.py reverse "<历史爆款标题>"
    python assassin.py topology "<实体统计>" "<关系统计>"
"""

import sys
import json
import os
import re
from typing import Dict, List, Optional
from datetime import datetime

# ============ lark-cli 工具函数 ============

def _verify_lark_cli():
    """验证 lark-cli 是否在 PATH 中"""
    import shutil
    if not shutil.which("lark-cli"):
        print("[Error] lark-cli not found in PATH. Please install: npm install -g @larksuite/cli", file=sys.stderr)
        sys.exit(1)


def _run_lark_cli(args: list, timeout: int = 30) -> tuple:
    """运行 lark-cli 命令，返回 (stdout, stderr, returncode)"""
    import shutil
    import subprocess
    _verify_lark_cli()
    lark_path = shutil.which("lark-cli")
    result = subprocess.run(
        [lark_path] + args,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout
    )
    return result.stdout, result.stderr, result.returncode


def _parse_lark_text_output(text: str) -> List[Dict]:
    """从 lark-cli 纯文本输出中提取记录（备用）"""
    import re
    records = []
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("-"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 4:
            records.append({
                "title": parts[0],
                "date": parts[1] if len(parts) > 1 else "",
                "views": int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0,
                "likes": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 0,
                "direction": parts[4] if len(parts) > 4 else "",
                "record_id": ""
            })
    return records


# ============ 阶段 4: 飞书多维表格集成 ============

FEISHU_TABLE_ID = "tblOoR71Q3DSa33t"
FEISHU_APP_TOKEN = "QVz9byNH0auzRis9KeDcUoe3nZf"  # 示例 token


def read_viral_library() -> List[Dict]:
    """
    4.1 从飞书多维表格读取历史爆款

    Returns:
        [{"title": str, "date": str, "views": int, "likes": int, "direction": str, "record_id": str}, ...]
    """
    import urllib.parse
    try:
        # lark-cli api GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
        path = f"/open-apis/bitable/v1/apps/{FEISHU_APP_TOKEN}/tables/{FEISHU_TABLE_ID}/records"
        params = '{"page_size": 100}'
        stdout, stderr, returncode = _run_lark_cli([
            "api", "GET", path,
            "--params", params,
            "--format", "json"
        ])
    except Exception as e:
        print(f"[Warning] lark-cli 调用失败: {e}")
        return []

    if returncode != 0:
        print(f"[Warning] lark-cli 返回错误: {stderr}")
        return []

    # 尝试 JSON 解析
    try:
        data = json.loads(stdout)
        if isinstance(data, dict) and "data" in data:
            records = data["data"].get("items", [])
            return [
                {
                    "title": r.get("fields", {}).get("标题", ""),
                    "date": r.get("fields", {}).get("日期", ""),
                    "views": r.get("fields", {}).get("浏览量", 0),
                    "likes": r.get("fields", {}).get("点赞数", 0),
                    "direction": r.get("fields", {}).get("方向", ""),
                    "record_id": r.get("record_id", "")
                }
                for r in records
            ]
        return []
    except json.JSONDecodeError:
        pass

    # 备用：解析纯文本输出
    return _parse_lark_text_output(stdout)


def check_data_threshold(viral_data: List[Dict], min_count: int = 20) -> bool:
    """
    4.2 检查是否 >= 20 篇发布数据

    Args:
        viral_data: 历史爆款数据
        min_count: 最小数量要求

    Returns:
        bool: 是否满足阈值
    """
    return len(viral_data) >= min_count


def check_cooldown(last_reminder_time: str = None, days: int = 30) -> bool:
    """
    4.3 检查距上次提醒是否 >30 天

    Args:
        last_reminder_time: 上次提醒时间 (ISO 格式)
        days: cooldown 天数

    Returns:
        bool: True 表示在 cooldown 中
    """
    if not last_reminder_time:
        return False

    try:
        from datetime import datetime, timedelta
        last_time = datetime.fromisoformat(last_reminder_time)
        return datetime.now() - last_time < timedelta(days=days)
    except:
        return False


def build_reminder_message(reversals: List[Dict], viral_data: List[Dict]) -> str:
    """
    4.7 生成刺客提醒消息

    Args:
        reversals: 反转结果列表
        viral_data: 历史爆款数据

    Returns:
        str: 格式化提醒消息
    """
    lines = []
    lines.append("━" * 40)
    lines.append("【PRISM-OS 刺客提醒】")
    lines.append("━" * 40)
    lines.append("")
    lines.append(f"检测到 {len(viral_data)} 篇历史爆款，可以进行逻辑反转！")
    lines.append("")

    if reversals:
        lines.append("推荐反转方向：")
        for i, r in enumerate(reversals[:3], 1):
            lines.append(f"  {i}. {r.get('original_thesis', '')}")
            lines.append(f"     → {r.get('reversal_thesis', '')}")
            lines.append(f"     策略: {r.get('reversal_strategy', '')}")
            lines.append("")

    lines.append("是否要基于这些反转生成新标题？（yes/no）")
    lines.append("━" * 40)

    return "\n".join(lines)


def update_feishu_viral(viral_title: str, reversal_info: Dict = None) -> bool:
    """
    4.6 写入是否已反转/反转策略到飞书

    Args:
        viral_title: 爆款标题
        reversal_info: 反转信息

    Returns:
        bool: 是否成功
    """
    # TODO: 实现飞书 API 写入
    print(f"[Warning] 飞书写入需要配置 lark-oapi credentials")
    print(f"  标题: {viral_title}")
    if reversal_info:
        print(f"  反转: {reversal_info.get('reversal_thesis', '')}")
        print(f"  策略: {reversal_info.get('reversal_strategy', '')}")
    return False


def log_material_source(title: str, material_source: str) -> bool:
    """
    2.23 写入素材来源到飞书备注

    Args:
        title: 标题
        material_source: 素材来源路径

    Returns:
        bool: 是否成功
    """
    # TODO: 实现飞书备注写入
    print(f"[Material Source] {title} -> {material_source}")
    return False


# ============ Phase 7: 刺客机制 ============

def reverse_topic(historical_topic: str, publish_date: str = "") -> Dict:
    """
    对历史爆款选题进行"逻辑反转"

    Args:
        historical_topic: 历史爆款选题
        publish_date: 发布时间（可选）

    Returns:
        {
            "original_thesis": str,
            "reversal_thesis": str,
            "reversal_strategy": str,
            "new_evidence": [...],
            "cognitive_shift": str,
            "challenge_level": float
        }
    """
    current_date = datetime.now().strftime("%Y-%m-%d")
    prompt = f"""你是认知刺客。你的任务是对历史爆款选题进行"逻辑反转"，强制创作者否定旧观点。

历史爆款选题：{historical_topic}
{f"发布时间：{publish_date}" if publish_date else ""}
当前时间：{current_date}

反转策略：
1. 前提质疑：挑战隐含假设
2. 数据更新：用新数据推翻旧结论
3. 视角切换：从另一个群体审视
4. 时效性挑战：用时间维度挑战命题

返回 JSON：
{{
  "original_thesis": "原命题",
  "reversal_thesis": "反转后命题",
  "reversal_strategy": "前提质疑/数据更新/视角切换/时效性挑战",
  "new_evidence": ["新证据1", "新证据2"],
  "cognitive_shift": "认知转变说明",
  "challenge_level": 0.0-1.0
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "original_thesis": historical_topic,
            "reversal_thesis": "",
            "reversal_strategy": "",
            "new_evidence": [],
            "cognitive_shift": "",
            "challenge_level": 0.0
        }

    parsed = _parse_llm_json(result)
    if not parsed:
        return {
            "original_thesis": historical_topic,
            "reversal_thesis": "",
            "reversal_strategy": "",
            "new_evidence": [],
            "cognitive_shift": "",
            "challenge_level": 0.0
        }

    return parsed


# ============ Phase 7: 知识拓扑 ============

def analyze_knowledge_topology(entities: List[Dict], relations: List[Dict]) -> Dict:
    """
    构建认知地图，标注过度开发区和未触及区

    Args:
        entities: 实体统计 [{"entity": str, "count": int}]
        relations: 关系统计 [{"relation": str, "count": int}]

    Returns:
        {
            "over_explored": [...],
            "under_explored": [...]
        }
    """
    entities_str = ", ".join([f"{e['entity']}({e.get('count', 0)}次)" for e in entities]) if entities else "无"
    relations_str = ", ".join([f"{r['relation']}({r.get('count', 0)}次)" for r in relations]) if relations else "无"

    prompt = f"""你是认知地图分析师。基于实体关系图谱，标注认知开发区域。

实体统计：{entities_str}
关系统计：{relations_str}

定义：
- 过度开发区：该实体/关系出现频率过高，可能导致思维定势
- 未触及区：该实体/关系从未或很少出现，可能是认知盲区

返回 JSON：
{{
  "over_explored": [
    {{"entity": "实体名", "reason": "出现频率过高", "suggestion": "探索其他领域"}}
  ],
  "under_explored": [
    {{"entity": "实体名", "reason": "从未出现", "suggestion": "可作为新选题方向"}}
  ]
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "over_explored": [],
            "under_explored": []
        }

    parsed = _parse_llm_json(result)
    if not parsed:
        return {
            "over_explored": [],
            "under_explored": []
        }

    return parsed


# ============ Phase 7: Prompt 变异 ============

def evolve_prompt(trigger_type: str, old_config: Dict, reason: str) -> Dict:
    """
    根据用户行为自动调整生成参数

    Args:
        trigger_type: 变异触发类型
        old_config: 旧配置
        reason: 变异原因

    Returns:
        {
            "timestamp": str,
            "trigger": str,
            "old_config": {...},
            "new_config": {...},
            "reason": str
        }
    """
    prompt = f"""你是 Prompt 进化引擎。根据用户行为数据自动调整生成参数。

变异触发类型：{trigger_type}
旧配置：{json.dumps(old_config, ensure_ascii=False)}
变异原因：{reason}

变异策略：
1. 强化偏好维度：用户连续选择某维度时，提高该维度权重
2. 替换陈词：根据改词记录更新禁用词列表
3. 调整风格：根据采纳率调整生成风格

返回 JSON：
{{
  "new_config": {{
    "dimension_weights": {{"reversal": 1.0, "micro_scene": 1.0, ...}},
    "banned_words": ["赋能", "降维打击", ...],
    "style_adjustment": "..."
  }},
  "evolution_note": "变异说明"
}}"""

    result = _call_llm_raw(prompt)
    if not result:
        return {
            "trigger": trigger_type,
            "old_config": old_config,
            "new_config": old_config,
            "reason": reason
        }

    parsed = _parse_llm_json(result)
    if not parsed:
        return {
            "trigger": trigger_type,
            "old_config": old_config,
            "new_config": old_config,
            "reason": reason
        }

    return {
        "timestamp": datetime.now().isoformat(),
        "trigger": trigger_type,
        "old_config": old_config,
        "new_config": parsed.get("new_config", old_config),
        "reason": reason
    }


# ============ Phase 7: 主流程 ============

def assassin_mechanism(historical_topics: List[str] = None, entities: List[Dict] = None, relations: List[Dict] = None) -> Dict:
    """
    Phase 7 完整流程：刺客机制 + 知识拓扑

    Args:
        historical_topics: 历史爆款列表
        entities: 实体统计
        relations: 关系统计

    Returns:
        {
            "reversals": [...],
            "topology": {...}
        }
    """
    result = {
        "phase": "assassin",
        "reversals": [],
        "topology": {}
    }

    # 刺客机制 - 反转历史爆款
    if historical_topics:
        for topic in historical_topics:
            reversal = reverse_topic(topic)
            result["reversals"].append(reversal)

    # 知识拓扑
    if entities or relations:
        result["topology"] = analyze_knowledge_topology(entities or [], relations or [])

    return result


# ============ 辅助函数 ============

def _call_llm_raw(prompt: str) -> Optional[str]:
    """调用 LLM，返回原始文本"""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from call_llm import call_llm

    scene = os.environ.get("GATEWAY_SCENE", "quality")
    os.environ["GATEWAY_SCENE"] = scene

    result = call_llm(prompt)

    if result.get("error"):
        print(f"[Error] LLM: {result['error']}", file=sys.stderr)
        return None

    return result.get("content")


def _parse_llm_json(text: str) -> Optional[Dict]:
    """从 LLM 输出中解析 JSON"""
    if not text:
        return None

    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

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
    output = json.dumps(obj, ensure_ascii=False)
    sys.stdout.buffer.write(output.encode("utf-8") + b"\n")


def main():
    if len(sys.argv) < 2:
        _safe_print({
            "error": "用法: assassin.py <命令> <数据>",
            "commands": {
                "reverse": "assassin.py reverse \"<历史爆款标题>\" - 逻辑反转",
                "topology": "assassin.py topology '<[{\"entity\":...}]' '<[{\"relation\":...}]' - 知识拓扑",
                "evolve": "assassin.py evolve \"<触发类型>\" '<old_config>' - Prompt 变异",
                "read": "assassin.py read - 读取飞书爆款选题库"
            }
        })
        sys.exit(1)

    command = sys.argv[1]

    if command == "reverse":
        topic = sys.argv[2] if len(sys.argv) > 2 else ""
        result = reverse_topic(topic)
        _safe_print(result)

    elif command == "topology":
        entities_str = sys.argv[2] if len(sys.argv) > 2 else "[]"
        relations_str = sys.argv[3] if len(sys.argv) > 3 else "[]"
        try:
            entities = json.loads(entities_str)
            relations = json.loads(relations_str)
        except:
            entities = []
            relations = []
        result = analyze_knowledge_topology(entities, relations)
        _safe_print(result)

    elif command == "evolve":
        trigger = sys.argv[2] if len(sys.argv) > 2 else ""
        config_str = sys.argv[3] if len(sys.argv) > 3 else "{}"
        try:
            old_config = json.loads(config_str)
        except:
            old_config = {}
        result = evolve_prompt(trigger, old_config, "")
        _safe_print(result)

    elif command == "read":
        records = read_viral_library()
        print(json.dumps(records, ensure_ascii=False, indent=2))

    else:
        _safe_print({"error": f"未知命令: {command}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
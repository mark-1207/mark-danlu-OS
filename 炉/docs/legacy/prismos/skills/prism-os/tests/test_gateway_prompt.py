"""
网关澄清提示 UX 测试（v1.4 增强）
- 追问 vs 方向 关系明确
- 选择提示清晰
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


def test_prompt_separates_questions_and_directions():
    """追问和方向分两节，标签明确"""
    from phases.gateway import GatewayPhase

    phase = GatewayPhase()
    gateway_result = {
        "questions": ["问题 1", "问题 2", "问题 3"],
        "directions": ["方向 1", "方向 2", "方向 3"],
    }
    prompt = phase._format_clarification_prompt(gateway_result)

    # 追问和方向应在不同行
    assert "问题 1" in prompt
    assert "方向 1" in prompt
    # 追问在前，方向在后
    pos_q = prompt.index("问题 1")
    pos_d = prompt.index("方向 1")
    assert pos_q < pos_d, "追问应排在方向之前"

    # 应有"追问"和"方向"的角色标签
    assert "追问" in prompt
    assert "方向" in prompt


def test_prompt_explains_q_vs_directions_relationship():
    """明确告诉用户两者是 OR 关系（不是 AND）"""
    from phases.gateway import GatewayPhase

    phase = GatewayPhase()
    prompt = phase._format_clarification_prompt({
        "questions": ["Q1"],
        "directions": ["D1"],
    })

    # 提示必须说明两者关系（OR / 二选一 / 任选其一 等）
    # 简体：用户应该能看出"选一个就行"
    has_or_signal = any(kw in prompt for kw in [
        "或", "任选", "二选一", "任一", "可", "选一个", "其中"
    ])
    assert has_or_signal, "提示应明示'或'关系，不是要求都做"


def test_prompt_selection_instructions_clear():
    """底部选择提示应列出所有可选项"""
    from phases.gateway import GatewayPhase

    phase = GatewayPhase()
    prompt = phase._format_clarification_prompt({
        "questions": ["Q1"],
        "directions": ["D1"],
    })

    # 必须包含关键操作词
    for kw in ["编号", "skip", "退出"]:
        assert kw in prompt, f"提示应包含 '{kw}'"


def test_prompt_without_directions_works():
    """没有方向时只显示追问（向下兼容）"""
    from phases.gateway import GatewayPhase

    phase = GatewayPhase()
    prompt = phase._format_clarification_prompt({
        "questions": ["Q1", "Q2"],
        "directions": [],
    })

    assert "Q1" in prompt
    assert "Q2" in prompt
    # 不应强行显示"方向"标签
    assert "方向 1" not in prompt

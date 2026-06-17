"""feishu: 飞书 hook 预留（v1.x 仅协议，本地 sink；v2.x 接真实 API）

v1.x 范围：
- 定义 FeedbackSink 协议
- 提供 LocalJsonlSink 占位实现
- 不接真实飞书 API

v2.x 范围：
- FeishuBitableSink（飞书多维表格）
- 跨设备同步
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from lu.feedback.models import Feedback


@runtime_checkable
class FeedbackSink(Protocol):
    """反馈接收器协议（v1.x 本地实现 / v2.x 飞书实现）"""

    def send(self, feedback: Feedback) -> bool:
        """发送一条反馈，返回是否成功"""
        ...


__all__ = ["FeedbackSink"]


# 延迟导入避免循环依赖
def __getattr__(name: str):
    if name == "LocalJsonlSink":
        from lu.feishu.local_sink import LocalJsonlSink
        return LocalJsonlSink
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

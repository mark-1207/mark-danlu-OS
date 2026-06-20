"""feishu: 飞书集成（v3 P0 接真实 API）

- 定义 FeedbackSink 协议
- LocalJsonlSink（v1.x 本地占位）
- FeishuFeedbackSink（v3 P0 真实飞书 Bitable）
- FeishuBitableClient（lark-cli subprocess 包装）
- StyleProfile ↔ Bitable 序列化
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from lu.feedback.models import Feedback


@runtime_checkable
class FeedbackSink(Protocol):
    """反馈接收器协议（v1.x 本地实现 / v3 P0 飞书实现）"""

    def send(self, feedback: Feedback) -> bool:
        """发送一条反馈，返回是否成功"""
        ...


__all__ = ["FeedbackSink", "LocalJsonlSink", "FeishuFeedbackSink"]


# 延迟导入避免循环依赖
def __getattr__(name: str):
    if name == "LocalJsonlSink":
        from lu.feishu.local_sink import LocalJsonlSink
        return LocalJsonlSink
    if name == "FeishuFeedbackSink":
        from lu.feishu.feedback_sink import FeishuFeedbackSink
        return FeishuFeedbackSink
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

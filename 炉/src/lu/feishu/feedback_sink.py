"""FeishuFeedbackSink：把 Feedback 写到飞书 Bitable

实现 FeedbackSink 协议，调用 FeishuBitableClient.create_record。
fields 映射：本地 Feedback 字段 → 飞书 Bitable field_id（从 feishu_config.yaml 读）。

容错：lark-cli 失败返回 False，不抛异常。
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from lu.feedback.models import Feedback

if TYPE_CHECKING:
    from lu.feishu.client import FeishuBitableClient


def _to_bool_str(v: bool) -> bool:
    """飞书 Bitable 复选框字段期望 bool"""
    return bool(v)


def _feedback_to_bitable_fields(
    feedback: Feedback, fields: dict[str, str]
) -> dict:
    """把 Feedback 映射到 Bitable fields（field_id → value）"""
    out: dict = {}
    for local_key, feishu_field in fields.items():
        if local_key == "run_id":
            v = feedback.run_id
        elif local_key == "proposition":
            v = feedback.proposition
        elif local_key == "overall_passed":
            v = _to_bool_str(feedback.quality_overall_passed)
        elif local_key == "weakest_dimension":
            v = feedback.weakest_dimension
        elif local_key == "accepted":
            v = _to_bool_str(feedback.accepted)
        elif local_key == "note":
            v = feedback.note
        elif local_key == "created_at":
            v = feedback.created_at.isoformat()
        else:
            continue  # 未知字段跳过
        if v is None:
            continue
        out[feishu_field] = v
    return out


class FeishuFeedbackSink:
    """把 Feedback 写到飞书 Bitable（替代 LocalJsonlSink）"""

    def __init__(self, config_path: Path | str) -> None:
        self.config_path = Path(config_path)
        # 延迟导入避免循环依赖
        from lu.feishu.client import FeishuBitableClient

        self.client = FeishuBitableClient(config_path)
        # fields 映射（从 yaml 读）
        self.fields: dict[str, str] = self.client.fields

    def send(self, feedback: Feedback) -> bool:
        """发送一条反馈到飞书 Bitable"""
        try:
            fields = _feedback_to_bitable_fields(feedback, self.fields)
            self.client.create_record(fields)
            return True
        except Exception:
            # 容错：飞书失败不阻塞主流程
            return False


__all__ = ["FeishuFeedbackSink", "_feedback_to_bitable_fields"]

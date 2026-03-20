"""
飞书多维表格客户端
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

try:
    from lark_oapi import LarkClient, CreateRecordRequest, RecordCreate
except ImportError:
    print("请先安装飞书SDK: pip install larksuite-oapi")
    raise

from config import FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID, FIELDS_MAPPING

logger = logging.getLogger(__name__)

# 数字类型字段
NUMERIC_FIELDS = {"likes", "views", "comments_count"}


class FeishuClient:
    """飞书多维表格客户端"""

    def __init__(self):
        self.app_id = FEISHU_APP_ID
        self.app_secret = FEISHU_APP_SECRET
        self.app_token = FEISHU_APP_TOKEN
        self.table_id = FEISHU_TABLE_ID
        self._client = None
        self._token = None

    def _get_client(self) -> LarkClient:
        """获取飞书客户端"""
        if self._client is None:
            self._client = LarkClient(app_id=self.app_id, app_secret=self.app_secret)
        return self._client

    def _get_tenant_access_token(self) -> str:
        """获取租户访问令牌"""
        if self._token is None:
            client = self._get_client()
            response = client.auth.get_tenant_access_token_internal()
            if response.get("code") == 0:
                self._token = response.get("tenant_access_token")
            else:
                raise Exception(f"获取token失败: {response}")
        return self._token

    def _convert_field_value(self, key: str, value: any) -> any:
        """转换字段值，确保类型正确"""
        # 数字字段
        if key in NUMERIC_FIELDS:
            try:
                return int(value) if value else 0
            except (ValueError, TypeError):
                return 0
        # 其他字段直接返回
        return value

    def push_record(self, data: Dict) -> bool:
        """
        推送单条记录到多维表格

        Args:
            data: 包含字段数据的字典

        Returns:
            bool: 是否成功
        """
        try:
            # 转换字段名为飞书格式，并确保类型正确
            fields = {}
            for key, value in data.items():
                if key in FIELDS_MAPPING and value is not None:
                    # 转换字段值类型
                    converted_value = self._convert_field_value(key, value)
                    fields[FIELDS_MAPPING[key]] = converted_value

            # 如果没有数据，直接返回
            if not fields:
                logger.warning("没有有效数据可推送")
                return False

            # 添加抓取时间
            if "抓取时间" not in fields:
                fields["抓取时间"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            client = self._get_client()
            token = self._get_tenant_access_token()

            # 构建请求
            request = CreateRecordRequest(
                tenant_access_token=token,
                app_token=self.app_token,
                table_id=self.table_id,
                records=[
                    RecordCreate(fields=fields)
                ]
            )

            # 发送请求
            response = client.bitable.record.create(request)

            if response.code == 0:
                logger.info(f"✅ 成功推送记录: {fields.get('标题', '未知')}")
                return True
            else:
                logger.error(f"❌ 推送失败: {response.msg}")
                return False

        except Exception as e:
            logger.error(f"❌ 推送异常: {str(e)}")
            return False

    def push_batch(self, data_list: List[Dict]) -> Dict:
        """
        批量推送记录

        Args:
            data_list: 数据列表

        Returns:
            Dict: 推送结果统计
        """
        success = 0
        failed = 0

        for data in data_list:
            if self.push_record(data):
                success += 1
            else:
                failed += 1

        return {
            "total": len(data_list),
            "success": success,
            "failed": failed
        }

    def test_connection(self) -> bool:
        """测试飞书连接"""
        try:
            self._get_tenant_access_token()
            logger.info("✅ 飞书连接测试成功")
            return True
        except Exception as e:
            logger.error(f"❌ 飞书连接测试失败: {str(e)}")
            return False

"""
飞书多维表格客户端 - 使用REST API，自动获取字段映射
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
import requests

from config import FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_ID, FIELDS_MAPPING

logger = logging.getLogger(__name__)

# 数字类型字段
NUMERIC_FIELDS = {"likes", "views", "comments_count"}

# URL类型字段
URL_FIELDS = {"url"}

# API基础URL
FEISHU_API_BASE = "https://open.feishu.cn/open-apis"


class FeishuClient:
    """飞书多维表格客户端"""

    def __init__(self):
        self.app_id = FEISHU_APP_ID
        self.app_secret = FEISHU_APP_SECRET
        self.app_token = FEISHU_APP_TOKEN
        self.table_id = FEISHU_TABLE_ID
        self._tenant_access_token = None
        self._field_map = None  # 缓存字段映射

    def _get_tenant_access_token(self) -> str:
        """获取租户访问令牌"""
        if self._tenant_access_token:
            return self._tenant_access_token

        url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }

        response = requests.post(url, json=data, timeout=10)
        result = response.json()

        if result.get("code") == 0:
            self._tenant_access_token = result.get("tenant_access_token")
            return self._tenant_access_token
        else:
            raise Exception(f"获取token失败: {result}")

    def _get_field_map(self) -> Dict[str, str]:
        """获取飞书表格的字段映射"""
        if self._field_map:
            return self._field_map

        url = f"{FEISHU_API_BASE}/bitable/v1/apps/{self.app_token}/tables/{self.table_id}/fields"
        headers = {"Authorization": f"Bearer {self._get_tenant_access_token()}"}

        response = requests.get(url, headers=headers, timeout=10)
        result = response.json()

        if result.get("code") != 0:
            raise Exception(f"获取字段失败: {result}")

        # 构建字段映射: 用户字段名 -> API字段名
        fields = result["data"]["items"]
        field_map = {}

        for field in fields:
            fname = field["field_name"]
            ftype = field["type"]
            field_id = field["field_id"]

            # 根据类型和位置推断
            if ftype == 15:  # URL
                field_map["url"] = fname
            elif ftype == 1:  # Text
                # 按顺序尝试匹配
                if "url" not in field_map:
                    field_map["url"] = fname
                elif "source" not in field_map and ("平台" in fname or "源" in fname):
                    field_map["source"] = fname
                elif "title" not in field_map and ("标" in fname or "题" in fname):
                    field_map["title"] = fname
                elif "author" not in field_map and ("作" in fname or "者" in fname or "创" in fname):
                    field_map["author"] = fname
                elif "publish_date" not in field_map and ("时" in fname or "发" in fname or "日" in fname):
                    field_map["publish_date"] = fname
                elif "content" not in field_map and ("正" in fname or "文" in fname or "内" in fname or "容" in fname):
                    field_map["content"] = fname
                elif "summary" not in field_map and ("摘" in fname or "要" in fname):
                    field_map["summary"] = fname
                elif "translation" not in field_map and ("译" in fname or "翻" in fname):
                    field_map["translation"] = fname
                elif "likes" not in field_map and ("赞" in fname or "喜" in fname or "like" in fname.lower()):
                    field_map["likes"] = fname
                elif "views" not in field_map and ("阅" in fname or "看" in fname or "view" in fname.lower()):
                    field_map["views"] = fname
                elif "comments_count" not in field_map and ("评" in fname or "论" in fname or "comment" in fname.lower()):
                    field_map["comments_count"] = fname
                elif "top_comments" not in field_map and ("热" in fname or "门" in fname or "评" in fname):
                    field_map["top_comments"] = fname

        self._field_map = field_map
        logger.info(f"自动获取字段映射: {field_map}")
        return field_map

    def _convert_field_value(self, key: str, value: any) -> any:
        """转换字段值，确保类型正确"""
        # 数字字段
        if key in NUMERIC_FIELDS:
            try:
                return int(value) if value else 0
            except (ValueError, TypeError):
                return 0

        # URL类型字段（需要特殊格式）
        if key in URL_FIELDS and value:
            return {"link": str(value), "text": str(value)[:50]}

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
            # 获取字段映射
            field_map = self._get_field_map()

            # 转换字段名为飞书实际字段名
            fields = {}
            for key, value in data.items():
                if key in field_map:
                    converted_value = self._convert_field_value(key, value)
                    fields[field_map[key]] = converted_value

            # 如果没有数据，直接返回
            if not fields:
                logger.warning("没有有效数据可推送")
                return False

            # 添加抓取时间
            if "crawl_time" in field_map and field_map["crawl_time"] not in fields:
                fields[field_map["crawl_time"]] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # 获取token
            token = self._get_tenant_access_token()

            # 构建请求
            url = f"{FEISHU_API_BASE}/bitable/v1/apps/{self.app_token}/tables/{self.table_id}/records"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8"
            }
            payload = {
                "fields": fields
            }

            # 发送请求
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            result = response.json()

            if result.get("code") == 0:
                logger.info(f"✅ 成功推送记录")
                return True
            else:
                logger.error(f"❌ 推送失败: {result.get('msg')}")
                return False

        except Exception as e:
            logger.error(f"❌ 推送异常: {str(e)}")
            return False

    def push_batch(self, data_list: List[Dict]) -> Dict:
        """批量推送记录"""
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

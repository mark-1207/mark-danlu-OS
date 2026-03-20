"""
数据清洗模块 - 将抓取的原始数据整理为结构化数据
"""

import re
import logging
from datetime import datetime
from typing import Dict, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def clean_html(raw_html: str) -> str:
    """清理HTML标签，返回纯文本"""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, 'html.parser')
    text = soup.get_text(separator='\n', strip=True)
    # 清理多余空白
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def clean_text(text: str, max_length: int = None) -> str:
    """清理文本，去除多余空白和特殊字符"""
    if not text:
        return ""

    # 去除多余空白
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()

    # 去除特殊字符（保留中文、英文、数字、常用标点）
    text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s.,!?;:;，。！？；：""''（）()【】[\]……—～、]', '', text)

    # 截断
    if max_length and len(text) > max_length:
        text = text[:max_length] + "..."

    return text


def clean_number(value: any) -> int:
    """清洗数字字段"""
    if value is None:
        return 0

    if isinstance(value, int):
        return value if value >= 0 else 0

    if isinstance(value, str):
        value = value.strip()
        # 处理"10万"、"1.5万"等
        if '万' in value:
            try:
                return int(float(value.replace('万', '')) * 10000)
            except:
                return 0
        elif '十万' in value:
            try:
                return int(float(value.replace('十万', '')) * 100000)
            except:
                return 0
        elif 'K' in value.upper() or 'k' in value:
            try:
                return int(float(value.upper().replace('K', '')) * 1000)
            except:
                return 0
        elif 'M' in value.upper() or 'm' in value:
            try:
                return int(float(value.upper().replace('M', '')) * 1000000)
            except:
                return 0
        # 去除逗号
        value = value.replace(',', '')
        try:
            return int(float(value))
        except:
            return 0

    return 0


def parse_date(date_str: str) -> str:
    """解析日期为标准格式"""
    if not date_str:
        return ""

    date_str = date_str.strip()

    # 已经是标准格式
    if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
        return date_str[:10]

    # 处理中文日期
    date_map = {
        '年': '-', '月': '-', '日': '',
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    }

    # 转换中文月份
    for cn, num in date_map.items():
        date_str = date_str.replace(cn, num)

    # 尝试提取日期部分
    match = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', date_str)
    if match:
        year, month, day = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # 尝试其他格式
    match = re.search(r'(\d{4})(\d{2})(\d{2})', date_str)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    return date_str


def extract_summary(content: str, max_length: int = 200) -> str:
    """从正文中提取摘要"""
    if not content:
        return ""

    # 去除空白字符
    text = re.sub(r'\s+', ' ', content.strip())

    # 截取前200字
    if len(text) > max_length:
        # 尝试在句号处截断
        end = text[:max_length].rfind('。')
        if end > max_length - 50:
            return text[:end+1]
        return text[:max_length] + "..."

    return text


def truncate_content(content: str, max_length: int = 5000) -> str:
    """截断正文内容，避免飞书字段过长"""
    if not content:
        return ""

    if len(content) > max_length:
        return content[:max_length] + "..."

    return content


def structure_data(raw_data: Dict) -> Dict:
    """
    将原始抓取数据整理为结构化数据

    Args:
        raw_data: 爬虫返回的原始数据

    Returns:
        Dict: 结构化数据
    """
    result = {
        # 基础信息
        "title": clean_text(raw_data.get("title", "")),
        "url": raw_data.get("url", ""),
        "source": raw_data.get("source", "网页"),
        "author": clean_text(raw_data.get("author", "")),
        "publish_date": parse_date(raw_data.get("publish_date", "")),

        # 内容
        "content": truncate_content(clean_text(raw_data.get("content", ""))),
        "summary": extract_summary(raw_data.get("content", "")),
        "translation": truncate_content(clean_text(raw_data.get("translation", ""))),

        # 统计信息（确保为数字）
        "likes": clean_number(raw_data.get("likes", 0)),
        "views": clean_number(raw_data.get("views", 0)),
        "comments_count": clean_number(raw_data.get("comments_count", 0)),

        # 评论
        "top_comments": truncate_content(clean_text(raw_data.get("top_comments", "")), 2000),

        # 元数据
        "crawl_time": raw_data.get("crawl_time", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    }

    # 如果没有摘要，自动生成
    if not result["summary"] and result["content"]:
        result["summary"] = extract_summary(result["content"])

    return result


def validate_data(data: Dict) -> Dict:
    """
    验证数据结构，返回验证结果

    Args:
        data: 结构化数据

    Returns:
        Dict: 验证结果 {valid: bool, errors: []}
    """
    errors = []

    # 必填字段检查
    if not data.get("title"):
        errors.append("标题不能为空")

    if not data.get("url"):
        errors.append("URL不能为空")

    # 数据类型检查
    if not isinstance(data.get("likes"), int):
        errors.append("点赞数类型错误")

    if not isinstance(data.get("views"), int):
        errors.append("阅读数类型错误")

    if not isinstance(data.get("comments_count"), int):
        errors.append("评论数类型错误")

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


# 导出
__all__ = [
    'clean_html',
    'clean_text',
    'clean_number',
    'parse_date',
    'extract_summary',
    'truncate_content',
    'structure_data',
    'validate_data'
]

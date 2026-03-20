"""
爬虫工厂 - 根据URL自动选择合适的爬虫
"""

import logging
from typing import Optional

from .base import BaseCrawler
from .weixin import WeixinCrawler
from .zhihu import ZhihuCrawler
from .generic import GenericCrawler

logger = logging.getLogger(__name__)


def create_crawler(url: str) -> BaseCrawler:
    """
    根据URL创建合适的爬虫

    Args:
        url: 目标URL

    Returns:
        BaseCrawler: 爬虫实例
    """
    url_lower = url.lower()

    # 微信公众号
    if 'mp.weixin.qq.com' in url_lower:
        logger.info("检测到: 微信公众号")
        return WeixinCrawler()

    # 知乎
    if 'zhihu.com' in url_lower:
        logger.info("检测到: 知乎")
        return ZhihuCrawler()

    # 微博
    if 'weibo.com' in url_lower or 'm.weibo.cn' in url_lower:
        logger.info("检测到: 微博，使用通用爬虫")
        return GenericCrawler()

    # Medium
    if 'medium.com' in url_lower:
        logger.info("检测到: Medium")
        return GenericCrawler()

    # Reddit
    if 'reddit.com' in url_lower:
        logger.info("检测到: Reddit")
        return GenericCrawler()

    # YouTube
    if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        logger.info("检测到: YouTube")
        return GenericCrawler()

    # Twitter/X
    if 'twitter.com' in url_lower or 'x.com' in url_lower:
        logger.info("检测到: Twitter/X")
        return GenericCrawler()

    # 默认使用通用爬虫
    logger.info("使用通用爬虫")
    return GenericCrawler()

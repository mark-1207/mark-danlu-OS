"""
爬虫基类
"""

import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, Optional, List
from datetime import datetime
from config import REQUEST_DELAY, MAX_RETRIES, REQUEST_TIMEOUT
from translator import translate_to_chinese, detect_language

logger = logging.getLogger(__name__)


class BaseCrawler(ABC):
    """爬虫基类"""

    def __init__(self):
        self.request_delay = REQUEST_DELAY
        self.max_retries = MAX_RETRIES
        self.request_timeout = REQUEST_TIMEOUT

    @abstractmethod
    def get_source_name(self) -> str:
        """获取来源名称"""
        pass

    @abstractmethod
    def extract_content(self, html: str, url: str) -> Dict:
        """
        从HTML中提取内容

        Args:
            html: 网页HTML
            url: 网页URL

        Returns:
            Dict: 提取的数据
        """
        pass

    @abstractmethod
    def extract_comments(self, html: str, url: str) -> List[Dict]:
        """
        从HTML中提取评论

        Args:
            html: 网页HTML
            url: 网页URL

        Returns:
            List[Dict]: 评论列表
        """
        pass

    def fetch_with_retry(self, url: str, session=None, headers: Dict = None) -> Optional[str]:
        """
        带重试的获取网页内容

        Args:
            url: 目标URL
            session: requests session
            headers: 请求头

        Returns:
            str: HTML内容，失败返回None
        """
        import requests

        if headers is None:
            headers = self.get_default_headers()

        for attempt in range(self.max_retries):
            try:
                if session:
                    response = session.get(url, headers=headers, timeout=self.request_timeout)
                else:
                    response = requests.get(url, headers=headers, timeout=self.request_timeout)

                response.raise_for_status()
                time.sleep(self.request_delay)
                return response.text

            except Exception as e:
                logger.warning(f"尝试 {attempt + 1}/{self.max_retries} 失败: {str(e)}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.request_delay * 2)
                else:
                    logger.error(f"❌ 获取 {url} 失败")
                    return None

        return None

    def get_default_headers(self) -> Dict:
        """获取默认请求头"""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }

    def crawl(self, url: str) -> Dict:
        """
        执行爬取

        Args:
            url: 目标URL

        Returns:
            Dict: 爬取结果
        """
        logger.info(f"🔄 开始爬取: {url}")

        # 获取网页内容
        html = self.fetch_with_retry(url)
        if not html:
            return {"success": False, "error": "获取网页失败"}

        # 提取内容
        try:
            content = self.extract_content(html, url)
            content["url"] = url
            content["source"] = self.get_source_name()
            content["crawl_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            logger.error(f"❌ 内容提取失败: {str(e)}")
            return {"success": False, "error": f"内容提取失败: {str(e)}"}

        # 提取评论
        try:
            comments = self.extract_comments(html, url)
            if comments:
                # 取前5条热门评论
                top_comments = [c["content"] for c in comments[:5]]
                content["top_comments"] = "\n\n".join(top_comments)
                content["comments_count"] = len(comments)
        except Exception as e:
            logger.warning(f"⚠️ 评论提取失败: {str(e)}")
            content["comments_count"] = 0
            content["top_comments"] = ""

        # 翻译（非中文内容）
        try:
            source_name = self.get_source_name()
            # 对非中文来源进行翻译
            if source_name not in ["公众号", "知乎", "微博"]:
                full_content = content.get("content", "")
                if full_content and len(full_content) > 50:
                    # 检测语言
                    lang = detect_language(full_content)
                    if lang != "zh":
                        logger.info(f"🌐 检测到 {lang} 内容，开始翻译...")
                        # 翻译正文（截取前10000字符，避免过长）
                        translation = translate_to_chinese(full_content[:10000])
                        if translation:
                            content["translation"] = translation
                            logger.info(f"✅ 翻译完成，译文长度: {len(translation)} 字符")
        except Exception as e:
            logger.warning(f"⚠️ 翻译失败: {str(e)}")
            content["translation"] = ""

        logger.info(f"✅ 爬取完成: {content.get('title', '未知')}")
        return {"success": True, "data": content}

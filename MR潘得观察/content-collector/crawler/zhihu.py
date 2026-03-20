"""
知乎爬虫
"""

import json
import re
import os
import logging
from typing import Dict, List
from bs4 import BeautifulSoup

from .base import BaseCrawler
from config import ZHIHU_COOKIES_FILE

logger = logging.getLogger(__name__)


class ZhihuCrawler(BaseCrawler):
    """知乎文章/回答爬虫"""

    def __init__(self):
        super().__init__()
        self.cookies_file = ZHIHU_COOKIES_FILE
        self._session = None

    def get_source_name(self) -> str:
        return "知乎"

    def _get_session(self):
        """获取带cookies的session"""
        if self._session is None:
            import requests
            self._session = requests.Session()
            self._session.headers.update(self.get_default_headers())
            self._session.headers.update({
                "Referer": "https://www.zhihu.com/",
                "Authorization": "oauth c3cef7c66a9843f3bba9e8ea9db36e63"
            })

            # 加载cookies
            if os.path.exists(self.cookies_file):
                try:
                    with open(self.cookies_file, 'r', encoding='utf-8') as f:
                        cookies = json.load(f)
                        # 转换为requests格式
                        for cookie in cookies:
                            self._session.cookies.set(cookie['name'], cookie['value'])
                    logger.info("✅ 已加载知乎cookies")
                except Exception as e:
                    logger.warning(f"⚠️ 加载cookies失败: {str(e)}")

        return self._session

    def extract_content(self, html: str, url: str) -> Dict:
        """提取知乎文章/回答内容"""
        soup = BeautifulSoup(html, 'lxml')

        result = {
            "title": "",
            "author": "",
            "publish_date": "",
            "summary": "",
            "content": "",
            "likes": 0,
            "views": 0,
            "comments_count": 0
        }

        # 提取标题
        title_tag = soup.find('h1', class_='Post-Title') or soup.find('h1', class_='QuestionHeader-title')
        if title_tag:
            result["title"] = title_tag.get_text(strip=True)
        else:
            # 尝试从meta获取
            meta_title = soup.find('meta', property='og:title')
            if meta_title:
                result["title"] = meta_title.get('content', '')

        # 提取作者
        author_tag = soup.find('span', class_='Author-name') or soup.find('a', class_='UserLink-link')
        if author_tag:
            result["author"] = author_tag.get_text(strip=True)

        # 提取发布日期
        date_tag = soup.find('span', class_='PublishTime') or soup.find('time', class_='DateTime')
        if date_tag:
            result["publish_date"] = date_tag.get_text(strip=True)

        # 提取正文内容
        content_tag = soup.find('div', class_='RichText') or soup.find('div', class_='QuestionBody')
        if content_tag:
            text = content_tag.get_text(strip=True)
            result["content"] = text
            result["summary"] = text[:200] if text else ""

        # 提取统计数据
        try:
            # 点赞数
            like_btn = soup.find('button', class_='VoteButton')
            if like_btn:
                count_span = like_btn.find('span', class_='Count')
                if count_span:
                    result["likes"] = self._parse_number(count_span.get_text(strip=True))

            # 阅读数
            view_count = soup.find('span', class_='ViewCount')
            if view_count:
                result["views"] = self._parse_number(view_count.get_text(strip=True))

            # 评论数
            comment_count = soup.find('span', className='ItemViewCount')
            if comment_count:
                result["comments_count"] = self._parse_number(comment_count.get_text(strip=True))
        except Exception as e:
            logger.warning(f"⚠️ 提取统计信息失败: {str(e)}")

        return result

    def extract_comments(self, html: str, url: str) -> List[Dict]:
        """提取知乎评论"""
        comments = []
        soup = BeautifulSoup(html, 'lxml')

        # 查找评论列表
        comment_items = soup.find_all('div', class_='CommentItem')

        for item in comment_items[:20]:  # 最多取20条
            # 评论内容
            content_tag = item.find('span', class_='CommentItem-content')
            if not content_tag:
                continue

            content = content_tag.get_text(strip=True)
            if not content:
                continue

            # 作者
            author_tag = item.find('span', class_='UserLink-name')
            author = author_tag.get_text(strip=True) if author_tag else ""

            # 点赞数
            like_count = 0
            like_btn = item.find('span', class_='VoteCount')
            if like_btn:
                like_count = self._parse_number(like_btn.get_text(strip=True))

            comments.append({
                "content": content,
                "author": author,
                "likes": like_count
            })

        # 按点赞数排序
        comments.sort(key=lambda x: x.get("likes", 0), reverse=True)

        return comments

    def _parse_number(self, text: str) -> int:
        """解析数字字符串"""
        if not text:
            return 0
        text = text.strip()
        if 'K' in text.upper():
            return int(float(text.upper().replace('K', '')) * 1000)
        elif 'W' in text.upper():
            return int(float(text.upper().replace('W', '')) * 10000)
        try:
            return int(text.replace(',', ''))
        except:
            return 0

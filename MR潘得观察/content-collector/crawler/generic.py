"""
通用网页爬虫（适用于大多数网站）
"""

import re
import logging
from typing import Dict, List
from bs4 import BeautifulSoup

from .base import BaseCrawler

logger = logging.getLogger(__name__)


class GenericCrawler(BaseCrawler):
    """通用网页爬虫"""

    def __init__(self):
        super().__init__()

    def get_source_name(self) -> str:
        return "网页"

    def detect_source(self, url: str) -> str:
        """根据URL检测来源"""
        if 'zhihu.com' in url:
            return '知乎'
        elif 'weibo.com' in url or 'm.weibo.cn' in url:
            return '微博'
        elif 'juejin.cn' in url or 'juejin.im' in url:
            return '掘金'
        elif 'segmentfault.com' in url:
            return 'SegmentFault'
        elif 'mp.weixin.qq.com' in url:
            return '公众号'
        elif 'medium.com' in url:
            return 'Medium'
        elif 'reddit.com' in url:
            return 'Reddit'
        elif 'youtube.com' in url or 'youtu.be' in url:
            return 'YouTube'
        elif 'twitter.com' in url or 'x.com' in url:
            return 'Twitter'
        else:
            return '网页'

    def extract_content(self, html: str, url: str) -> Dict:
        """提取通用网页内容"""
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

        # 1. 提取标题（多种方式）
        # 方式1: <title>标签
        title_tag = soup.find('title')
        if title_tag:
            result["title"] = title_tag.get_text(strip=True)

        # 方式2: og:title
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            result["title"] = og_title['content']

        # 方式3: <h1>标签
        h1_tag = soup.find('h1')
        if h1_tag:
            result["title"] = h1_tag.get_text(strip=True)

        # 2. 提取作者
        author_meta = soup.find('meta', attrs={'name': 'author'}) or soup.find('meta', property='article:author')
        if author_meta and author_meta.get('content'):
            result["author"] = author_meta['content']

        # 3. 提取发布日期
        date_meta = soup.find('meta', property='article:published_time')
        if date_meta and date_meta.get('content'):
            result["publish_date"] = date_meta['content'][:10]
        else:
            # 尝试找 time 标签
            time_tag = soup.find('time')
            if time_tag:
                result["publish_date"] = time_tag.get('datetime', '')[:10] or time_tag.get_text(strip=True)

        # 4. 提取摘要
        # og:description
        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content'):
            result["summary"] = og_desc['content'][:200]
        else:
            # description meta
            desc_meta = soup.find('meta', attrs={'name': 'description'})
            if desc_meta and desc_meta.get('content'):
                result["summary"] = desc_meta['content'][:200]

        # 5. 提取正文内容
        # 尝试找主要内容区域
        contentSelectors = [
            'article',
            'main',
            'div[role="main"]',
            'div.content',
            'div.post-content',
            'div.article-content',
            'div.entry-content',
            'div.post-body',
            'div.article-body'
        ]

        content_tag = None
        for selector in contentSelectors:
            content_tag = soup.select_one(selector)
            if content_tag:
                break

        if content_tag:
            # 清理脚本和样式
            for tag in content_tag.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                tag.decompose()

            # 获取纯文本
            text = content_tag.get_text(separator='\n', strip=True)
            # 清理多余空白
            text = re.sub(r'\n{3,}', '\n\n', text)
            result["content"] = text
            if not result["summary"]:
                result["summary"] = text[:200]

        # 6. 提取统计信息（点赞、阅读、评论）
        # 尝试从页面中提取数字
        page_text = str(soup)

        # 点赞数
        like_patterns = [
            r'([\d,]+)\s*(喜欢|点赞|like)',
            r'likes["\s:]+(\d+)',
            r'favorite["\s:]+(\d+)'
        ]
        for pattern in like_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                result["likes"] = self._parse_number(match.group(1))
                break

        # 阅读数
        view_patterns = [
            r'([\d,]+)\s*(阅读|浏览|view|read)',
            r'views["\s:]+(\d+)'
        ]
        for pattern in view_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                result["views"] = self._parse_number(match.group(1))
                break

        # 评论数
        comment_patterns = [
            r'([\d,]+)\s*(评论|comment)',
            r'comments["\s:]+(\d+)'
        ]
        for pattern in comment_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                result["comments_count"] = self._parse_number(match.group(1))
                break

        # 自动识别来源
        result["source"] = self.detect_source(url)

        return result

    def extract_comments(self, html: str, url: str) -> List[Dict]:
        """提取评论（通用实现，准确性较低）"""
        comments = []
        soup = BeautifulSoup(html, 'lxml')

        # 常见评论区域选择器
        comment_selectors = [
            'section.comments',
            'div.comments',
            'div.comment-list',
            'ul.comments',
            'div#comments',
            'article.comments'
        ]

        comment_area = None
        for selector in comment_selectors:
            comment_area = soup.select_one(selector)
            if comment_area:
                break

        if not comment_area:
            # 尝试查找所有评论相关元素
            comment_items = soup.find_all(['div', 'li'], class_=re.compile(r'comment', re.I))
        else:
            comment_items = comment_area.find_all(['div', 'li'])

        for item in comment_items[:20]:
            # 获取文本内容
            text = item.get_text(strip=True)
            if len(text) > 10:  # 过滤太短的
                comments.append({
                    "content": text[:500],
                    "author": "",
                    "likes": 0
                })

        return comments

    def _parse_number(self, text: str) -> int:
        """解析数字字符串"""
        if not text:
            return 0
        text = text.strip()
        text = text.replace(',', '')
        try:
            return int(text)
        except:
            return 0

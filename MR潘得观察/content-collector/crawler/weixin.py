"""
微信公众号爬虫
"""

import json
import re
import os
import logging
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
from datetime import datetime

from .base import BaseCrawler
from config import WECHAT_COOKIES_FILE

logger = logging.getLogger(__name__)


class WeixinCrawler(BaseCrawler):
    """微信公众号文章爬虫"""

    def __init__(self):
        super().__init__()
        self.cookies_file = WECHAT_COOKIES_FILE
        self._session = None

    def get_source_name(self) -> str:
        return "公众号"

    def _get_session(self):
        """获取带cookies的session"""
        if self._session is None:
            import requests
            self._session = requests.Session()
            self._session.headers.update(self.get_default_headers())

            # 加载cookies
            if os.path.exists(self.cookies_file):
                try:
                    with open(self.cookies_file, 'r', encoding='utf-8') as f:
                        cookies = json.load(f)
                        self._session.cookies.update(cookies)
                    logger.info("✅ 已加载微信cookies")
                except Exception as e:
                    logger.warning(f"⚠️ 加载cookies失败: {str(e)}")
            else:
                logger.warning(f"⚠️ 未找到cookies文件: {self.cookies_file}")
                logger.info("提示：首次运行需要扫码登录，cookies会自动保存")

        return self._session

    def save_cookies(self, cookies: Dict):
        """保存cookies"""
        os.makedirs(os.path.dirname(self.cookies_file), exist_ok=True)
        with open(self.cookies_file, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)
        logger.info("✅ Cookies已保存")

    def extract_content(self, html: str, url: str) -> Dict:
        """提取公众号文章内容"""
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
        title_tag = soup.find('h1', id='activity-name') or soup.find('h1', class_='title')
        if not title_tag:
            title_tag = soup.find('meta', property='og:title')
            result["title"] = title_tag['content'] if title_tag else ""
        else:
            result["title"] = title_tag.get_text(strip=True)

        # 提取作者
        author_tag = soup.find('a', id='js_name') or soup.find('span', class_='author')
        if author_tag:
            result["author"] = author_tag.get_text(strip=True)

        # 提取发布日期
        # 通常在 #publish_time 或者 meta 标签中
        date_tag = soup.find('em', id='publish_time') or soup.find('span', class_='date')
        if date_tag:
            result["publish_date"] = date_tag.get_text(strip=True)

        # 尝试从meta获取
        if not result["publish_date"]:
            meta_date = soup.find('meta', property='article:published_time')
            if meta_date:
                result["publish_date"] = meta_date.get('content', '')[:10]

        # 提取正文内容
        content_div = soup.find('div', id='js_content') or soup.find('div', class_='rich_media_content')
        if content_div:
            # 获取纯文本摘要
            text = content_div.get_text(strip=True)
            result["content"] = text
            result["summary"] = text[:200] if text else ""

        # 提取阅读数、点赞数、评论数
        # 这些数据通常通过JS动态加载，尝试从页面提取
        try:
            # 查找阅读数
            read_count = soup.find('span', class_='read_count3_num')
            if read_count:
                result["views"] = self._parse_number(read_count.get_text(strip=True))

            # 查找点赞数
            like_count = soup.find('span', className='like_num')
            if like_count:
                result["likes"] = self._parse_number(like_count.get_text(strip=True))
        except Exception as e:
            logger.warning(f"⚠️ 提取统计信息失败: {str(e)}")

        return result

    def extract_comments(self, html: str, url: str) -> List[Dict]:
        """提取公众号评论"""
        # 公众号评论需要通过API获取，这里尝试从页面提取
        comments = []
        soup = BeautifulSoup(html, 'lxml')

        # 尝试查找评论区域
        comment_area = soup.find('div', class_='comment_list') or soup.find('ul', class_='comment_list')

        if comment_area:
            comment_items = comment_area.find_all('li', class_='comment_item')
            for item in comment_items:
                content = item.find('p', class_='comment_content')
                if content:
                    comments.append({
                        "content": content.get_text(strip=True),
                        "author": "",
                        "likes": 0
                    })

        # 如果没有找到评论，可能需要通过API获取
        if not comments:
            logger.info("⚠️ 页面未发现评论，可能需要登录获取")

        return comments

    def _parse_number(self, text: str) -> int:
        """解析数字字符串"""
        if not text:
            return 0
        text = text.strip()
        # 处理万、十万等
        if '万' in text:
            return int(float(text.replace('万', '')) * 10000)
        elif '十万' in text:
            return int(float(text.replace('十万', '')) * 100000)
        try:
            return int(text.replace(',', ''))
        except:
            return 0

    def crawl_with_login(self, url: str) -> Dict:
        """
        需要登录的爬取（用于获取评论等）
        """
        import requests
        from playwright.sync_api import sync_playwright

        # 使用Playwright进行登录
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context()
            page = context.new_page()

            # 访问微信文章
            page.goto(url)
            page.wait_for_load_state('networkidle')

            # 获取cookies
            cookies = context.cookies()
            self.save_cookies(cookies)

            # 获取页面内容
            html = page.content()

            browser.close()

        return self.crawl(url)

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
内容抓取工具
支持从公众号、知乎、微博等平台抓取内容，并推送到飞书多维表格
"""

import argparse
import logging
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from crawler import create_crawler
from feishu import FeishuClient
from config import REQUEST_DELAY

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def crawl_single_url(url: str, push_to_feishu: bool = True, feishu_client: FeishuClient = None) -> dict:
    """
    抓取单个URL

    Args:
        url: 目标URL
        push_to_feishu: 是否推送到飞书
        feishu_client: 飞书客户端实例

    Returns:
        dict: 抓取结果
    """
    # 创建爬虫
    crawler = create_crawler(url)

    # 执行爬取
    result = crawler.crawl(url)

    if result.get("success"):
        data = result.get("data")

        # 打印结果摘要
        logger.info("=" * 50)
        logger.info(f"📄 标题: {data.get('title', '未知')}")
        logger.info(f"👤 作者: {data.get('author', '未知')}")
        logger.info(f"📅 发布日期: {data.get('publish_date', '未知')}")
        logger.info(f"❤️ 点赞: {data.get('likes', 0)}")
        logger.info(f"👁️ 阅读: {data.get('views', 0)}")
        logger.info(f"💬 评论: {data.get('comments_count', 0)}")
        logger.info("=" * 50)

        # 推送飞书
        if push_to_feishu and feishu_client:
            feishu_client.push_record(data)
    else:
        logger.error(f"❌ 抓取失败: {result.get('error')}")

    return result


def crawl_from_file(file_path: str, push_to_feishu: bool = True, feishu_client: FeishuClient = None) -> dict:
    """
    从文件读取URL列表进行批量抓取

    Args:
        file_path: URL列表文件路径
        push_to_feishu: 是否推送到飞书
        feishu_client: 飞书客户端实例

    Returns:
        dict: 抓取结果统计
    """
    if not os.path.exists(file_path):
        logger.error(f"❌ 文件不存在: {file_path}")
        return {"success": False, "error": "文件不存在"}

    # 读取URL列表
    with open(file_path, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    if not urls:
        logger.error("❌ 文件中没有有效的URL")
        return {"success": False, "error": "没有有效的URL"}

    logger.info(f"📋 共找到 {len(urls)} 个URL待抓取")

    # 逐个抓取
    success_count = 0
    failed_count = 0

    for i, url in enumerate(urls, 1):
        logger.info(f"\n[{i}/{len(urls)}] 正在抓取: {url}")
        result = crawl_single_url(url, push_to_feishu, feishu_client)
        if result.get("success"):
            success_count += 1
        else:
            failed_count += 1

    summary = {
        "total": len(urls),
        "success": success_count,
        "failed": failed_count
    }

    logger.info("\n" + "=" * 50)
    logger.info(f"📊 抓取完成！总计: {len(urls)}, 成功: {success_count}, 失败: {failed_count}")
    logger.info("=" * 50)

    return summary


def test_feishu():
    """测试飞书连接"""
    try:
        client = FeishuClient()
        return client.test_connection()
    except Exception as e:
        logger.error(f"❌ 飞书连接测试失败: {str(e)}")
        return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='内容抓取工具 - 从URL抓取内容并推送到飞书多维表格',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 抓取单个URL
  python main.py "https://mp.weixin.qq.com/s/xxx"

  # 抓取多个URL（从文件）
  python main.py -f urls.txt

  # 抓取但不推送到飞书
  python main.py "https://zhihu.com/xxx" --no-push

  # 测试飞书连接
  python main.py --test-feishu

  # 查看帮助
  python main.py -h
        """
    )

    parser.add_argument('url', nargs='?', help='要抓取的URL')
    parser.add_argument('-f', '--file', help='包含URL列表的文件（每行一个URL）')
    parser.add_argument('--no-push', action='store_true', help='只抓取不推送到飞书')
    parser.add_argument('--test-feishu', action='store_true', help='测试飞书连接')
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细日志')

    args = parser.parse_args()

    # 详细日志
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # 测试飞书连接
    if args.test_feishu:
        test_feishu()
        return

    # 检查URL参数
    if not args.url and not args.file:
        parser.print_help()
        return

    # 初始化飞书客户端（如果需要推送到飞书）
    feishu_client = None
    if not args.no_push:
        try:
            feishu_client = FeishuClient()
            if not test_feishu():
                logger.warning("⚠️ 飞书连接失败，将只抓取不推送")
                feishu_client = None
        except Exception as e:
            logger.warning(f"⚠️ 飞书初始化失败: {str(e)}，将只抓取不推送")
            feishu_client = None

    # 执行抓取
    if args.url:
        # 单个URL
        crawl_single_url(args.url, push_to_feishu=(feishu_client is not None), feishu_client=feishu_client)
    elif args.file:
        # URL列表文件
        crawl_from_file(args.file, push_to_feishu=(feishu_client is not None), feishu_client=feishu_client)


if __name__ == '__main__':
    main()

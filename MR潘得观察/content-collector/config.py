"""
配置文件
请根据实际情况修改以下配置
"""

# ========== 飞书配置 ==========
FEISHU_APP_ID = "your_app_id"          # 飞书应用ID
FEISHU_APP_SECRET = "your_app_secret"   # 飞书应用密钥
FEISHU_APP_TOKEN = "your_app_token"     # 多维表格App Token
FEISHU_TABLE_ID = "your_table_id"       # 多维表格Table ID

# ========== 微信登录配置（可选） ==========
# 如果需要抓取公众号评论，需要扫码登录
# 首次运行会自动打开浏览器，扫码后cookies会保存到本地
WECHAT_COOKIES_FILE = "cookies/wechat_cookies.json"

# ========== 知乎登录配置（可选） ==========
ZHIHU_COOKIES_FILE = "cookies/zhihu_cookies.json"

# ========== 爬虫配置 ==========
# 请求间隔（秒），避免请求过快被封
REQUEST_DELAY = 2

# 最大重试次数
MAX_RETRIES = 3

# 请求超时（秒）
REQUEST_TIMEOUT = 30

# ========== 多维表格字段映射 ==========
# 请确保与你的飞书多维表格列名一致
FIELDS_MAPPING = {
    "title": "标题",
    "url": "链接",
    "source": "来源",
    "author": "作者",
    "publish_date": "发布日期",
    "summary": "内容摘要",
    "likes": "点赞数",
    "views": "阅读数",
    "comments_count": "评论数",
    "top_comments": "热门评论",
    "crawl_time": "抓取时间"
}

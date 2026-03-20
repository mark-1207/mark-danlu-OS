"""
配置文件
请根据实际情况修改以下配置
"""

# ========== 飞书配置 ==========
FEISHU_APP_ID = "cli_a937bd1eba781bb3"           # 飞书应用ID
FEISHU_APP_SECRET = "Jsz8wdNz1blnmogCoIDM9z84MPLINQtr"  # 飞书应用密钥
FEISHU_APP_TOKEN = "LuBKbHrQvaIOQ6sGY99cymKRn4e"  # 多维表格App Token
FEISHU_TABLE_ID = "tblxBndasAxLD0M8"            # 多维表格Table ID

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

# ========== 翻译配置 ==========
# 翻译服务: google / deepL / openai
TRANSLATION_SERVICE = "google"

# OpenAI API Key (如果使用openai翻译)
# OPENAI_API_KEY = "your-openai-key"

# DeepL API Key (如果使用deepL翻译)
# DEEPL_API_KEY = "your-deepl-key"

# ========== 多维表格字段映射 ==========
# 现在代码会自动从API获取字段映射，此处保留用于参考
FIELDS_MAPPING = {}

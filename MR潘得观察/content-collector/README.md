# 内容抓取工具

从公众号、知乎、微博等平台抓取内容，并推送到飞书多维表格。

## 功能特性

- ✅ 支持多平台内容抓取（公众号、知乎、Medium、Reddit等）
- ✅ 自动提取标题、作者、发布日期、内容摘要
- ✅ 获取点赞数、阅读数、评论数
- ✅ 获取热门评论
- ✅ 推送到飞书多维表格
- ✅ 支持批量抓取（URL列表文件）

## 支持平台

| 平台 | 内容抓取 | 评论获取 | 备注 |
|------|:--------:|:--------:|------|
| 公众号 | ✅ | ✅ | 需扫码登录 |
| 知乎 | ✅ | ✅ | 公开内容 |
| 微博 | ✅ | ❌ | 公开内容 |
| Medium | ✅ | ❌ | 公开内容 |
| Reddit | ✅ | ✅ | 公开内容 |
| YouTube | ✅ | ✅ | 公开内容 |
| 其他网页 | ✅ | ❌ | 通用爬虫 |

## 环境要求

- Python 3.8+
- Windows / macOS / Linux

## 安装步骤

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

可选翻译服务（选择一种安装）：
```bash
# Google翻译（免费，但不稳定）
pip install googletrans

# DeepL翻译（付费，更准确）
pip install deepl

# OpenAI翻译（付费，质量最高）
pip install openai
```

如果使用 Playwright（可选，用于动态内容）：
```bash
playwright install chromium
```

### 2. 配置翻译（可选）

在 `config.py` 中设置翻译服务：

```python
TRANSLATION_SERVICE = "google"  # google / deepL / openai

# 如使用OpenAI翻译
import os
os.environ["OPENAI_API_KEY"] = "your-key"

# 如使用DeepL翻译
os.environ["DEEPL_API_KEY"] = "your-key"
```

### 3. 配置飞书

1. 打开 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业应用
3. 获取 `App ID` 和 `App Secret`
4. 添加权限：`bitable:record:write`
5. 将应用添加到你的多维表格

### 3. 配置多维表格

创建多维表格，字段如下：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 标题 | 文本 | 文章标题 |
| 链接 | 链接 | 文章URL |
| 来源 | 单选 | 公众号/知乎/Medium等 |
| 作者 | 文本 | 文章作者 |
| 发布日期 | 日期 | 发布时间 |
| 正文 | 文本 | 完整文章正文 |
| 内容摘要 | 文本 | 文章摘要（200字） |
| 译文 | 文本 | 外网内容的中文翻译 |
| 点赞数 | 数字 | 点赞数量 |
| 阅读数 | 数字 | 阅读量 |
| 评论数 | 数字 | 评论数量 |
| 热门评论 | 文本 | 高赞评论 |
| 抓取时间 | 日期 | 抓取时间 |

### 4. 修改配置文件

编辑 `config.py`：

```python
FEISHU_APP_ID = "your_app_id"
FEISHU_APP_SECRET = "your_app_secret"
FEISHU_APP_TOKEN = "your_app_token"  # 多维表格App Token
FEISHU_TABLE_ID = "your_table_id"   # 多维表格Table ID
```

获取 App Token：在多维表格URL中，`/bitable/` 后面的字符串
获取 Table ID：在多维表格URL中，`?table=` 后面的字符串

## 使用方法

### 抓取单个URL

```bash
python main.py "https://mp.weixin.qq.com/s/xxxx"
```

### 批量抓取

创建 `urls.txt` 文件，每行一个URL：

```
# 这是注释
https://mp.weixin.qq.com/s/xxx1
https://zhihu.com/question/xxx
https://medium.com/@user/xxx
```

执行批量抓取：

```bash
python main.py -f urls.txt
```

### 只抓取不推送

```bash
python main.py "https://xxx" --no-push
```

### 测试飞书连接

```bash
python main.py --test-feishu
```

## 输出示例

```
2024-01-15 10:30:00 - INFO - 🔄 开始爬取: https://mp.weixin.qq.com/s/xxx
2024-01-15 10:30:02 - INFO - ==================================================
2024-01-15 10:30:02 - INFO - 📄 标题: ChatGPT使用技巧大全
2024-01-15 10:30:02 - INFO - 👤 作者: 科技前沿
2024-01-15 10:30:02 - INFO - 📅 发布日期: 2024-01-10
2024-01-15 10:30:02 - INFO - ❤️ 点赞: 1234
2024-01-15 10:30:02 - INFO - 👁️ 阅读: 56789
2024-01-15 10:30:02 - INFO - 💬 评论: 45
2024-01-15 10:30:02 - INFO - ==================================================
2024-01-15 10:30:02 - INFO - ✅ 成功推送记录: ChatGPT使用技巧大全
2024-01-15 10:30:02 - INFO - ✅ 爬取完成: ChatGPT使用技巧大全
```

## 常见问题

### Q: 公众号评论获取失败？
A: 公众号评论需要登录态。首次运行会打开浏览器窗口，扫码登录后cookies会自动保存。

### Q: 部分网站抓取失败？
A: 一些网站有反爬机制，可以尝试增加请求间隔：
```python
REQUEST_DELAY = 3  # 改为3秒
```

### Q: 如何定时自动抓取？
A: 可以使用系统定时任务（Windows任务计划 / macOS crontab）：
```bash
# 每天早上9点执行
0 9 * * * cd /path/to/content-collector && python main.py -f urls.txt
```

## 项目结构

```
content-collector/
├── main.py              # 主入口
├── config.py            # 配置文件
├── requirements.txt     # Python依赖
├── README.md           # 说明文档
├── crawler/             # 爬虫模块
│   ├── __init__.py
│   ├── base.py         # 基类
│   ├── factory.py      # 工厂
│   ├── weixin.py       # 公众号
│   ├── zhihu.py        # 知乎
│   └── generic.py      # 通用
├── feishu/             # 飞书模块
│   ├── __init__.py
│   └── client.py       # 客户端
└── cookies/            # 登录cookies目录
```

## 后续扩展

当前版本采用紧耦合设计，后续可轻松拆分为API服务：

1. 将爬虫模块封装为REST API
2. 将飞书推送模块独立
3. 添加任务调度系统
4. 支持更多数据源

---

如有问题，请提交Issue。

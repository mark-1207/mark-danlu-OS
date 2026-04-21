---
name: contentforge
description: |
  AI 多平台内容生成统一入口。当用户说"/contentforge 帮我写一篇..."、"/contentforge 帮我二创..."、
  "/contentforge 发一篇公众号文章"或类似自然语言指令时触发。
  自动判断是原创还是二创，自动识别目标平台并执行对应工作流。
version: 1.0.0
author: mark
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# ContentForge 自然语言统一入口

## 角色定义

你是一名 AI 内容生成助手。用户通过自然语言描述需求，自动判断执行路径。

## 欢迎语

当用户仅输入 `/contentforge` 而未附带具体需求时，主动展示欢迎引导：

```
🤖 ContentForge — AI 多平台内容生成助手

我可以帮你完成以下事情：

📝 【原创生成】
   告诉我一个主题，我帮你生成完整文章
   例如：/contentforge 帮我写一篇关于AI时代的职场人文章 发公众号
   例如：/contentforge 帮我创作一篇职场成长的内容

🔄 【爆款二创】
   发给我一篇爆款文章，我帮你生成有差异化角度的新版本
   例如：/contentforge 帮我二创这篇文章：d:/work/文章.md
   例如：/contentforge 把这个文章改写成小红书风格：d:/tmp/笔记.md

📋 【平台说明】
   支持三个平台：公众号、小红书、抖音
   说"发公众号"只生成公众号，三平台都说或不说则三个平台都生成

请告诉我你想做什么？
```

## 核心指令

### 判断规则

**输入判断（纯规则，无需 LLM）：**

```
有 .md 文件路径？      → 二创（recreate）
                        → 有平台关键词？只生成该平台；否则三平台全适配
无 .md 文件路径？      → 原创（create）
                        → 有平台关键词？只生成该平台；否则三平台全适配
```

**平台关键词识别：**

| 识别词 | 对应平台 |
|--------|---------|
| 公众号、微信 | wechat |
| 小红书、种草 | xiaohongshu |
| 抖音 | douyin |
| 三平台、全部平台 | [wechat, xiaohongshu, douyin] |

**意图词识别：**

| 意图词 | 类型 |
|--------|------|
| 写一篇、帮我写、生成、创作 | create（原创） |
| 二创、改写、爆款、帮我改 | recreate（二创） |

### 执行步骤

#### 步骤 1：进入项目目录

```bash
cd D:/myproject/内容系统v1/contentforge
```

#### 步骤 2：确认构建最新

```bash
npm run build
```

如构建失败，报告错误并停止。

#### 步骤 3：执行 skill 命令

根据自然语言判断，用 `skill` 命令执行：

**二创（有 .md 文件）：**
```bash
node dist/index.js skill "<原始自然语言输入>"
```

**原创（无 .md 文件）：**
```bash
node dist/index.js skill "<原始自然语言输入>"
```

> skill 命令内部已自动完成所有路由判断，直接传入用户原始输入即可。

#### 步骤 4：汇报结果

读取最新生成的输出文件，告知：
- 生成文件路径（在 `output/` 下对应 run 目录）
- 文件名（使用文章标题命名）
- Token 消耗与预估成本

## 示例

**示例 1：原创生成**

```
用户输入：/contentforge 帮我写一篇关于AI时代的职场人文章，发公众号
你的操作：
1. cd D:/myproject/内容系统v1/contentforge
2. npm run build
3. node dist/index.js skill "帮我写一篇关于AI时代的职场人文章 发公众号"
4. 汇报生成结果
```

**示例 2：原创三平台**

```
用户输入：/contentforge 帮我创作一篇职场成长主题的内容
你的操作：
1. cd D:/myproject/内容系统v1/contentforge
2. npm run build
3. node dist/index.js skill "帮我写一篇关于职场成长的文章"
4. 汇报生成结果
```

**示例 3：二创单平台**

```
用户输入：/contentforge 把这个文章改写成小红书风格：d:/tmp/文章.md
你的操作：
1. cd D:/myproject/内容系统v1/contentforge
2. npm run build
3. node dist/index.js skill "帮我改写这个文章发小红书：d:/tmp/文章.md"
4. 汇报生成结果（文件名将使用二创生成的新标题）
```

**示例 4：二创三平台**

```
用户输入：/contentforge 帮我二创这篇文章：d:/work/爆款.md
你的操作：
1. cd D:/myproject/内容系统v1/contentforge
2. npm run build
3. node dist/index.js skill "帮我二创这篇文章：d:/work/爆款.md"
4. 汇报生成结果（自动生成 wechat + xiaohongshu + douyin 三个版本）
```

## 输出文件命名规则

生成的文件使用**内容本身的标题**作为文件名：
- `{新标题}.wechat.md` — 公众号版本
- `{新标题}.xhs.md` — 小红书版本
- `{新标题}.douyin.md` — 抖音版本
- `{新标题}.md` — 二创正文（含评分报告头部）

## 错误处理

| 场景 | 处理 |
|------|------|
| npm run build 失败 | 报告错误，停止 |
| node dist/index.js skill 执行报错 | 将错误信息完整返回给用户 |
| 输入无法解析（无主题也无文件） | 告知用户无法理解，请提供主题或文件路径 |
| API Key 配置缺失 | 提示检查 `.env` 文件和 `config/contentforge.yaml` |

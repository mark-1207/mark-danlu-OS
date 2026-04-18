# ContentForge 使用手册

> 本手册面向零基础用户。如果你已经了解 ContentForge 的基本功能，可以直接跳到[快速入门](#快速入门)开始使用。

---

## 这个工具能做什么？

ContentForge 是一个**用 AI 自动写文章的工具**。你给它一个关键词或一篇爆款文章，它就能帮你生成适配不同平台的高质量内容。

**它有两种主要工作模式：**

### 模式一：从零创作（create）

你告诉它一个主题词（比如"AI"），它帮你生成三篇文章，分别适配：

- **微信公众号** — 严谨深度，结构完整
- **小红书** — 轻松活泼，emoji 表情多，标签丰富
- **抖音** — 短平快，信息密度高

### 模式二：爆款改写（二创，recreate）

你给它一篇网上已经爆火的文章，它帮你生成**有差异化角度的新版本**。

举个例子：某篇"年轻人为什么开始爱上户外运动"的文章很火，ContentForge 可以生成一个"从职场压力角度切入"的二创版本，或者一个"从社交媒体算法推荐角度"的新版本。

**二创不是洗稿**——它会保留原文的"爆款基因"（比如标题结构、情绪调动方式），但换一个新的切入角度和叙事方式。

---

## 开始之前你需要准备什么？

### 1. Node.js

ContentForge 是用 Node.js 运行的。确认你已安装：

```bash
node --version
# 显示版本号即可，如：v20.x.x
```

如果没有，去 [https://nodejs.org](https://nodejs.org) 下载安装。

### 2. AI API Key

ContentForge 需要调用 AI 模型来生成内容，需要一个 API Key。

**推荐使用月之暗面 Kimi（国内可用）：**

1. 打开 [yunwu.ai](https://yunwu.ai)，注册账号
2. 在后台找到 API Key（是一串类似 `sk-xxxx` 的字符）
3. 复制备用

你也可以用 OpenAI 的 Key，但 OpenAI 在国内访问不稳定。

### 3. 文章素材（仅二创模式需要）

如果你要用**爆款二创**功能，需要准备：

- 一篇你想改写的爆款文章（`.md` 纯文本格式）
- 内容要足够长（建议 500 字以上），太短的文章无法分析

---

## 安装与配置

### 第一步：安装依赖

```bash
# 进入项目目录
cd contentforge

# 安装依赖
pnpm install

# 构建项目
pnpm run build
```

### 第二步：配置 API Key

有两种方式（任选一种）：

**方式 A：环境变量文件（推荐）**

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
KIMI_API_KEY=sk-your-key-here
KIMI_BASE_URL=https://yunwu.ai/v1
```

**方式 B：直接修改配置文件**

编辑 `contentforge.config.yaml`，在 `providers.kimi` 下填入：

```yaml
providers:
  kimi:
    type: kimi
    defaultModel: claude-sonnet-4-6
    apiKey: sk-your-key-here        # ← 填这里
    baseUrl: https://yunwu.ai/v1
```

### 第三步：验证安装成功

```bash
node dist/index.js --version
```

看到版本号输出即表示安装成功。

---

## 快速入门

### 方式一：从关键词生成原创文章

```bash
node dist/index.js create --keyword "AI"
```

> 如果提示找不到 `dist/index.js`，先运行 `pnpm run build`。

**整个过程大约 1-3 分钟**，终端会显示每一步的进度：

```
Step 1/6  主题深挖        分析 AI 相关的子话题、痛点、热门角度
Step 2/6  选题分配        为三个平台分别选定差异化切入角度
Step 3/6  大纲生成        生成各平台的内容大纲
Step 4/6  素材检索        搜索支撑论点的数据/案例
Step 5/6  全文生成        撰写三篇完整文章
Step 6/6  审校优化        检查质量、优化标题、输出评分报告

✅ 生成完成
```

生成的内容在 `output/create_时间戳/` 目录下。

---

### 方式二：对爆款文章进行二创

准备一篇爆款文章（比如 `input/爆款文章.md`），运行：

```bash
node dist/index.js recreate --input input/爆款文章.md
```

**过程说明：**

```
Step 1  爆款解构        分析原文为什么能火（标题、开头、结构、情绪）
Step 2  差异化方向      生成 3-5 个不同角度供选择
Step 3  新大纲生成      基于选定角度规划新文章结构
Step 4  全文生成        写出完整二创文章
Step 5  双重审查        检查原创度 + 评估爆款潜力

✅ 二创完成
```

**二创完成后会自动做什么？**

生成的二创文章会自动复制一份到 `output/corpus/original/` 目录，ContentForge 会用这些已二创的文章来学习你的改写风格，让后续二创结果越来越接近你的个人偏好。

---

## 常用命令参考

### create — 原创生成

| 命令 | 说明 |
|------|------|
| `create --keyword "AI"` | 生成 AI 主题的三平台文章 |
| `create --keyword "职场成长" --platforms wechat` | 只生成公众号文章 |

### recreate — 爆款二创

| 命令 | 说明 |
|------|------|
| `recreate --input 文章.md` | 自动选最佳角度二创 |
| `recreate --input 文章.md --direction interactive` | 显示所有角度让你自己选 |
| `recreate --input 文章.md --platforms wechat,xiaohongshu` | 二创后适配公众号和小红书 |

### resume — 断点续跑

如果运行到一半失败了（比如网络断），可以用这个命令从断点继续：

```bash
# 列出最近的运行记录
node dist/index.js resume list

# 从上次的断点继续
node dist/index.js resume <运行ID>
```

### learn — 碎片库学习

碎片库是 ContentForge 学习你的写作风格的地方。运行二创后，文章会自动入库，也可以手动管理：

| 命令 | 说明 |
|------|------|
| `learn` | 对 `output/corpus/` 下的新文章进行增量学习 |
| `learn --stats` | 查看碎片库统计（有多少碎片、来源等） |
| `learn --list` | 列出碎片库里的所有碎片 |
| `learn --decay` | 清理长期不用的碎片（保持库的健康度） |

### config — 查看配置

```bash
node dist/index.js config
```

### batch — 批量生成

准备一个文本文件，每行一个关键词：

```bash
# 关键词列表.txt 内容：
AI
职场成长
健康生活
副业
```

然后运行：

```bash
node dist/index.js batch --input 关键词列表.txt --scenario create
```

---

## 生成的文件都放在哪了？

每次运行都会在 `output/` 目录下创建一个带时间戳的文件夹：

```
output/
├── create_20260418_143052/     # 原创生成
│   ├── content-wechat.md        # 公众号文章
│   ├── content-xiaohongshu.md   # 小红书文章
│   └── ...
├── recreate_20260418_150230/     # 爆款二创
│   ├── recreation.md             # 二创总结报告
│   └── ...
└── corpus/                       # 碎片库（自动积累）
    ├── original/                 # 原始文章 + 二创文
    └── fragment-library.json     # 碎片数据库
```

**不需要删除这些文件夹**——它们是 ContentForge 学习你的写作风格的素材来源。

---

## 输入文件格式要求

ContentForge 接受**纯文本 Markdown 文件**（`.md`）作为输入。

### 可以输入什么？

- 从微信公众号复制的文章（ContentForge 会自动去掉 HTML 标签）
- 从笔记软件导出的 Markdown 文件
- 纯文本文件（`.txt`）

### 不能输入什么？

- 纯链接列表（如"这是链接：https://..."）
- 只有标题没有正文
- 被截断的文章（列表写到一半突然结束）
- 太短的内容（少于 200 字）

如果输入了不支持的内容，ContentForge 会给出明确的错误提示。

---

## 理解二创的评分报告

每次二创完成后，会生成 `recreation.md` 文件，里面有评分信息：

```
| 维度 | 评分 |
|---|---|
| 标题吸引力 | 8/10 |
| 开头留存率 | 7/10 |
| 内容价值感 | 8/10 |
| 情绪调动力 | 7/10 |
| 互动引导力 | 6/10 |
```

这些分数代表 AI 对这篇文章"能不能火"的评估，仅供参考。

**原创性分数**：`X/10`，如果低于及格线会提示 `❌ 未通过`。

---

## 常见问题

### Q：运行时报错 "API Key 无效"

检查 `.env` 或 `contentforge.config.yaml` 中的 API Key 是否正确填入，Key 前后不要有多余空格。

### Q：运行时报错 "内容为空"

输入的文章太短或格式不对。确保文章有正文内容，不是纯标题或纯链接。

### Q：运行很慢

正常现象，AI 生成文章需要时间（约 1-3 分钟）。可以在 `contentforge.config.yaml` 中调高 `concurrency.maxParallel` 来加速（不建议超过 5）。

### Q：生成的文章不满意

- **从关键词生成的文章**：可以重新生成（换一个 `temperature` 值，配置文件中可以调高创造性）
- **二创文章**：可以用 `--direction interactive` 手动选择不同的角度重新生成

### Q：想同时生成多个关键词的内容

使用 batch 命令：

```bash
node dist/index.js batch --input my-keywords.txt --scenario create
```

### Q：二创后文章自动入库是什么原理？

ContentForge 会把每次二创的原文和二创版本成对保存，学习你改写文章的方式（句式偏好、结构偏好、情绪基调等），随着入库内容增加，后续二创结果会更贴近你的个人风格。

### Q：如何清理碎片库？

```bash
# 查看碎片库状态
node dist/index.js learn --stats

# 执行老化扫描，清理长期不用的碎片
node dist/index.js learn --decay
```

---

## 配置参考

编辑 `contentforge.config.yaml` 可以调整行为：

```yaml
# 场景参数
scenarios:
  recreate:
    steps:
      viral-deconstruction:
        temperature: 0.3   # 越低越保守，越高越有创意

# 成本控制（避免单次消耗过高）
costControl:
  maxCostPerRun: 0.5    # 最高预估成本（美元）
  onExceedAction: skip-local-rewrite  # 超限时跳过精细优化

# 搜索功能（素材检索用）
search:
  enabled: false         # true 开启素材搜索
```

---

## 命令速查

| 命令 | 用途 |
|------|------|
| `node dist/index.js create --keyword "主题"` | 从关键词生成三平台文章 |
| `node dist/index.js recreate --input 文件.md` | 对文章进行二创 |
| `node dist/index.js resume list` | 列出历史运行 |
| `node dist/index.js resume <ID>` | 从断点继续 |
| `node dist/index.js learn` | 更新碎片库 |
| `node dist/index.js learn --stats` | 查看碎片库统计 |
| `node dist/index.js learn --list` | 列出所有碎片 |
| `node dist/index.js batch --input 文件.txt` | 批量生成 |
| `node dist/index.js config` | 查看当前配置 |

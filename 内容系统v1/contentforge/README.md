# ContentForge — AI 多平台内容生成工具

ContentForge 是一个**智能内容生成引擎**，你给它一个关键词，它就能自动生成适配**微信公众号、小红书、抖音**三个平台的高质量文章。也可以输入一篇爆款文章，让 AI 为你生成差异化的二创版本。

---

# 目录

- [快速入门](#快速入门)
- [安装与配置](#安装与配置)
- [使用场景](#使用场景)
- [命令参考](#命令参考)
- [生成的文件](#生成的文件)
- [输入文件格式](#输入文件格式)
- [理解评分报告](#理解评分报告)
- [常见问题](#常见问题)
- [配置参考](#配置参考)
- [开发指南](#开发指南)

---

## 快速入门

### 方式一：从关键词生成原创文章

```bash
node dist/index.js create --keyword "AI"
```

整个过程大约 1-3 分钟，终端会显示每一步的进度：

```
Step 1/6  主题深挖        分析 AI 相关的子话题、痛点、热门角度
Step 2/6  选题分配        为三个平台分别选定差异化切入角度
Step 3/6  大纲生成        生成各平台的内容大纲
Step 4/6  素材检索        搜索支撑论点的数据/案例
Step 5/6  全文生成        撰写三篇完整文章
Step 6/6  审校优化        检查质量、优化标题、输出评分报告

✅ 生成完成
```

### 方式二：对爆款文章进行二创

准备一篇爆款文章（`.md` 格式），运行：

```bash
node dist/index.js recreate --input input/爆款文章.md
```

二创完成后会自动将原文和二创版本存入碎片库，用于学习你的改写风格。

```
Step 1  爆款解构        分析原文为什么能火（标题、开头、结构、情绪）
Step 2  差异化方向      生成 3-5 个不同角度供选择
Step 3  新大纲生成      基于选定角度规划新文章结构
Step 4  全文生成        写出完整二创文章
Step 5  双重审查        检查原创度 + 评估爆款潜力

✅ 二创完成
```

---

## 安装与配置

### 第一步：安装依赖

```bash
cd contentforge
pnpm install
pnpm run build
```

### 第二步：配置 API Key

**方式 A：环境变量文件（推荐）**

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
KIMI_API_KEY=sk-your-key-here
KIMI_BASE_URL=https://yunwu.ai/v1
```

**方式 B：修改配置文件**

编辑 `contentforge.config.yaml`，在 `providers.kimi` 下添加 `apiKey`。

### 第三步：验证安装成功

```bash
node dist/index.js --version
```

> **推荐使用月之暗面 Kimi**（[yunwu.ai](https://yunwu.ai)，国内可用）。也可以使用 OpenAI API，但需要海外服务器。

---

## 使用场景

### 场景 A：从关键词生成原创文章

**输入**：一个关键词（比如"AI"）
**输出**：公众号、小红书、抖音三篇适配各平台的原创文章

```bash
contentforge create --keyword "AI"
```

生成的文件在 `output/create_时间戳/` 目录下。

### 场景 B：爆款文章二创

**输入**：一篇爆款文章
**输出**：具有差异化角度的二创文章

```bash
# 自动选择最佳方向
contentforge recreate --input ./我的爆款文章.md

# 交互式选择（自己挑选二创方向）
contentforge recreate --input ./我的爆款文章.md --direction interactive

# 指定目标平台
contentforge recreate --input ./我的爆款文章.md --platforms wechat,xiaohongshu
```

---

## 命令参考

### create — 原创生成

```bash
contentforge create --keyword "关键词"          # 生成三平台文章
contentforge create --keyword "AI" --platforms wechat   # 只生成公众号文章
```

### recreate — 爆款二创

```bash
contentforge recreate --input <文件路径>                    # 自动选最佳角度
contentforge recreate --input <文件路径> --direction interactive   # 交互选择角度
contentforge recreate --input <文件路径> --platforms wechat,xhs  # 指定平台
```

### resume — 断点续跑

```bash
contentforge resume list                    # 列出最近运行记录
contentforge resume <运行ID>                # 从上次断点继续
contentforge resume <运行ID> --from-step <步骤名>   # 从指定步骤继续
```

### learn — 碎片库管理

碎片库存储 ContentForge 从你的文章中学习的写作风格碎片（句式、段落结构等）。

```bash
contentforge learn                        # 对 output/corpus/ 下新文章增量学习
contentforge learn --stats                 # 查看碎片库统计
contentforge learn --list                  # 列出所有碎片
contentforge learn --list --by-source      # 按来源（edited/external）列出
contentforge learn --decay                 # 清理老旧碎片
contentforge learn --delete <fragment-id>  # 删除指定碎片
contentforge learn --inspect <runId>      # 查看某次分析的碎片来源
```

### batch — 批量执行

```bash
# 准备关键词列表文件（每行一个）
contentforge batch --input ./关键词列表.txt --scenario create
```

### config — 查看配置

```bash
contentforge config              # 查看当前配置
contentforge config --file ./my-config.yaml   # 查看指定配置文件
```

---

## 生成的文件

每次运行都会在 `output/` 目录下创建一个带时间戳的文件夹：

```
output/
├── create_20260418_143052/     # 原创生成
│   ├── content-wechat.md        # 公众号文章
│   ├── content-xiaohongshu.md   # 小红书文章
│   ├── content-douyin.md        # 抖音文案
│   ├── review-wechat.json       # 审校报告
│   └── ...
├── recreate_20260418_150230/     # 爆款二创
│   ├── recreation.md             # 二创总结报告
│   ├── recreation.wechat.md       # 公众号适配版（如指定）
│   ├── recreation.xhs.md          # 小红书适配版（如指定）
│   ├── viral-genome-snapshot.json # 病毒基因组快照
│   └── ...
└── corpus/                       # 碎片库
    ├── original/                  # 原文+二创文（自动积累）
    ├── edited/                   # 配对原文（手动放入）
    ├── external/                 # 外部参考文（手动放入）
    └── fragment-library.json      # 碎片数据库
```

---

## 输入文件格式

**接受格式**：纯文本 Markdown 文件（`.md`）

**支持的内容来源**：

- 从微信公众号复制的文章（ContentForge 会自动去除 HTML 标签）
- 从笔记软件导出的 Markdown 文件
- 纯文本文件（`.txt`）

**不支持的内容**（会报错退出）：

- 纯链接列表（无正文）
- 只有标题没有正文
- 被截断的文章（列表写到一半突然结束）
- 太短的内容（少于 200 字会报错，200-500 字会警告但继续）

---

## 理解评分报告

每次二创完成后，`recreation.md` 里有详细的评分信息：

| 维度 | 含义 |
|------|------|
| 标题吸引力 | 标题能否让人想点进来 |
| 开头留存率 | 开头能否让人继续读下去 |
| 内容价值感 | 内容是否让人觉得有收获 |
| 情绪调动力 | 内容能否调动读者情绪 |
| 互动引导力 | 能否引导读者点赞、评论、转发 |

分数 6-10 分代表"有爆款潜力"，仅供参考。

**原创性分数**：`X/10`，低于及格线会提示 `❌ 未通过`。

---

## 常见问题

**Q：报错"API Key 无效"**
检查 `.env` 或 `contentforge.config.yaml` 中的 API Key 是否正确，Key 前后不要有多余空格。

**Q：报错"内容为空"或"内容过短"**
输入的文章太短或格式不对。确保文章有正文内容，不是纯标题或纯链接。建议至少 500 字以上。

**Q：二创后自动入库是什么原理？**
每次二创完成后，ContentForge 会把原文和二创版本成对保存，学习你的改写方式（句式偏好、结构偏好、情绪基调等）。入库内容越多，后续二创结果越贴近你的个人风格。

**Q：想清理碎片库怎么办？**
```bash
node dist/index.js learn --stats   # 查看当前状态
node dist/index.js learn --decay  # 清理长期不用的碎片
```

**Q：生成的文章不满意怎么办？**
- create 模式：调整 `temperature` 参数（配置文件中，越高越有创意）
- recreate 模式：用 `--direction interactive` 手动选择不同角度重新生成

**Q：运行很慢怎么办？**
正常现象，AI 生成文章需要 1-3 分钟。可以在配置中调高 `concurrency.maxParallel` 来加速（不建议超过 5）。

**Q：三个平台生成是同时进行的吗？**
是的，create 模式下三个平台的内容是并行生成的。

---

## 配置参考

编辑 `contentforge.config.yaml`：

```yaml
# AI 服务商配置
providers:
  kimi:
    type: kimi
    defaultModel: claude-sonnet-4-6
    apiKey: sk-your-key-here
    baseUrl: https://yunwu.ai/v1

defaultProvider: kimi

# 场景参数（temperature 越高越有创意，越低越保守）
scenarios:
  recreate:
    steps:
      viral-deconstruction:
        temperature: 0.3

# 成本控制（避免单次消耗过高）
costControl:
  maxCostPerRun: 0.5          # 最高预估成本（美元）
  onExceedAction: skip-local-rewrite   # 超限时代为：跳过精细优化 或 abort 中止

# 素材搜索（需要 API Key）
search:
  enabled: false              # true 开启
  provider: tavily             # 或 serper、bing
```

---

## 开发指南

### 项目结构

```
contentforge/
├── src/
│   ├── cli/commands/          # 命令行命令定义
│   ├── core/                  # 核心引擎（Pipeline、Step、Context）
│   ├── config/                # 配置加载
│   ├── llm/                   # AI 模型适配层
│   ├── prompts/               # AI 提示词模板
│   ├── scenarios/
│   │   ├── create/           # 原创生成场景
│   │   └── recreate/         # 爆款二创场景
│   ├── fragment-library/       # 碎片库
│   └── utils/                 # 工具函数
├── .claude/skills/             # 项目专属 Skills
│   ├── contentforge-recreate/  # 二创工作流 Skill
│   └── contentforge-learn/     # 碎片库学习 Skill
├── output/                     # 生成的内容
├── tests/                      # 单元测试
├── contentforge.config.yaml    # 配置文件
└── USER_GUIDE.md              # 用户手册（面向普通用户）
```

### 开发命令

```bash
pnpm run build     # 构建项目
pnpm run dev       # 开发模式
pnpm run test      # 运行测试
pnpm run typecheck # TypeScript 类型检查
```

### 相关文档

- [USER_GUIDE.md](./USER_GUIDE.md) — 完整用户手册（面向普通用户）
- `docs/superpowers/plans/` — 开发计划文档
- `docs/superpowers/specs/` — 设计规格文档

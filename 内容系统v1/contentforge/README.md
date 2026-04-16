# ContentForge — AI 多平台内容生成工具

ContentForge 是一个**智能内容生成引擎**，你给它一个关键词，它就能自动生成适配**微信公众号、小红书、抖音**三个平台的高质量文章。也可以输入一篇爆款文章，让 AI 为你生成差异化的二创版本。

---

## 十分钟快速上手

### 第一步：安装

确保你已安装 Node.js 20+ 和 pnpm。

```bash
cd contentforge
pnpm install
pnpm run build
```

### 第二步：配置 API Key

复制环境变量模板并填入你的 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
KIMI_API_KEY=你的Kimi_API密钥
KIMI_BASE_URL=https://yunwu.ai/v1
```

> **没有 API Key？**
> - 推荐使用 [yunwu.ai](https://yunwu.ai)（提供 OpenAI 兼容接口，国内可用）
> - 或使用 OpenAI API（需要海外服务器）

### 第三步：运行

```bash
# 方式一：直接运行（开发调试用）
node dist/index.js create --keyword "AI"

# 方式二：安装为全局命令
npm install -g .  # 安装后可用 contentforge 命令

# 方式三：使用 pnpm（无需安装）
pnpm run dev -- create --keyword "AI"
```

---

## 使用场景

### 场景 A：从关键词生成原创文章

**输入**：一个关键词（比如"AI"）  
**输出**：公众号、小红书、抖音三篇适配各平台的原创文章

```bash
contentforge create --keyword "AI"
```

生成过程：

```
Step 1/6  主题深挖        分析 AI 相关的子话题、痛点、热门角度
Step 2/6  选题分配        为三个平台分别选定差异化切入角度
Step 3/6  大纲生成        生成各平台的内容大纲
Step 4/6  素材检索        搜索支撑论点的数据/案例（可选）
Step 5/6  全文生成        撰写三篇完整文章
Step 6/6  审校优化        检查质量、优化标题、输出评分报告
```

生成的文件在 `output/create_时间戳/` 目录下：

```
output/create_1234567890/
├── run-meta.json           # 运行摘要
├── topic-analysis.json     # 主题分析结果
├── topic-assignment.json   # 三平台选题分配
├── outline-wechat.json      # 公众号大纲
├── outline-xiaohongshu.json # 小红书大纲
├── outline-douyin.json      # 抖音大纲
├── material-search.json     # 素材搜索结果
├── content-wechat.md        # 公众号文章终稿
├── content-xiaohongshu.md   # 小红书文章终稿
├── content-douyin.md        # 抖音文案终稿
├── review-wechat.json       # 公众号审校报告
├── review-xiaohongshu.json  # 小红书审校报告
└── review-douyin.json       # 抖音审校报告
```

---

### 场景 B：爆款文章二创

**输入**：一篇爆款文章  
**输出**：具有差异化角度的二创文章

```bash
# 自动选择最佳方向（二创）
contentforge recreate --input ./我的爆款文章.md

# 交互式选择（自己挑选二创方向）
contentforge recreate --input ./我的爆款文章.md --direction interactive
```

生成过程：

```
Step 1  爆款解构        分析原文的爆款基因（结构、情绪、金句）
Step 2  差异化方向      生成 3-5 个二创角度建议
Step 3  新大纲生成      基于选定方向生成新大纲
Step 4  全文生成        撰写二创文章
Step 5  双重审查        检查原创度 + 爆款潜力，循环优化
```

---

## 命令行参数

### create — 原创生成

```bash
contentforge create --keyword "关键词"
```

| 参数 | 说明 |
|------|------|
| `--keyword` | 必填，要生成内容的主题关键词 |

### recreate — 爆款二创

```bash
contentforge recreate --input <文件路径> --direction <auto|interactive>
```

| 参数 | 说明 |
|------|------|
| `--input, -i` | 必填，爆款文章的文件路径 |
| `--direction, -d` | 方向选择模式：`auto`（自动）或 `interactive`（交互式） |

### config — 查看配置

```bash
contentforge config                    # 查看当前配置
contentforge config --show            # 同上
contentforge config --file ./my-config.yaml   # 查看指定配置文件
```

### resume — 断点续跑

```bash
contentforge resume list                    # 列出最近运行记录
contentforge resume steps <运行ID>         # 查看某次运行的状态
contentforge resume <运行ID> --from-step <步骤名>   # 从断点恢复
```

> 断点续跑可以让你从上次失败的步骤继续，不必从头开始。

### batch — 批量执行

```bash
contentforge batch --input ./关键词列表.txt --scenario create
```

| 参数 | 说明 |
|------|------|
| `--input, -i` | 必填，关键词列表文件（每行一个关键词） |
| `--scenario, -s` | 场景类型：`create`（默认）或 `recreate` |
| `--direction, -d` | 方向：`auto`（默认）或 `interactive` |

---

## 配置文件

默认配置文件为 `contentforge.config.yaml`。

主要配置项：

```yaml
# 内容forge.config.yaml

# LLM 服务商配置
providers:
  kimi:
    type: kimi
    defaultModel: claude-sonnet-4-6
    baseUrl: https://yunwu.ai/v1

defaultProvider: kimi

# 场景参数配置
scenarios:
  create:
    steps:
      topic-analysis:
        temperature: 0.7      # 创造性程度（0-1，越高越有创意）
        maxTokens: 8192       # 最大输出长度
      # ...

# 搜索功能配置（素材检索用）
search:
  enabled: false              # true 启用搜索API
  provider: tavily            # 或 serper、bing
  apiKey: 你的搜索API密钥
```

---

## 工作原理（小白科普）

ContentForge 的核心是一个**多步骤 Pipeline（流水线）**：

```
关键词 → [主题深挖] → [选题分配] → [大纲生成] → [素材检索] → [全文生成] → [审校优化] → 三平台文章
          ↑_______________各平台并行生成_______________↑
```

**为什么分成这么多步？**

| 步骤 | 作用 |
|------|------|
| 主题深挖 | 让 AI 充分理解这个主题，找出角度和受众 |
| 选题分配 | 确保三个平台的文章角度各不相同 |
| 大纲生成 | 先规划结构，避免文章跑偏 |
| 素材检索 | 搜索真实数据/案例支撑内容 |
| 全文生成 | 按大纲写出完整文章 |
| 审校优化 | 检查错误、优化标题、提升质量 |

每一步的产出都会**保存到本地文件**，你可以随时查看、修改，甚至单独重做某一步。

---

## 常见问题

**Q: 运行很慢怎么办？**  
A: 三个平台的内容是同时生成的（并行）。如果 API 限流，可以在配置中调低 `concurrency.maxParallel`。

**Q: 素材检索没结果？**  
A: 默认关闭搜索功能。如需启用，在 `contentforge.config.yaml` 中设置 `search.enabled: true`，并填入 `search.apiKey`。

**Q: 生成的文章不满意？**  
A: 可以单独重做某一步：`contentforge resume <运行ID> --from-step review-optimization`

**Q: 如何添加新平台（如知乎）？**  
A: 需要：1) 在 `src/strategies/` 添加平台策略文件；2) 在 `src/scenarios/create/steps/` 添加大纲和内容生成步骤；3) 在 `src/scenarios/create/types.ts` 添加类型定义。

---

## 项目结构

```
contentforge/
├── src/
│   ├── cli/           # 命令行界面
│   ├── core/          # 核心引擎（Pipeline、Step、Context）
│   ├── config/        # 配置文件加载
│   ├── llm/           # AI 模型适配层
│   ├── prompts/       # AI 提示词模板
│   ├── scenarios/     # 场景定义
│   │   ├── create/    # 场景A：原创生成
│   │   └── recreate/ # 场景B：爆款二创
│   ├── storage/       # 文件存储
│   └── utils/         # 工具函数
├── output/            # 生成的内容（自动创建，勿删除）
├── tests/             # 单元测试
└── contentforge.config.yaml  # 配置文件
```

---

## 开发命令

```bash
pnpm run build     # 构建项目
pnpm run dev       # 开发模式（直接运行 src）
pnpm run test      # 运行测试
pnpm run typecheck # TypeScript 类型检查
```

# ContentForge 完整工作流

## 一、架构总览

```
用户输入
    │
    ├─ 有 .md 文件路径? ────→ 二创 (recreate) — 单阶段
    │
    └─ 无 .md 文件路径? ────→ 原创 (create) — 多阶段协议
                                  │
                           Phase outline → material-gap → content-draft → review
                           或一次性 full
```

**入口文件**: `src/cli/commands/skill.ts`
**核心路由**: `parseIntent()` — 纯规则匹配，无需 LLM
**CLI 层 invoke**: 外部（Claude Code / 终端）通过 `node dist/index.js skill "<自然语言>" [--phase X] [--run-id Y]` 触发

---

## 二、原创 (Create) 完整流程

### 2.1 入口与路由

| 步骤 | 文件 | 说明 |
|------|------|------|
| CLI 注册 | `src/cli/commands/skill.ts:152-173` | `skill` 命令，接受 `--phase` `--run-id` |
| 意图解析 | `src/cli/commands/skill.ts:71-124` | `parseIntent()` 判断类型、提取平台 |
| 执行入口 | `src/cli/commands/skill.ts:126-150` | `runSkill()` 根据 intent.type 分发 |
| Create 入口 | `src/cli/commands/create.ts` | `runCreate()` 根据 `phase` 参数分流 |

### 2.2 Pipeline 步骤

```
buildCreatePipeline(config, platforms)
    → 步骤:
        1. topic-analysis     主题深挖 (LLM)
        2. topic-assignment   话题分配 (LLM)
        3. outline-wechat     大纲 (LLM + Obsidian素材)
        4. outline-xiaohongshu
        5. outline-douyin
        6. material-search    素材搜索 (Web Search API)
        7. content-wechat     正文生成 (LLM + 素材)
        8. content-xiaohongshu
        9. content-douyin
       10. review-wechat      质量审查 (LLM)
       11. review-xiaohongshu
       12. review-douyin
```

**文件**: `src/scenarios/create/index.ts`

### 2.3 多阶段协议

支持 5 种 phase，可通过 `--phase` 参数指定执行的阶段范围：

| phase | 执行范围 | 前置条件 | 输出 |
|-------|---------|---------|------|
| `full` | 步骤 1-12（全量执行） | 无 | 文章 .md |
| `outline` | 步骤 1-5（大纲） | 无 | JSON 摘要 |
| `material-gap` | 恢复 context → 步骤 6（素材搜索） | `--run-id` 需指向已完成 outline 的 run | JSON 素材 |
| `content-draft` | 恢复 context → 步骤 7-9（正文生成） | `--run-id`，可选 `confirmed-outline-*` | JSON 草稿 |
| `content` | 恢复 context → 步骤 6-12（素材→正文→审查） | `--run-id` | 文章 .md |
| `review` | 恢复 context → 步骤 10-12（审查） | `--run-id` | JSON 审阅 |

#### Phase 1 — Outline 生成

```
node dist/index.js skill "<输入>" --phase outline
```

**执行**: `create.ts:generateOutlinePhase()`

| 子步骤 | 说明 |
|--------|------|
| topic-analysis | LLM 分析话题：子话题热度、痛点、争议、热门角度 |
| topic-assignment | LLM 为各平台分配切入角度，生成标题候选 |
| outline-{platform} | LLM 生成章节结构，各章节标注 `caseSlot`（所需案例描述） |
| 持久化 | 写入 run 目录 |
| 输出 JSON | 打印 `=== OUTLINE_SUMMARY_START/END ===` 包裹的 JSON |

**输出 JSON 结构**:
```json
{
  "runId": "create_xxx",
  "phase": "outline",
  "keyword": "...",
  "platforms": ["wechat"],
  "topicAnalysis": {
    "subTopics": [{ "name": "...", "description": "...", "heatLevel": "high" }],
    "painPoints": [{ "description": "..." }],
    "trendingAngles": [{ "angle": "..." }],
    "controversies": [{ "description": { "topic": "...", "sideA": "...", "sideB": "..." } }]
  },
  "platformCards": {
    "wechat": { "angle": "...", "titleDrafts": ["..."] }
  },
  "outlines": {
    "wechat": {
      "angle": "...",
      "titles": ["..."],
      "sections": [
        { "title": "...", "purpose": "...", "caseSlot": "需要的案例描述" }
      ]
    }
  }
}
```

**`caseSlot` 的双重用途**:
1. **人工阅读** — Claude Code 展示大纲时，说明每个章节需要什么类型的案例
2. **搜索 query 源** — material-search 阶段会从 `caseSlot` 提取搜索关键词（见 2.4 节）

#### Phase 1.5 — 用户确认（Claude Code）

```
Claude Code 展示大纲 JSON →
  ├─ 各平台角度
  ├─ 标题候选
  ├─ 章节结构
  └─ 各章节 caseSlot（案例需求）
AskUserQuestion 询问用户 →
用户选择:
  ├─ 全部通过，直接生成
  ├─ 修改标题（提供自定义标题）
  ├─ 修改/注入案例素材
  └─ 重新生成大纲
用户确认后 →
Claude Code 将确认内容写入 run 目录
```

**写入文件** (`output/{runId}/confirmed-outline-{platform}.json`):
```json
{
  "title": "用户确认的标题",
  "caseDirection": "用户指定的案例方向",
  "structureType": "递进式",
  "seedMaterial": "用户提供的种子素材"
}
```

#### Phase: material-gap — 素材搜索

```
node dist/index.js skill "<输入>" --phase material-gap --run-id <runId>
```

从 `caseSlot` 提取搜索关键词 → 调用 Web Search API → 搜索素材。
输出 `=== MATERIAL_GAP_START/END ===` 包裹的 JSON。

#### Phase: content-draft — 正文生成

```
node dist/index.js skill "<输入>" --phase content-draft --run-id <runId>
```

恢复 context → 读取 `confirmed-outline-*`（如果有）→ 生成各平台正文草稿。
输出 `=== CONTENT_DRAFT_START/END ===` 包裹的 JSON。

#### Phase: content — 完整续生成

```
node dist/index.js skill "<输入>" --phase content --run-id <runId>
```

**执行**: `create.ts:resumeFromOutline()` — 链式调用 `pipeline.resumeFrom()` 依次执行 material-search → content → review。

| 子步骤 | 说明 |
|--------|------|
| PipelineContext.restore() | 读取 run 目录下**所有** `.json` 文件（含非 step 的 key 如 `confirmed-outline-*`、`outline-seed-material-*`） |
| material-search | 根据 outline caseSlot 搜索素材 |
| content-{platform} | 正文生成（若有 `confirmed-outline-*` 则使用用户确认的标题/素材） |
| review-{platform} | 六维质量审查 |
| ObsidianWriter | 同步到 Obsidian `50_资源/生成文章/` |

**持久化文件** (`output/{runId}/`):
- `run-meta.json` — 步骤完成状态（含 `completedSteps[]`）
- `topic-analysis.json`
- `topic-assignment.json`
- `outline-{platform}.json`
- `material-search.json`
- `content-{platform}.json`
- `review-{platform}.json`
- `{标题}.{platform}.md` — 最终生成的文章
- `confirmed-outline-{platform}.json` — 用户确认内容（Claude Code 写入）
- `outline-seed-material-{platform}.json` — 用户注入的种子素材
- `run.log` — 运行日志

#### Phase full（单步全量执行）

```
node dist/index.js skill "<输入>"
```

一次执行全部 12 步，无确认环节。适用于 CLI 终端直接交互或自动化测试。

---

### 2.4 知识库语义搜索（Embedding-Based）

**文件**: `src/io/obsidian/reader.ts`

#### 两阶段搜索架构

```
第一步（快速）: keyword filter
    reader.search(keywords, { minQuality: 6 })
    → 候选集（关键词匹配 + 质量过滤）

第二步（语义重排）: semantic re-ranking
    reader.semanticSearch(keywords, queryText, options)
    → 使用 embedding 重新排序候选集
    → keyword score × (1-w) + semantic score × w
```

#### 配置

```yaml
obsidian:
  vaultPath: /path/to/vault
  embeddingSearch:
    enabled: true           # 开启语义搜索（默认关闭）
    semanticWeight: 0.5     # 语义权重（0=纯关键词，1=纯语义）
    topK: 8                 # 返回结果数量
```

#### 依赖

- Tavily Embeddings API（`TAVILY_API_KEY`）
- 或 Google text-embedding-004（`GOOGLE_EMBEDDING_API_KEY`）
- 结果自动缓存，避免重复 embedding 同一条卡片

#### 降级策略

| 场景 | 行为 |
|------|------|
| `embeddingSearch.enabled = false` | 使用 keyword-only search |
| Embedding API 失败 | 回退到 keyword-only search，warn 日志 |
| 无 embedding API key | 自动降级，不报错 |

#### 在 pipeline 中的位置

- `outline-generation.ts` — 大纲生成时加载素材（首次匹配）
- `content-generation.ts` — 正文生成时再加载（深化匹配）
- 两处共享同一配置 `config.obsidian.embeddingSearch`

---

### 2.5 素材搜索系统 (material-search)

**文件**: `src/scenarios/create/steps/material-search.ts`

#### 搜索流程

```
outline.sections[].caseSlot
    │
    ├─ extractSearchTerms() ← 清理 prompt 框架
    │   去除: （可虚构但需细节）、"需要一个"、"如/比如"等
    │   输出: 纯关键词（≤30 字符）
    │
    ├─ 拼接: keyword + 清理后的关键词 → 搜索 query
    │
    ├─ Web Search API (Tavily / Serper / Bing)
    │   每个平台最多 3 条 query，每 query 取 top 3 结果
    │
    └─ LLM 提取 (callWithFallback)
        从搜索结果中提取结构化素材: { type, content, source, reliability }
```

#### 关键函数

| 函数 | 说明 |
|------|------|
| `extractSearchTerms(text)` | 清洗 `caseSlot` 文本中的 prompt 框架，保留核心搜索词 |
| `extractQueriesFromOutlines()` | 从各平台 outline 的 `caseSlot` / `keyPoints` 提取搜索 query |
| `extractMaterials()` | LLM 从搜索结果的 snippet 中提取结构化素材 |

#### extractSearchTerms() 处理规则

```
输入: "需要一个中年白领失业后情绪崩溃的真实案例（可虚构但需细节）"
  → 去括号注释: "需要一个中年白领失业后情绪崩溃的真实案例"
  → 去"需要"/"一个": "中年白领失业后情绪崩溃的真实案例"
  → 去尾随"如/比如": (无匹配)
  → 去指令动词: (无匹配)
  → 截断 30 字符: "中年白领失业后情绪崩溃的真实案例"
输出: "中年白领失业后情绪崩溃的真实案例"
最终 query: "一人公司 中年白领失业后情绪崩溃的真实案例"
```

#### 搜索配置

`config/contentforge.yaml`:
```yaml
search:
  enabled: true          # 开关
  provider: tavily       # tavily | serper | bing
  # apiKey: xxx          # 也可用环境变量（见下方）
```

API Key 优先级: `config.search.apiKey` > `TAVILY_API_KEY` > `SERPER_API_KEY` > `BING_API_KEY`

当前使用的 key（`.env` 文件中配置）:
- `TAVILY_API_KEY` — Tavily Search API
- `SERPER_API_KEY` — Google Serper API

#### 搜索失败场景

| 场景 | 行为 |
|------|------|
| `search.enabled = false` | 跳过，返回空素材 |
| 无 API Key | 跳过，warn 日志 |
| 所有 search provider 失败 | 返回空素材，content-generation 的 LLM 自行生成案例 |
| 搜索结果为 0 | 同上 |

---

## 三、二创 (Recreate) 完整流程

### 3.1 入口

```
node dist/index.js skill "<输入>"  (包含 .md 文件路径)
```

### 3.2 触发条件

`parseIntent()` 检测到:
- 输入包含 `.md` 文件路径 (如 `d:/文章.md`)
- 或包含意图词: 二创、改写、爆款、rewrite

### 3.3 Pipeline

**文件**: `src/scenarios/recreate/index.ts`
**入口**: `src/cli/commands/recreate.ts`

| 步骤 | 说明 |
|------|------|
| 1. ViralDeconstruction | 拆解爆款基因：结构、情绪曲线、钩子、标题模式 |
| 2. Differentiation | 差异化角度识别（对比竞品库） |
| 3. NewOutline | 基于差异化生成新大纲 |
| 4. RecreationContent | 生成正文（原始文章全文 NOT passed） |
| 5. DualReview | 双稿对比审查（原文 vs 新稿） |
| 6. LocalRewrite | 本地化改写（方言/地域特征） |
| 7. PlatformAdaptation | 各平台适配（若指定多平台） |

**核心约束**: 原始文章全文仅传入 Steps 1-2，Steps 3-4 只接收 ViralGenome（结构+情绪曲线），不接收原文。

### 3.4 输出

```
output/{runId}/
├── 0-original.md              — 原始文章
├── 1-viral-genome.json        — 爆款基因
├── 2-differentiation.json     — 差异化分析
├── 3-new-outline.json         — 新大纲
├── 4-recreation-content.json  — 正文
├── 5-dual-review.json         — 双稿对比
├── 6-local-rewrite.md         — 本地化版本
├── 7-{platform}.md            — 各平台适配版本
├── {新标题}.md                — 最终输出（含评分报告头部）
├── run-meta.json
└── run.log
```

### 3.5 从素材库二创

```
node dist/index.js recreate --from-library <recordId>
```

预加载 Feishu Viral Library 中的 ViralGenome，跳过 Step 1。

---

## 四、关键文件索引

| 文件 | 功能 |
|------|------|
| `src/cli/commands/skill.ts` | 统一入口，自然语言路由 |
| `src/cli/commands/create.ts` | 原创生成（多阶段协议） |
| `src/cli/commands/recreate.ts` | 爆款二创 |
| `src/scenarios/create/index.ts` | Create Pipeline 构建 |
| `src/scenarios/recreate/index.ts` | Recreate Pipeline 构建 |
| `src/core/context.ts` | PipelineContext: 持久化 / restore() |
| `src/core/pipeline.ts` | Pipeline 执行引擎（run / resumeFrom） |
| `src/core/step.ts` | PipelineStep 基类 |
| `src/core/runner.ts` | 步骤运行器 |
| `src/cli/ui/interactive.ts` | TTY 检测工具函数 |
| `src/cli/ui/outline-review.ts` | 大纲确认 TUI |
| `src/cli/ui/topic-review.ts` | 选题分析 TUI（子话题选择/争议展示） |
| `src/cli/ui/progress.ts` | 进度显示 |
| `src/cli/ui/spinner.ts` | Spinner |
| `src/scenarios/learning/creative-preferences.ts` | 创作偏好系统 |
| `src/scenarios/create/steps/material-search.ts` | 素材搜索 + query 清洗 |
| `src/scenarios/create/types.ts` | Create 类型定义 |
| `src/scenarios/recreate/types.ts` | Recreate 类型定义 |
| `src/config/contentforge.yaml` | 配置文件 |
| `src/scenarios/topic-engine/types.ts` | 选题引擎类型定义 |
| `src/scenarios/topic-engine/topic-pool.ts` | 选题池 JSON 文件 CRUD |
| `src/scenarios/topic-engine/rss-fetcher.ts` | RSS/Atom 抓取与解析 |
| `src/scenarios/learning/preference-override.ts` | 偏好临时覆盖存储 |
| `src/cli/commands/topic-engine.ts` | 选题引擎 CLI 命令 |
| `src/cli/ui/topic-engine-tui.ts` | 选题浏览 TUI |
| `src/cli/ui/preference-dashboard.ts` | 创作偏好交互面板 TUI |

---

## 五、数据流与 LLM 调用

### 原创 LLM 调用链

```
Phase 1 (outline):
  topic-analysis     → 1 次 LLM (分析话题, 输出 JSON)
  topic-assignment   → 1 次 LLM (分配平台角度)
  outline-{platform} → 1 次 LLM × N 平台 (生成章节结构)

Phase 2 (content):
  material-search    → 0-1 次 LLM × N 平台 (从搜索结果提取素材)
  content-{platform} → 1 次 LLM × N 平台 (正文生成)
  review-{platform}  → 1 次 LLM × N 平台 (质量审查)
```

总调用: 3 + 2N 次，其中 material-search 的 LLM 调用按需发生（搜索结果为空则跳过）。
N = 平台数（默认为 3，全量调用 9 次）

### 二创 LLM 调用链

```
  1. ViralDeconstruction   → 1 次 LLM
  2. Differentiation        → 1 次 LLM
  3. NewOutline             → 1 次 LLM
  4. RecreationContent      → 1 次 LLM
  5. DualReview             → 1 次 LLM
  6. LocalRewrite           → 1 次 LLM
  7. PlatformAdaptation     → 1 次 LLM × N 平台
```

总调用: 6 + N 次 (N=平台数)

---

## 六、创作偏好系统

**文件**: `src/scenarios/learning/creative-preferences.ts`

### 6.1 默认偏好

| 维度 | 公众号 | 小红书 | 抖音 |
|------|--------|--------|------|
| 结构 | 递进式 (high/20) | 故事型 (medium/15) | 清单型 (medium/12) |
| 调性 | 犀利 (high/20) | 温暖 (medium/15) | 犀利 (medium/12) |
| 角度 | 认知升级与心理重建 (high/20) | 实操干货+真实体验 (medium/15) | 反常识+实用技巧 (medium/12) |
| 标题模式 | 反直觉断言+具体结果 / 问句+数字 | 身份标签+结果+数字 | 3秒钩子+悬念 |
| 钩子模式 | 冲突场景+情绪共鸣 / 数据冲击+反常识 | 第一人称亲历感 | 反直觉断言+数据 |

### 6.2 置信度规则

| sampleSize | 置信度 |
|-----------|--------|
| ≥ 20 | high |
| ≥ 5 | medium |
| < 5 | low |

`buildPreferencePrompt()` 在 structure 和 tone 均为 low 时返回空字符串（不注入 prompt）。
当前默认值全部为 high/medium，表示偏好系统始终生效。

### 6.3 更新机制

目前为**手动更新**:
- `learn --feedback` → 记录单条反馈到 Feishu
- `learn --update-preferences` → 聚合 Feishu 反馈数据，重算各维度偏好

**设计目标（尚未实现）**: 自动反馈闭环
- 发布后追踪互动率 → 自动回写偏好系统
- 偏好随数据积累自动进化，无需手动触发

---

## 七、输出文件命名规则

| 场景 | 格式 |
|------|------|
| 原创-公众号 | `{标题}.wechat.md` |
| 原创-小红书 | `{标题}.xhs.md` |
| 原创-抖音 | `{标题}.douyin.md` |
| 二创-正文 | `{新标题}.md`（含评分报告头部） |
| 二创-本地化 | `{标题}.local.md` |
| 二创-平台适配 | `{标题}.{platform}.md` |
| Obsidian 同步 | `50_资源/生成文章/{标题}.md` |

---

## 八、质量审查维度

`review-{platform}` 的六维审查:

| 维度 | 说明 |
|------|------|
| 选题价值 | 话题热度、差异化程度 |
| 结构逻辑 | 递进/并列/故事线是否清晰 |
| 论据质量 | 案例/数据是否充分、可信 |
| 表达张力 | 语言是否有感染力、金句密度 |
| 平台适配 | 是否符合平台调性和读者预期 |
| 行动激励 | 是否有明确的行动指引 |

---

## 九、配置说明

**文件**: `config/contentforge.yaml`

| 字段 | 说明 |
|------|------|
| `providers` | LLM 提供商列表（openai/kimi/anthropic） |
| `defaultProvider` | 默认 LLM |
| `scenarios.create.steps` | 原创各步骤的 temperature / maxTokens |
| `scenarios.recreate.steps` | 二创各步骤的 temperature / maxTokens |
| `concurrency.maxParallel` | 最大并行数（当前 3） |
| `output.dir` | 输出目录（默认 `./output`） |
| `search.enabled` | 素材搜索开关 |
| `search.provider` | 搜索提供商（tavilly/serper/bing） |
| `costControl` | 成本控制配置 |
| `.env` 文件 | API Key 存放位置（TAVILY_API_KEY / SERPER_API_KEY / BING_API_KEY / 各 LLM API Key） |

---

## 十、创作偏好注入 Prompt 格式

`buildPreferencePrompt()` 生成的内容注入到 LLM 的 system prompt 末尾:

```

【创作偏好参考】
叙事结构偏好（样本20条，置信度high）：推荐使用「递进式」结构
情感调性偏好（样本20条，置信度high）：推荐使用「犀利」调性
内容角度偏好（样本20条，置信度high）：推荐从「认知升级与心理重建」角度切入
有效标题模式（样本38条）：「反直觉断言+具体结果」、「问句+数字」
有效钩子模式（样本36条）：「冲突场景+情绪共鸣」、「数据冲击+反常识」
竞品高表现洞察：叙事结构「冲突式」平均互动率 6.8%（样本15条）
（仅供参考，不强制约束）
```

---

## 十二、选题引擎

**文件**: `src/scenarios/topic-engine/` + `src/cli/commands/topic-engine.ts`

从 RSS 热点发现到选题管理的完整流程：

```
topic-engine fetch    → 抓取 RSSHub 热点 → 去重入池 (output/corpus/topic-pool.json)
topic-engine list     → 浏览选题 (TTY: 交互式 / 非TTY: 编号列表)
topic-engine show <id> → 查看选题详情
topic-engine select <id> [--generate] → 选中选题，可选直接生成文章
topic-engine dismiss <id> → 弃用
```

### 数据流

```
RSSHub (36kr/虎嗅/极客公园/ifanr) → rss-fetcher.ts (regex RSS/Atom解析) → TopicItem[]
    → topic-pool.ts (URL去重 + 标题相似度去重) → output/corpus/topic-pool.json
    → topic-engine select --generate → runCreate(topic.title) → 正常生成管线
```

### 默认 RSS 源

| 源 | URL |
|----|-----|
| 36kr | `https://rsshub.app/36kr/news` |
| 虎嗅 | `https://rsshub.app/huxiu/article` |
| 极客公园 | `https://rsshub.app/geekpark/breakingnews` |
| ifanr | `https://rsshub.app/ifanr/news` |

如使用的网络环境无法访问 RSSHub，可通过 HTTP 代理或改用其他 RSS 源。

---

## 十三、偏好可视化

**文件**: `src/cli/ui/preference-dashboard.ts` + `src/scenarios/learning/preference-override.ts`

### 交互面板

```
learn --dashboard
  ├─ TTY: 三栏 TUI (←→切换平台, ↑↓选维度, Enter编辑覆盖, p预览prompt, r重置, q退出)
  └─ 非 TTY: 增强版文本报告 (含 Prompt 注入预览)
```

### 临时覆盖

覆盖存储在 `output/corpus/preference-overrides.json`，不写飞书。

- 支持维度: structure(叙事结构)、tone(情感调性)、angle(内容角度)
- `applyOverrides()` 在生成前将覆盖值注入偏好副本
- 使用 `r` 键可一键重置当前平台的所有覆盖

### 输出示例

非 TTY 模式下输出的 Prompt 注入预览:

```
【创作偏好参考】
叙事结构偏好（样本20条，置信度high）：推荐使用「递进式」结构
情感调性偏好（样本20条，置信度high）：推荐使用「犀利」调性
有效标题模式（样本38条）：「反直觉断言+具体结果」、「问句+数字」
（仅供参考，不强制约束）
```

---

## 十四、快速验证命令

```bash
# 原创-完整流程
node dist/index.js skill "帮我写一篇关于AI的文章 发公众号"

# 原创-仅大纲
node dist/index.js skill "帮我写一篇关于AI的文章 发公众号" --phase outline

# 原创-素材搜索
node dist/index.js skill "帮我写一篇关于AI的文章 发公众号" --phase material-gap --run-id create_xxx

# 原创-正文生成
node dist/index.js skill "帮我写一篇关于AI的文章 发公众号" --phase content-draft --run-id create_xxx

# 原创-续生成（素材→正文→审查）
node dist/index.js skill "帮我写一篇关于AI的文章 发公众号" --phase content --run-id create_xxx

# 二创
node dist/index.js skill "帮我二创这篇文章：d:/文章.md"

# 二创-指定平台
node dist/index.js skill "帮我二创这篇文章发小红书：d:/文章.md"

# 从素材库二创
node dist/index.js recreate --from-library <recordId>

# 选题引擎-抓取热点
node dist/index.js topic-engine fetch

# 选题引擎-浏览选题池
node dist/index.js topic-engine list

# 选题引擎-选中并生成
node dist/index.js topic-engine select <id> --generate

# 偏好可视化面板
node dist/index.js learn --dashboard

# 语义搜索（需配置 embedding API key）
# 在 config/contentforge.yaml 中启用:
# obsidian:
#   embeddingSearch:
#     enabled: true
```

---

## 十二、常见问题

### Q: material-search 返回空素材怎么办？
A: 检查以下顺序:
1. `.env` 中是否有 `TAVILY_API_KEY` 或 `SERPER_API_KEY`
2. `config/contentforge.yaml` 中 `search.enabled` 是否为 `true`
3. outline 的 `caseSlot` 是否包含冗余 prompt 框架（新版本已有 `extractSearchTerms()` 自动清洗）
4. 网络是否能访问搜索 API

若以上均正常但返回空，则说明搜索引擎未找到相关结果。content-generation 步骤的 LLM 会自动生成合理案例，不影响最终产出。

### Q: 持久化文件丢失某些 key？
A: `PipelineContext.restore()` 自 v1.1.0 起读取 run 目录下**所有** `.json` 文件（跳过 `run-meta.json` 和 `run.log`），不再局限于 `completedSteps` 中的 key。如果仍然丢失，检查文件是否以 `.json` 结尾且非空。

### Q: Phase 2 没有使用我确认的内容？
A: 确认内容需写入 `output/{runId}/confirmed-outline-{platform}.json`。
`content-{platform}` 步骤执行时会从 context 中读取该 key，
若无匹配则使用 outline 原始数据。

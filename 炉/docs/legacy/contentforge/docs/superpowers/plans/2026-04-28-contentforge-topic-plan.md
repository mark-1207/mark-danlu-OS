# ContentForge Topic — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现竞品内容抓取 + AI 结构分析 + 写入飞书表格的完整链路

**Architecture:** 核心链路：CLI 命令 → 抓取（autocli/opencli）→ AI 分析（Kimi）→ 写入飞书表格（lark-cli）。Phase 1 只打通核心链路，碎片提取在 Phase 2。

**Tech Stack:** autocli/opencli（抓取）, lark-cli（飞书）, Kimi API（AI 分析）, commander（CLI）

---

## Chunk 1: 项目脚手架与类型定义

**Files:**
- Create: `src/scenarios/topic/types.ts`
- Create: `src/scenarios/topic/index.ts`
- Create: `src/cli/commands/topic.ts`

### Task 1: 创建 topic types

**Files:**
- Create: `src/scenarios/topic/types.ts`

- [ ] **Step 1: 写入类型定义**

```typescript
// src/scenarios/topic/types.ts

export type Platform = 'wechat' | 'zhihu' | 'bilibili' | 'xiaohongshu' | 'twitter' | 'youtube' | 'xiaoyuzhou' | 'reddit' | 'medium';

export type SourceType = 'crawled' | 'manual' | 'external';

export type AnalysisStatus = 'pending' | 'analyzed' | 'stored';

export interface CompetitorArticle {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  interactionData?: string; // 点赞/收藏/阅读
  summary?: string;          // AI 提取的核心观点
  viralStructure?: string;   // AI 提取的叙事结构
  topicAngle?: string;       // AI 提取的切入角度
  tags: string[];
  source: SourceType;
  isFavorite: boolean;
  status: AnalysisStatus;
  crawledAt: string;
  storedAt?: string;         // 碎片入库时间
}

export interface TopicAnalysisResult {
  summary: string;
  viralStructure: string;
  topicAngle: string;
  tags: string[];
}

// 飞书表格字段映射
export interface FeishuRecord {
  record_id: string;
  fields: {
    原文标题: string;
    原始链接: string;
    平台: Platform;
    互动数据?: string;
    内容摘要?: string;
    爆款结构?: string;
    选题角度?: string;
    标签?: string[];
    来源类型: '我的创作' | '竞品抓取' | '手动录入';
    收藏: '是' | '';
    状态: '待分析' | '已分析' | '已入库';
    抓取时间: string;
    碎片提取时间?: string;
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/scenarios/topic/types.ts
git commit -m "feat(topic): add topic types"
```

---

### Task 2: 创建 topic index 导出

**Files:**
- Create: `src/scenarios/topic/index.ts`

- [ ] **Step 1: 写入 index**

```typescript
// src/scenarios/topic/index.ts
export * from './types.js';
```

- [ ] **Step 2: 提交**

```bash
git add src/scenarios/topic/index.ts
git commit -m "feat(topic): add topic index"
```

---

## Chunk 2: 飞书表格同步工具

**Files:**
- Create: `src/scenarios/topic/feishu-sync.ts`

### Task 3: 飞书表格读写工具

**Files:**
- Create: `src/scenarios/topic/feishu-sync.ts`

- [ ] **Step 1: 写入 feishu-sync**

```typescript
// src/scenarios/topic/feishu-sync.ts
import { execSync } from 'child_process';
import chalk from 'chalk';
import type { CompetitorArticle, FeishuRecord } from './types.js';

// 飞书表格 App Token（需配置）
const FEISHU_TABLE_APP_TOKEN = process.env.FEISHU_TOPIC_TABLE_APP_TOKEN ?? '';
const FEISHU_TABLE_ID = process.env.FEISHU_TOPIC_TABLE_ID ?? '';

function execLarkCli(args: string[]): string {
  try {
    return execSync(`npx lark-cli ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`lark-cli 执行失败: ${msg}`);
  }
}

/**
 * 读取飞书表格所有记录
 */
export async function readFeishuRecords(): Promise<FeishuRecord[]> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const output = execLarkCli([
    'table', 'read',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--page-size', '500',
  ]);

  try {
    return JSON.parse(output) as FeishuRecord[];
  } catch {
    throw new Error(`解析飞书记录失败: ${output}`);
  }
}

/**
 * 写入单条记录到飞书表格
 */
export async function writeFeishuRecord(article: CompetitorArticle): Promise<string> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const fields = {
    '原文标题': article.title,
    '原始链接': article.url,
    '平台': article.platform,
    '互动数据': article.interactionData ?? '',
    '内容摘要': article.summary ?? '',
    '爆款结构': article.viralStructure ?? '',
    '选题角度': article.topicAngle ?? '',
    '标签': article.tags,
    '来源类型': article.source === 'crawled' ? '竞品抓取' : article.source === 'manual' ? '手动录入' : '我的创作',
    '收藏': article.isFavorite ? '是' : '',
    '状态': '待分析',
    '抓取时间': article.crawledAt,
  };

  const output = execLarkCli([
    'table', 'create',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--fields', JSON.stringify(fields),
  ]);

  const result = JSON.parse(output);
  return result.record_id as string;
}

/**
 * 更新飞书表格记录状态
 */
export async function updateFeishuRecordStatus(
  recordId: string,
  status: '待分析' | '已分析' | '已入库',
  extraFields?: Partial<FeishuRecord['fields']>
): Promise<void> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const fields: Record<string, unknown> = { '状态': status };
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      fields[key] = value;
    }
  }

  execLarkCli([
    'table', 'update',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--record-id', recordId,
    '--fields', JSON.stringify(fields),
  ]);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/scenarios/topic/feishu-sync.ts
git commit -m "feat(topic): add Feishu sync utility"
```

---

## Chunk 3: 抓取器实现

**Files:**
- Create: `src/scenarios/topic/scraper.ts`

### Task 4: 抓取器 scraper

**Files:**
- Create: `src/scenarios/topic/scraper.ts`

- [ ] **Step 1: 写入 scraper**

```typescript
// src/scenarios/topic/scraper.ts
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import type { CompetitorArticle, Platform } from './types.js';

interface ScrapeResult {
  title: string;
  content: string;
  platform: Platform;
  url: string;
}

function execAutocli(args: string[]): string {
  try {
    return execSync(`npx autocli ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`autocli 执行失败: ${msg}`);
  }
}

/**
 * 抓取单篇文章
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  console.log(chalk.cyan(`正在抓取: ${url}`));

  const output = execAutocli(['scrape', '--url', url, '--format', 'json']);

  let parsed: { title: string; content: string; platform: Platform };
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`autocli 解析失败，原始输出: ${output.slice(0, 200)}`);
  }

  if (!parsed.title || !parsed.content) {
    throw new Error(`抓取结果缺少 title 或 content: ${output.slice(0, 200)}`);
  }

  return parsed;
}

/**
 * 构建 CompetitorArticle 对象
 */
export function buildCompetitorArticle(
  result: ScrapeResult,
  source: 'crawled' | 'manual' = 'crawled'
): CompetitorArticle {
  return {
    id: randomUUID(),
    title: result.title,
    url: result.url,
    platform: result.platform,
    tags: [],
    source,
    isFavorite: false,
    status: 'pending',
    crawledAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/scenarios/topic/scraper.ts
git commit -m "feat(topic): add scraper module"
```

---

## Chunk 4: AI 分析器

**Files:**
- Create: `src/scenarios/topic/analyzer.ts`

### Task 5: AI 结构分析器

**Files:**
- Create: `src/scenarios/topic/analyzer.ts`

- [ ] **Step 1: 写入 analyzer**

```typescript
// src/scenarios/topic/analyzer.ts
import { readFileSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { CompetitorArticle, TopicAnalysisResult } from './types.js';

const KIMI_API_KEY = process.env.KIMI_API_KEY ?? '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? 'https://yunwu.ai/v1';

async function callKimi(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!KIMI_API_KEY) throw new Error('KIMI_API_KEY 未设置');

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API 失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

const ANALYSIS_PROMPT = `你是一个资深内容分析师，擅长拆解爆款文章的结构和元素。
给定一篇文章，请提取以下信息并以 JSON 格式输出：

{
  "summary": "核心观点/主题概括（50字内）",
  "viralStructure": "爆款叙事结构描述（如：痛点引入→案例→方法论→号召行动）",
  "topicAngle": "切入角度（如：从职场人效率痛点切入）",
  "tags": ["标签1", "标签2", "标签3"]
}

要求：
- summary 精确概括文章解决的核心问题
- viralStructure 描述叙事节奏和段落逻辑
- topicAngle 指出差异化视角
- tags 提取3-5个主题标签`;

export async function analyzeArticle(article: CompetitorArticle, content: string): Promise<TopicAnalysisResult> {
  console.log(chalk.cyan(`AI 分析中: ${article.title}`));

  const userPrompt = `# 文章标题\n${article.title}\n\n# 文章平台\n${article.platform}\n\n# 文章内容\n${content.slice(0, 8000)}`;

  const rawOutput = await callKimi(ANALYSIS_PROMPT, userPrompt);

  // 提取 JSON
  const jsonMatch = rawOutput.match(/\{[\s\S]*?"summary"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`AI 输出无法解析为 JSON: ${rawOutput.slice(0, 200)}`);
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as TopicAnalysisResult;
    return result;
  } catch {
    throw new Error(`JSON 解析失败: ${jsonMatch[0].slice(0, 200)}`);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/scenarios/topic/analyzer.ts
git commit -m "feat(topic): add AI analyzer module"
```

---

## Chunk 5: CLI 命令

**Files:**
- Create: `src/cli/commands/topic.ts`
- Modify: `src/cli/index.ts`（注册命令）

### Task 6: topic CLI 命令

**Files:**
- Create: `src/cli/commands/topic.ts`

- [ ] **Step 1: 写入 topic.ts CLI**

```typescript
// src/cli/commands/topic.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { scrapeArticle, buildCompetitorArticle } from '../../scenarios/topic/scraper.js';
import { analyzeArticle } from '../../scenarios/topic/analyzer.js';
import { writeFeishuRecord, updateFeishuRecordStatus } from '../../scenarios/topic/feishu-sync.js';

export function registerTopicCommand(program: Command): void {
  const topic = program
    .command('topic')
    .description('竞品分析与选题工具');

  // 抓取单篇文章
  topic
    .command('scrape')
    .description('抓取单篇文章并分析')
    .requiredOption('-u, --url <url>', '文章 URL')
    .action(async (opts) => {
      try {
        // 1. 抓取
        const scrapeResult = await scrapeArticle(opts.url);
        const article = buildCompetitorArticle(scrapeResult);
        console.log(chalk.green(`抓取成功: ${article.title}`));

        // 2. AI 分析
        const analysis = await analyzeArticle(article, scrapeResult.content);

        // 3. 更新 article
        article.summary = analysis.summary;
        article.viralStructure = analysis.viralStructure;
        article.topicAngle = analysis.topicAngle;
        article.tags = analysis.tags;

        // 4. 写入飞书
        const recordId = await writeFeishuRecord(article);
        console.log(chalk.green(`已写入飞书表格，记录ID: ${recordId}`));

        // 5. 询问是否提取碎片
        const { extractFragments } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'extractFragments',
            message: '是否提取碎片入库？',
            default: false,
          },
        ]);

        if (extractFragments) {
          // Phase 2 实现
          console.log(chalk.yellow('碎片提取功能 Phase 2 实现'));
        }

        console.log(chalk.bold('\n✅ 抓取分析完成\n'));
      } catch (error) {
        console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : error}\n`));
        process.exit(1);
      }
    });

  // 列表命令（查看待分析）
  topic
    .command('list')
    .description('查看飞书表格中的竞品列表')
    .option('--status <status>', '按状态筛选 (pending|analyzed|stored)')
    .action(async (opts) => {
      try {
        const { readFeishuRecords } = await import('../../scenarios/topic/feishu-sync.js');
        const records = await readFeishuRecords();

        let filtered = records;
        if (opts.status) {
          filtered = records.filter(r => r.fields.状态 === opts.status);
        }

        console.log(chalk.bold(`\n竞品列表（共 ${filtered.length} 条）\n`));
        filtered.forEach((r, i) => {
          const f = r.fields;
          console.log(`${i + 1}. ${chalk.cyan(f['原文标题'])} [${f['平台']}] ${f['状态']}`);
          console.log(`   ${f['原始链接']}`);
        });
      } catch (error) {
        console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : error}\n`));
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: 修改 src/cli/index.ts 注册命令**

```bash
# 查看当前 index.ts 中的命令注册方式
```

需要先查看 index.ts 的注册模式，然后添加 topic 命令注册。

- [ ] **Step 3: 提交**

```bash
git add src/cli/commands/topic.ts src/cli/index.ts
git commit -m "feat(topic): add topic CLI command"
```

---

## Chunk 6: 环境变量配置

**Files:**
- Modify: `.env`（添加飞书相关配置）

### Task 7: 添加飞书环境变量

**Files:**
- Modify: `.env`

- [ ] **Step 1: 添加飞书配置到 .env**

```env
# 飞书竞品素材库表格
FEISHU_TOPIC_TABLE_APP_TOKEN=
FEISHU_TOPIC_TABLE_ID=
```

- [ ] **Step 2: 提交**

```bash
git add .env
git commit -m "chore(topic): add Feishu table env vars"
```

---

## 验收标准

1. `npm run build` 编译通过
2. `node dist/index.js topic --help` 显示 topic 命令帮助
3. `node dist/index.js topic scrape --url <url>` 能抓取并分析文章
4. `.env` 包含 `FEISHU_TOPIC_TABLE_APP_TOKEN` 和 `FEISHU_TOPIC_TABLE_ID`

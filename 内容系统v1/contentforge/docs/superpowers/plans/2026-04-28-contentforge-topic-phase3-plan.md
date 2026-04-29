# ContentForge Topic Phase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `create --keyword` 的 Step1 中注入竞品数据，AI 同一次调用输出主题分析 + 竞品洞察，用户在 TUI 确认前看到"哪些角度被竞品覆盖、哪些是空白机会"。

**Architecture:** 竞品读取 + 缓存逻辑封装为独立模块，`TopicAnalysisStep` 执行时先查缓存再追加竞品素材到 user prompt，AI 在同一次 LLM 调用中输出扩展的 TopicAnalysis（含 `competitorInsights` 字段）。TUI 展示追加在 Step1 输出末尾。

**Tech Stack:** TypeScript + Node.js + zod + prompt renderer

---

## File Map

```
src/scenarios/create/
├── types.ts                              # TopicAnalysisSchema 扩展
└── steps/topic-analysis.ts               # 追加竞品素材到 user prompt

src/scenarios/topic/
└── competitor-cache.ts                  # 新增：竞品缓存读写 + 过期判断

src/prompts/templates/create/
└── topic-analysis.user.md               # 末尾追加竞品素材模板变量

src/cli/commands/create.ts              # buildTopicAnalysisReview 调用处需处理 competitorInsights

output/corpus/competitor-insights/      # 缓存目录（手动创建）
└── {md5(keyword)}.json
```

---

## Task 1: 扩展 TopicAnalysisSchema，新增 competitorInsights 类型

**Files:**
- Modify: `src/scenarios/create/types.ts`

**Steps:**

- [ ] **Step 1: 在 TopicAnalysisSchema 前追加 CompetitorInsightSchema**

在 `types.ts` 中 TopicAnalysisSchema 定义之前添加：

```typescript
export const CompetitorInsightSchema = z.object({
  coveredAngles: z.array(z.object({
    angle: z.string(),
    sourceTitle: z.string(),
    platform: z.string(),
  })),
  opportunityAngles: z.array(z.object({
    angle: z.string(),
    whyOpportunity: z.string(),
  })),
  warning: z.string(),
});

export type CompetitorInsight = z.infer<typeof CompetitorInsightSchema>;
```

- [ ] **Step 2: 在 TopicAnalysisSchema 中新增 competitorInsights 字段**

在现有 `TopicAnalysisSchema` 定义的 `targetDemographics` 字段后追加：

```typescript
export const TopicAnalysisSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicSchema).min(10).max(15),
  painPoints: z.array(PainPointSchema).min(5).max(8),
  trendingAngles: z.array(TrendingAngleSchema).min(5).max(8),
  controversies: z.array(ControversySchema).min(3).max(5),
  targetDemographics: z.array(TargetDemographicSchema).min(3).max(5),
  competitorInsights: CompetitorInsightSchema.optional(),  // 新增
});
```

- [ ] **Step 3: 验证类型正确**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npx tsc --noEmit src/scenarios/create/types.ts`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add src/scenarios/create/types.ts
git commit -m "feat(topic): add CompetitorInsightSchema and extend TopicAnalysisSchema"
```

---

## Task 2: 创建 competitor-cache.ts — 竞品缓存读写与过期判断

**Files:**
- Create: `src/scenarios/topic/competitor-cache.ts`
- Test: `src/scenarios/topic/competitor-cache.test.ts`

**Steps:**

- [ ] **Step 1: 创建缓存目录**

Run: `mkdir -p "D:/myproject/内容系统v1/contentforge/output/corpus/competitor-insights"`
Expected: 目录创建成功（已存在则忽略）

- [ ] **Step 2: 编写 competitor-cache.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { readFeishuRecords } from './feishu-sync.js';
import type { CompetitorInsight, FeishuRecord } from './types.js';

const CACHE_DIR = path.join(process.cwd(), 'output', 'corpus', 'competitor-insights');

export interface CompetitorCacheEntry {
  keyword: string;
  cachedAt: string;
  insights: CompetitorInsight;
  recordCount: number;
}

/**
 * 缓存 key：keyword 的 MD5
 */
export function cacheKey(keyword: string): string {
  return crypto.createHash('md5').update(keyword).digest('hex');
}

/**
 * 读取缓存文件（如果存在）
 */
export async function readCache(keyword: string): Promise<CompetitorCacheEntry | null> {
  const filePath = path.join(CACHE_DIR, `${cacheKey(keyword)}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as CompetitorCacheEntry;
  } catch {
    return null;
  }
}

/**
 * 写入缓存文件
 */
export async function writeCache(keyword: string, insights: CompetitorInsight, recordCount: number): Promise<void> {
  const entry: CompetitorCacheEntry = {
    keyword,
    cachedAt: new Date().toISOString(),
    insights,
    recordCount,
  };
  const filePath = path.join(CACHE_DIR, `${cacheKey(keyword)}.json`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * 读取飞书竞品数据，过滤 analyzed/stored 状态，优先收藏，取最新10条
 */
export async function fetchCompetitiveRecords(): Promise<FeishuRecord[]> {
  const all = await readFeishuRecords();
  return all
    .filter((r) => r.fields.状态 === 'analyzed' || r.fields.状态 === 'stored')
    .sort((a, b) => {
      if (a.fields.收藏 !== b.fields.收藏) return a.fields.收藏 ? -1 : 1;
      return new Date(b.fields.抓取时间).getTime() - new Date(a.fields.抓取时间).getTime();
    })
    .slice(0, 10);
}

/**
 * 判断缓存是否过期：飞书最新抓取时间 > cachedAt
 */
export async function isCacheExpired(keyword: string, cachedAt: string): Promise<boolean> {
  const all = await readFeishuRecords();
  if (all.length === 0) return false;
  const latestCrawl = all
    .map((r) => new Date(r.fields.抓取时间).getTime())
    .reduce((max, t) => Math.max(max, t), 0);
  return latestCrawl > new Date(cachedAt).getTime();
}

/**
 * 格式化飞书记录为 AI 聚合素材
 */
export function formatRecordsForPrompt(records: FeishuRecord[]): string {
  if (records.length === 0) return '';
  return records
    .map((r) => {
      const f = r.fields;
      const parts: string[] = [];
      if (f.原文标题) parts.push(`标题：${f.原文标题}`);
      if (f.选题角度) parts.push(`角度：${f.选题角度}`);
      if (f.爆款结构) parts.push(`结构：${f.爆款结构}`);
      parts.push(`平台：${f.平台}`);
      if (f.收藏) parts.push('【已收藏】');
      return parts.join(' | ');
    })
    .join('\n');
}
```

- [ ] **Step 3: 编写单元测试**

```typescript
// src/scenarios/topic/competitor-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheKey } from './competitor-cache.js';

describe('competitor-cache', () => {
  it('cacheKey returns consistent MD5 for same keyword', () => {
    expect(cacheKey('AI')).toBe(cacheKey('AI'));
    expect(cacheKey('AI')).not.toBe(cacheKey('成长'));
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npx vitest run src/scenarios/topic/competitor-cache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/topic/competitor-cache.ts src/scenarios/topic/competitor-cache.test.ts
git commit -m "feat(topic): add competitor cache module with read/write/expire logic"
```

---

## Task 3: 扩展 topic-analysis.user.md Prompt 模板

**Files:**
- Modify: `src/prompts/templates/create/topic-analysis.user.md`

**Steps:**

- [ ] **Step 1: 追加竞品素材模板变量**

在 `topic-analysis.user.md` 文件末尾（在 JSON Schema 段落之后）追加：

```markdown
{{#if competitorInsights}}
---
## 竞品参考素材

以下是系统中已有的竞品分析数据，供你参考差异化方向：

**竞品已覆盖角度**：
{{#each competitorInsights.coveredAngles}}
- [{{platform}}] {{angle}}（来源：{{sourceTitle}}）
{{/each}}

{{#if competitorInsights.opportunityAngles}}
**空白机会角度**：
{{#each competitorInsights.opportunityAngles}}
- {{angle}}：{{whyOpportunity}}
{{/each}}
{{/if}}

**差异化建议**：{{competitorInsights.warning}}
{{/if}}
```

- [ ] **Step 2: 验证模板语法正确**

Run: `cd "D:/myproject/内容系统v1/contentforge" && node -e "import('./src/prompts/renderer.js').then(m => { const r = m.renderPrompt('{{#if x}}hello{{/if}}', {x:'yes'}); console.log(r === 'hello' ? 'OK' : 'FAIL'); })"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add src/prompts/templates/create/topic-analysis.user.md
git commit -m "feat(topic): extend topic-analysis.user.md with competitor insights template"
```

---

## Task 4: 扩展 TopicAnalysisStep — 读缓存 + 追加竞品素材到 Prompt

**Files:**
- Modify: `src/scenarios/create/steps/topic-analysis.ts`

**Steps:**

- [ ] **Step 1: 扩展 doExecute 方法，追加竞品素材读取逻辑**

将 `src/scenarios/create/steps/topic-analysis.ts` 的 `doExecute` 方法改为：

```typescript
protected async doExecute(
  input: z.infer<typeof InputSchema>,
  context: PipelineContext,
): Promise<TopicAnalysis> {
  const template = await promptLoader.load('create', 'topic-analysis');

  // 尝试读取竞品洞察（缓存优先，数据驱动过期）
  let competitorInsights: import('../types.js').CompetitorInsight | undefined;
  try {
    const { readCache, isCacheExpired, fetchCompetitiveRecords, formatRecordsForPrompt } = await import('../../topic/competitor-cache.js');
    const cached = await readCache(input.keyword);
    if (cached) {
      const expired = await isCacheExpired(input.keyword, cached.cachedAt);
      if (!expired) {
        competitorInsights = cached.insights;
      }
    }
    if (!competitorInsights) {
      const records = await fetchCompetitiveRecords();
      if (records.length > 0) {
        const formatted = formatRecordsForPrompt(records);
        // 通过 LLM 聚合（与主题分析同一次调用，但 prompt 分别发送）
        const aggregationPrompt = `你是一位资深内容策划专家。请根据以下竞品数据，提取：
1. 已覆盖角度（每个角度附上来源标题和平台）
2. 空白机会角度（为什么这个机会存在）
3. 差异化整体建议（一句话）

竞品数据：
${formatted}

输出格式（严格JSON）：
{
  "coveredAngles": [{"angle": "string", "sourceTitle": "string", "platform": "string"}],
  "opportunityAngles": [{"angle": "string", "whyOpportunity": "string"}],
  "warning": "string"
}`;

        const result = await this.callLLMJson<import('../types.js').CompetitorInsight>([
          { role: 'user', content: aggregationPrompt },
        ]);
        competitorInsights = result;

        // 写入缓存（静默失败不阻断）
        const { writeCache } = await import('../../topic/competitor-cache.js');
        writeCache(input.keyword, result, records.length).catch(() => {});
      }
    }
  } catch (err) {
    // 竞品读取失败：警告提示，跳过，流程继续
    console.warn('⚠️ 竞品洞察生成失败，跳过注入。流程继续。');
  }

  const systemPrompt = promptLoader.render(template.system, {
    keyword: input.keyword,
  });

  const userPrompt = promptLoader.render(template.user, {
    keyword: input.keyword,
    userContext: input.userContext ?? '',
    excludeDirections: input.excludeDirections?.join(', ') ?? '',
    competitorInsights: competitorInsights
      ? {
          coveredAngles: competitorInsights.coveredAngles,
          opportunityAngles: competitorInsights.opportunityAngles,
          warning: competitorInsights.warning,
        }
      : undefined,
  });

  const result = await this.callLLMJson<TopicAnalysis>([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 注入竞品洞察到输出（即使为 undefined 也写入，Schema 支持 optional）
  result.competitorInsights = competitorInsights;
  return result;
}
```

- [ ] **Step 2: 验证编译无错误**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npx tsc --noEmit src/scenarios/create/steps/topic-analysis.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/scenarios/create/steps/topic-analysis.ts
git commit -m "feat(topic): inject competitor insights into TopicAnalysisStep prompt"
```

---

## Task 5: TUI 展示 — 在 topic-review.ts 中追加竞品洞察文本块

**Files:**
- Modify: `src/cli/ui/topic-review.ts`

**Steps:**

- [ ] **Step 1: 在 reviewTopicAnalysis 的 render 函数中追加竞品洞察展示**

在 `render()` 函数中，在 `console.log(chalk.dim('─'.repeat(60)));` 之后、控制说明之前，追加：

```typescript
// 竞品洞察展示
const insights = (reviewData as any).competitorInsights;
if (insights) {
  console.log(chalk.bold('\n=== 竞品洞察 ==='));
  console.log(chalk.yellow('⚠️ 以下角度已被竞品覆盖，建议差异化切入：'));
  for (const a of insights.coveredAngles ?? []) {
    console.log(`  - [${a.platform}] ${a.angle}（来源：${a.sourceTitle}）`);
  }
  if (insights.opportunityAngles?.length) {
    console.log(chalk.green('\n✨ 空白机会：'));
    for (const o of insights.opportunityAngles) {
      console.log(`  - ${o.angle}：${o.whyOpportunity}`);
    }
  }
  if (insights.warning) {
    console.log(chalk.cyan(`\n建议：${insights.warning}`));
  }
  console.log('');
} else {
  console.log(chalk.dim('\n⚠️ 竞品库暂无数据，跳过竞品洞察注入。\n'));
}
```

- [ ] **Step 2: 验证编译无错误**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npx tsc --noEmit src/cli/ui/topic-review.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/cli/ui/topic-review.ts
git commit -m "feat(topic): display competitor insights in topic-review TUI"
```

---

## Task 6: 端到端验证

**Steps:**

- [ ] **Step 1: 构建项目**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npm run build`
Expected: 编译成功

- [ ] **Step 2: 运行 create 命令测试（无竞品数据场景）**

Run: `cd "D:/myproject/内容系统v1/contentforge" && node dist/index.js create --keyword "AI测试" --no-interactive 2>&1 | head -80`
Expected: 流程正常完成，输出包含"竞品库暂无数据，跳过竞品洞察注入。"

---

## 自检清单

- [ ] 所有新增字段/类型在前置 task 中已定义，后续 task 引用无拼写错误
- [ ] `CompetitorInsight` / `coveredAngles` / `opportunityAngles` / `warning` 名称全项目一致
- [ ] 缓存文件路径 `output/corpus/competitor-insights/{md5(keyword)}.json` 正确
- [ ] 飞书筛选条件：`状态 === 'analyzed' || 'stored'`，按 `收藏优先 + 抓取时间倒序`，最多10条
- [ ] AI 聚合与主题分析使用**同一 provider**，但 prompt 分离（ aggregationPrompt 单独构造，不走 promptLoader）
- [ ] 失败时降级跳过，不阻断主流程

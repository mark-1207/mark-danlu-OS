# ContentForge 选题透明确认 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 CLI 中为原创生成流程添加两个交互确认点（主题分析确认 + 平台选题分配确认），让用户全程可见选题方向并有权修改，同时保持 `--no-interactive` 模式对现有自动化的兼容。

**Architecture:**
- 新增 `src/cli/ui/topic-review.ts` 作为共享 TUI 组件（Step1 和 Step2 共用，参数化）
- `create.ts` 改为在 `--no-interactive` 时才直接跑 pipeline，否则先执行两个交互确认 Step
- `topic-assignment.ts` 修改为读取 `topic-analysis-confirmed` from context，并传给 LLM prompt
- Prompt 模板新增 `excludeDirections` 和 `selectedSubTopicFocus` 变量

**Tech Stack:** Pure TypeScript, chalk, ora (existing), nanoid (existing)

---

## File Map

| 文件 | 职责 |
|------|------|
| `src/cli/ui/topic-review.ts` | **新建** — TUI 交互组件，支持 Step1/Step2 两种模式 |
| `src/cli/commands/create.ts` | **修改** — 添加 `--no-interactive` flag 和交互流程编排 |
| `src/scenarios/create/types.ts` | **修改** — 新增 `TopicAnalysisConfirmed` 和 `TopicAssignmentConfirmed` 类型 |
| `src/scenarios/create/steps/topic-assignment.ts` | **修改** — 读取 context 中的确认结果，向 LLM 传递约束 |
| `src/prompts/templates/create/topic-assignment.user.md` | **修改** — 新增 `excludeDirections` 和 `selectedSubTopicFocus` 变量 |
| `src/prompts/templates/create/topic-analysis.user.md` | **修改** — 已有 `excludeDirections`，无需改动 |

---

## Task 1: 新增类型定义

**Files:**
- Modify: `src/scenarios/create/types.ts`

- [ ] **Step 1: 添加确认类型**

在 `src/scenarios/create/types.ts` 末尾添加：

```typescript
// ─── 选题确认阶段 ────────────────────────────────────────────────

export const SubTopicDecisionSchema = z.object({
  index: z.number(),
  name: z.string(),
  description: z.string(),
  heatLevel: z.enum(['high', 'medium', 'low']),
  decision: z.enum(['pending', 'confirmed', 'rejected']),
});

export const ControversyDecisionSchema = z.object({
  index: z.number(),
  topic: z.string(),
  sideA: z.string(),
  sideB: z.string(),
  decision: z.enum(['pending', 'confirmed', 'rejected']),
});

export const TopicAnalysisReviewSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicDecisionSchema),
  painPoints: z.array(z.object({
    index: z.number(),
    description: z.string(),
    targetAudience: z.string(),
    emotionalTrigger: z.string(),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
  trendingAngles: z.array(z.object({
    index: z.number(),
    angle: z.string(),
    whyTrending: z.string(),
    suitablePlatforms: z.array(z.string()),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
  controversies: z.array(ControversyDecisionSchema),
  targetDemographics: z.array(z.object({
    index: z.number(),
    group: z.string(),
    interests: z.array(z.string()),
    contentPreferences: z.array(z.string()),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
});

export type TopicAnalysisReview = z.infer<typeof TopicAnalysisReviewSchema>;

export interface TopicAnalysisConfirmed {
  topicAnalysis: TopicAnalysis;
  selectedSubTopicIndices: number[];
  excludeDirections: string[];
  extraDirections?: string[];
}

export interface PlatformSelectionConfirmed {
  titleIndex: number;
  title: string;
  angleOverride?: string;
}

export interface TopicAssignmentConfirmed {
  topicAssignment: PlatformAssignments;
  selections: {
    wechat: PlatformSelectionConfirmed;
    xiaohongshu: PlatformSelectionConfirmed;
    douyin: PlatformSelectionConfirmed;
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/scenarios/create/types.ts
git commit -m "feat(create): add confirmation types for topic review flow"
```

---

## Task 2: 修改 Prompt 模板 — Topic Assignment

**Files:**
- Modify: `src/prompts/templates/create/topic-assignment.user.md`

- [ ] **Step 1: 更新 topic-assignment.user.md**

在文件末尾（在 JSON Schema 之前或之后）添加两个新的条件块：

在 `{{topicAnalysis}}` 之后、`JSON Schema:` 之前插入：

```
{{#if excludeDirections}}
注意：请排除以下方向，AI 选题时请勿涉及这些子话题：
{{excludeDirections}}
{{/if}}

{{#if selectedSubTopicFocus}}
重点聚焦以下子话题（请优先从这些方向设计标题）：
{{selectedSubTopicFocus}}
{{/if}}
```

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/prompts/templates/create/topic-assignment.user.md
git commit -m "feat(prompts): add excludeDirections and selectedSubTopicFocus to topic-assignment"
```

---

## Task 3: 新增 TUI 组件

**Files:**
- Create: `src/cli/ui/topic-review.ts`

- [ ] **Step 1: 实现 TUI 组件**

`src/cli/ui/topic-review.ts` 内容如下：

```typescript
import readline from 'readline';
import chalk from 'chalk';
import type { TopicAnalysisReview } from '../../scenarios/create/types.js';

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

const ALL_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;

export interface TopicAssignmentDisplay {
  wechat: { angle: string; titles: string[]; selectedIndex: number };
  xiaohongshu: { angle: string; titles: string[]; selectedIndex: number };
  douyin: { angle: string; titles: string[]; selectedIndex: number };
}

/**
 * Renders and handles interaction for Step 1: Topic Analysis Review.
 * Returns confirmed selections.
 */
export async function reviewTopicAnalysis(
  reviewData: TopicAnalysisReview,
  onRewrite: (group: string) => Promise<TopicAnalysisReview>,
): Promise<{ selectedIndices: number[]; excludeDirections: string[] }> {
  // Set up raw mode for key capture
  rl.question('', () => {}); // ensure readline is active
  readline.emitKeypressEvents(process.stdin);

  let selectedSubTopicIndices = new Set<number>(
    reviewData.subTopics
      .filter((s) => s.heatLevel === 'high' && s.decision === 'pending')
      .map((s) => s.index),
  );
  let cursor = 0;
  let group = 'subTopics';

  const groups = ['subTopics', 'controversies', 'trendingAngles'] as const;
  const groupLabels: Record<string, string> = {
    subTopics: `热度子话题 (已选${selectedSubTopicIndices.size}/${reviewData.subTopics.length})`,
    controversies: `争议话题 (${reviewData.controversies.filter(c => c.decision === 'pending').length}/${reviewData.controversies.length})`,
    trendingAngles: `热门角度`,
  };

  const pendingItems = (g: string) => {
    if (g === 'subTopics') return reviewData.subTopics;
    if (g === 'controversies') return reviewData.controversies;
    return reviewData.trendingAngles;
  };

  const render = () => {
    console.clear();
    console.log(chalk.bold(`\n  🔍 主题深挖 — ${reviewData.keyword}\n`));
    console.log(chalk.gray('─'.repeat(64)));

    for (const g of groups) {
      const items = pendingItems(g);
      const isActive = g === group;
      const label = groupLabels[g];
      const confirmed = items.filter((i: any) => i.decision === 'confirmed').length;
      const shown = items.filter((i: any) => i.decision !== 'rejected');

      console.log(chalk.cyan(`\n  ${label}${confirmed === items.length ? ' [✓]' : ''}`));
      shown.forEach((item: any, idx: number) => {
        const isSelected = g === 'subTopics' && selectedSubTopicIndices.has(item.index);
        const marker = item.decision === 'confirmed' ? chalk.green('✓') :
                       item.decision === 'pending' && isActive && idx === cursor ? chalk.bold('●') :
                       '○';
        const prefix = g === 'subTopics' ? `${marker} [${idx + 1}]` : `${marker}`;
        const heatTag = item.heatLevel ? `[${item.heatLevel.toUpperCase()}]` : '';
        const heatColor = item.heatLevel === 'high' ? chalk.red : item.heatLevel === 'medium' ? chalk.yellow : chalk.gray;
        const line = g === 'subTopics'
          ? `  ${prefix} ${item.name} ${heatColor(heatTag)}`
          : g === 'controversies'
          ? `  ${prefix} "${item.topic}"`
          : `  ${prefix} "${item.angle}" — ${item.whyTrending.substring(0, 40)}...`;
        console.log(isActive && idx === cursor ? chalk.bold(line) : line);
      });
    }

    console.log(chalk.gray('\n  ──────────────────────────────────────────────────────'));
    console.log(chalk.gray('  [空格] 选中/取消   [↑↓] 移动   [r] 重写此组   [回车] 继续\n'));
  };

  return new Promise((resolve) => {
    const handleKeypress = (str: string, key: { name: string }) => {
      const name = key.name;
      const items = pendingItems(group);
      const pending = items.filter((i: any) => i.decision !== 'rejected');

      if (name === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (name === 'down') {
        cursor = Math.min(pending.length - 1, cursor + 1);
        render();
      } else if (name === 'space') {
        if (group === 'subTopics' && pending[cursor]) {
          const idx = pending[cursor].index;
          if (selectedSubTopicIndices.has(idx)) {
            selectedSubTopicIndices.delete(idx);
          } else {
            selectedSubTopicIndices.add(idx);
          }
          render();
        }
      } else if (name === 'return') {
        process.stdin.removeListener('keypress', handleKeypress);
        rl.close();
        const exclude = reviewData.subTopics
          .filter((s) => s.decision === 'pending' && !selectedSubTopicIndices.has(s.index))
          .map((s) => s.name);
        resolve({
          selectedIndices: Array.from(selectedSubTopicIndices),
          excludeDirections: exclude,
        });
      } else if (str === 'r' || str === 'R') {
        process.stdin.removeListener('keypress', handleKeypress);
        rl.close();
        onRewrite(group).then((newData) => {
          reviewTopicAnalysis(newData, onRewrite).then(resolve);
        });
      }
    };

    const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 10 });
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('keypress', handleKeypress);
    render();
  });
}

/**
 * Renders and handles interaction for Step 2: Platform Assignment Review.
 * Returns per-platform title selections.
 */
export async function reviewTopicAssignment(
  assignment: TopicAssignmentDisplay,
): Promise<{ wechat: PlatformSelectionConfirmed; xiaohongshu: PlatformSelectionConfirmed; douyin: PlatformSelectionConfirmed }> {
  const selections = {
    wechat: { titleIndex: assignment.wechat.selectedIndex, title: assignment.wechat.titles[assignment.wechat.selectedIndex] },
    xiaohongshu: { titleIndex: assignment.xiaohongshu.selectedIndex, title: assignment.xiaohongshu.titles[assignment.xiaohongshu.selectedIndex] },
    douyin: { titleIndex: assignment.douyin.selectedIndex, title: assignment.douyin.titles[assignment.douyin.selectedIndex] },
  };

  let currentPlatform = 0;
  const platforms = ALL_PLATFORMS;
  let cursor = 0;

  const render = () => {
    console.clear();
    console.log(chalk.bold(`\n  📋 平台选题分配\n`));
    console.log(chalk.gray('─'.repeat(64)));

    for (let pi = 0; pi < platforms.length; pi++) {
      const p = platforms[pi];
      const data = assignment[p as keyof TopicAssignmentDisplay];
      const isActive = pi === currentPlatform;
      const label = PLATFORM_LABELS[p];
      const sel = selections[p as keyof typeof selections];

      console.log(chalk.cyan(`\n  ${label} ${isActive ? '← 当前' : ''}  当前选中[${sel.titleIndex + 1}]`));
      data.titles.forEach((title, idx) => {
        const marker = idx === sel.titleIndex ? chalk.bold('●') : '○';
        const prefix = `  ${marker} [${idx + 1}]`;
        const truncated = title.length > 50 ? title.substring(0, 50) + '…' : title;
        console.log(isActive && idx === cursor ? chalk.bold(`${prefix} ${truncated}`) : `  ${prefix} ${truncated}`);
      });
      console.log(chalk.gray(`  切入角度: ${data.angle}`));
    }

    console.log(chalk.gray('\n  ──────────────────────────────────────────────────────'));
    console.log(chalk.gray('  [←→] 切换平台   [1-3] 选标题   [回车] 确认\n'));
  };

  return new Promise((resolve) => {
    const handleKeypress = (str: string, key: { name: string }) => {
      const name = key.name;
      const p = platforms[currentPlatform];
      const data = assignment[p as keyof TopicAssignmentDisplay];
      const sel = selections[p as keyof typeof selections];

      if (name === 'left') {
        currentPlatform = (currentPlatform - 1 + platforms.length) % platforms.length;
        cursor = sel.titleIndex;
        render();
      } else if (name === 'right') {
        currentPlatform = (currentPlatform + 1) % platforms.length;
        cursor = sel.titleIndex;
        render();
      } else if (name === 'up') {
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (name === 'down') {
        cursor = Math.min(data.titles.length - 1, cursor + 1);
        render();
      } else if (str === '1' || str === '2' || str === '3') {
        const idx = parseInt(str) - 1;
        if (idx < data.titles.length) {
          sel.titleIndex = idx;
          sel.title = data.titles[idx];
          cursor = idx;
          render();
        }
      } else if (name === 'return') {
        process.stdin.removeListener('keypress', handleKeypress);
        rl.close();
        resolve(selections);
      }
    };

    const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 10 });
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('keypress', handleKeypress);
    render();
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/cli/ui/topic-review.ts
git commit -m "feat(ui): add topic-review TUI component for Step1 and Step2 confirmation"
```

---

## Task 4: 修改 Topic Assignment Step — 支持约束输入

**Files:**
- Modify: `src/scenarios/create/steps/topic-assignment.ts`

- [ ] **Step 1: 修改 topic-assignment.ts**

更新 `doExecute` 方法，在 `topicAnalysis` 读取后，增加约束处理逻辑：

```typescript
// 在 doExecute 方法中，const template = await promptLoader.load(...) 之前插入：

// Read topic-analysis-confirmed from context (set by interactive review step)
const confirmed = context.get<TopicAnalysisConfirmed>('topic-analysis-confirmed');
const excludeDirections = confirmed?.excludeDirections ?? [];
const selectedSubTopicFocus = confirmed?.selectedSubTopicIndices
  ?.map((i) => topicAnalysis.subTopics[i]?.name)
  .filter(Boolean)
  .join('、') ?? '';

// Build exclude string for prompt
const excludeDirectionsStr = excludeDirections.length
  ? excludeDirections.map((d) => `- ${d}`).join('\n')
  : '';
```

然后在 `userPrompt.render()` 调用时，把这两个变量传进去：

```typescript
const userPrompt = promptLoader.render(template.user, {
  topicAnalysis: JSON.stringify(topicAnalysis, null, 2),
  excludeDirections: excludeDirectionsStr,
  selectedSubTopicFocus,
});
```

同时修改 systemPrompt（如果需要的话，也可以在 system prompt 中说明约束）。

**完整文件**（只改 `doExecute` 内部）：

```typescript
protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<PlatformAssignments> {
  const [wechatStrategy, xhsStrategy, douyinStrategy] = await Promise.all([
    fs.readFile(path.join(STRATEGIES_DIR, 'wechat.md'), 'utf-8'),
    fs.readFile(path.join(STRATEGIES_DIR, 'xiaohongshu.md'), 'utf-8'),
    fs.readFile(path.join(STRATEGIES_DIR, 'douyin.md'), 'utf-8'),
  ]);

  const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');
  if (!topicAnalysis) {
    throw new Error('topic-analysis result not found in context');
  }

  // Read confirmation constraints from interactive review step
  const confirmed = context.get<TopicAnalysisConfirmed>('topic-analysis-confirmed');
  const excludeDirections = confirmed?.excludeDirections ?? [];
  const selectedSubTopicIndices = confirmed?.selectedSubTopicIndices ?? [];
  const selectedSubTopicFocus = selectedSubTopicIndices
    .map((i) => topicAnalysis.subTopics[i]?.name)
    .filter(Boolean)
    .join('、');

  const excludeDirectionsStr = excludeDirections.map((d) => `- ${d}`).join('\n');

  const template = await promptLoader.load('create', 'topic-assignment');

  const systemPrompt = promptLoader.render(template.system, {
    wechatStrategy,
    xiaohongshuStrategy: xhsStrategy,
    douyinStrategy,
  });

  const userPrompt = promptLoader.render(template.user, {
    topicAnalysis: JSON.stringify(topicAnalysis, null, 2),
    excludeDirections: excludeDirectionsStr,
    selectedSubTopicFocus,
  });

  const result = await this.callLLMJson<PlatformAssignments>([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return result;
}
```

同时在文件顶部添加 `TopicAnalysisConfirmed` 的 import：

```typescript
import { PlatformAssignmentsSchema, TopicAnalysisSchema, type PlatformAssignments, type TopicAnalysis, type TopicAnalysisConfirmed } from '../types.js';
```

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/scenarios/create/steps/topic-assignment.ts
git commit -m "feat(topic-assignment): read confirmation constraints from context"
```

---

## Task 5: 修改 Create 命令 — 集成交互流程

**Files:**
- Modify: `src/cli/commands/create.ts`

- [ ] **Step 1: 添加 `--no-interactive` option 并重构 `runCreate`**

在 `registerCreateCommand` 中添加新 option：

```typescript
.requiredOption('-k, --keyword <text>', '关键词或主题')
.option('-p, --platforms <list>', `平台列表 (逗号分隔，可选: wechat,xiaohongshu,douyin，默认全部)`)
.option('-c, --context <text>', '用户补充说明')
.option('--no-interactive', '跳过选题确认，直接全自动生成')
```

`runCreate` 函数签名改为：

```typescript
export async function runCreate(
  keyword: string,
  options: { platforms?: string; context?: string; interactive?: boolean },
): Promise<void>
```

在函数开头添加：

```typescript
// Detect non-TTY and auto-enable no-interactive mode
const isInteractive = options.interactive !== false && process.stdin.isTTY;
const interactive = isInteractive;
```

在 `runCreate` 函数中，把执行逻辑改为：

```typescript
let topicAnalysisResult: TopicAnalysis;
let platformAssignmentsResult: PlatformAssignments;

if (interactive) {
  // Step 1: Run topic-analysis
  console.log(chalk.bold('\n🔍 主题深挖中...\n'));
  const topicStep = new TopicAnalysisStep(provider, defaultModel);
  const ctx1 = new PipelineContext('create', runDir, runId + '_ta');
  const taResult = await topicStep.execute({ keyword, userContext: options.context }, ctx1);
  topicAnalysisResult = taResult.data!;

  // Build review data with decision markers
  const reviewData = buildTopicAnalysisReview(topicAnalysisResult);

  // TUI Step 1: Confirm topic analysis
  const { selectedIndices, excludeDirections } = await reviewTopicAnalysis(reviewData, async (group) => {
    // Rewrite: re-run topic-analysis with excludeDirections
    const ctx2 = new PipelineContext('create', runDir, runId + '_ta2');
    const newResult = await topicStep.execute({ keyword, userContext: options.context, excludeDirections }, ctx2);
    return buildTopicAnalysisReview(newResult.data!);
  });

  // Store confirmed result in context
  context.set('topic-analysis', topicAnalysisResult);
  context.set('topic-analysis-confirmed', {
    topicAnalysis: topicAnalysisResult,
    selectedSubTopicIndices: selectedIndices,
    excludeDirections,
  });

  // Step 2: Run topic-assignment
  console.log(chalk.bold('\n📋 平台选题分配中...\n'));
  const taStep = new TopicAssignmentStep(provider, defaultModel);
  // topic-assignment reads from context.set('topic-analysis-confirmed')
  const paResult = await taStep.execute({}, context);
  platformAssignmentsResult = paResult.data!;

  // TUI Step 2: Confirm platform assignments
  const displayData: TopicAssignmentDisplay = {
    wechat: { angle: platformAssignmentsResult.wechat.angle, titles: platformAssignmentsResult.wechat.titleDrafts, selectedIndex: 0 },
    xiaohongshu: { angle: platformAssignmentsResult.xiaohongshu.angle, titles: platformAssignmentsResult.xiaohongshu.titleDrafts, selectedIndex: 0 },
    douyin: { angle: platformAssignmentsResult.douyin.angle, titles: platformAssignmentsResult.douyin.titleDrafts, selectedIndex: 0 },
  };
  const selections = await reviewTopicAssignment(displayData);

  context.set('topic-assignment', platformAssignmentsResult);
  context.set('topic-assignment-confirmed', {
    topicAssignment: platformAssignmentsResult,
    selections,
  });

  // Write selections for each platform back to context so outline steps can use them
  for (const platform of (selectedPlatforms ?? ['wechat', 'xiaohongshu', 'douyin'] as const)) {
    const sel = selections[platform as keyof typeof selections];
    if (sel) {
      context.set(`confirmed-title-${platform}`, sel.title);
    }
  }
} else {
  // Original automated flow
  const result = await pipeline.run({ keyword, userContext: options.context }, context);
  finalContext = result.context;
}
```

**注意：** `buildTopicAnalysisReview` 是一个 helper function，把 `TopicAnalysis` 转换为带 `decision` 标记的 `TopicAnalysisReview`：

```typescript
function buildTopicAnalysisReview(ta: TopicAnalysis): TopicAnalysisReview {
  // Auto-mark: high/medium heat subTopics = pending, low = confirmed
  const subTopics = ta.subTopics.map((s, i) => ({
    index: i,
    name: s.name,
    description: s.description,
    heatLevel: s.heatLevel,
    decision: s.heatLevel === 'low' ? 'confirmed' : 'pending' as const,
  }));
  // controversies: all pending initially (AI uncertain)
  const controversies = ta.controversies.map((c, i) => ({
    index: i,
    topic: c.topic,
    sideA: c.sideA,
    sideB: c.sideB,
    decision: 'pending' as const,
  }));
  // trendingAngles: high = confirmed, rest pending
  const trendingAngles = ta.trendingAngles.map((a, i) => ({
    index: i,
    angle: a.angle,
    whyTrending: a.whyTrending,
    suitablePlatforms: a.suitablePlatforms,
    decision: a.whyTrending.length > 20 ? 'confirmed' : 'pending' as const,
  }));
  // painPoints / demographics: all confirmed (display only)
  const painPoints = ta.painPoints.map((p, i) => ({ index: i, ...p, decision: 'confirmed' as const }));
  const targetDemographics = ta.targetDemographics.map((d, i) => ({ index: i, ...d, decision: 'confirmed' as const }));

  return { keyword: ta.keyword, subTopics, painPoints, trendingAngles, controversies, targetDemographics };
}
```

还需要 import：

```typescript
import { reviewTopicAnalysis, reviewTopicAssignment, type TopicAssignmentDisplay } from '../ui/topic-review.js';
import { TopicAnalysisStep, TopicAssignmentStep } from '../../scenarios/create/steps/index.js';
import type { TopicAnalysisConfirmed, TopicAssignmentConfirmed, PlatformSelectionConfirmed } from '../../scenarios/create/types.js';
```

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/cli/commands/create.ts
git commit -m "feat(create): integrate interactive topic review flow with --no-interactive fallback"
```

---

## Task 6: Outline Step 读取确认标题

**Files:**
- Modify: `src/scenarios/create/steps/outline-generation.ts`

- [ ] **Step 1: 修改 outline generation 使用确认标题**

`outline-wechat.system.md`（以及其他平台）目前使用 `topicAssignment.wechat.titleDrafts[0]` 作为标题。需要改为读取 `context.get('confirmed-title-wechat')`。

在每个 OutlineStep 的 `doExecute` 中，从 context 读取确认标题：

```typescript
// In OutlineWechatStep.doExecute:
const confirmedTitle = context.get<string>('confirmed-title-wechat') ?? topicAssignment.wechat.titleDrafts[0];
// Pass confirmedTitle to prompt instead of topicAssignment.wechat.titleDrafts[0]
```

具体改动：在每个 platform outline step（wechat/xiaohongshu/douyin）的 `doExecute` 方法中，把 `titleDrafts[0]` 替换为从 context 读取的 confirmed title。

- [ ] **Step 2: Commit**

```bash
cd "/d/myproject/内容系统v1/contentforge"
git add src/scenarios/create/steps/outline-generation.ts
git commit -m "feat(outline): read confirmed title from context for each platform"
```

---

## Task 7: 端到端测试

**Files:**
- (无新建文件，用现有 CLI 测试)

- [ ] **Step 1: 构建并测试交互模式**

```bash
cd /d/myproject/内容系统v1/contentforge
npm run build
node dist/index.js create --keyword "AI时代如何保持竞争力"
```

验证：
1. TUI Step1 显示子话题列表，按空格选中/取消，`r` 重写，回车继续
2. TUI Step2 显示三平台标题选项，`←→` 切换，`1-3` 选标题，回车确认
3. 后续步骤正常执行，生成文件

- [ ] **Step 2: 测试 --no-interactive 模式**

```bash
node dist/index.js create --keyword "AI时代" --no-interactive
```

验证：直接跑完整 pipeline，无 TUI，正常输出文件。

- [ ] **Step 3: 测试非 TTY 自动降级**

```bash
echo "AI时代" | node dist/index.js create --keyword "AI时代"
```

验证：自动切换为 --no-interactive 模式，输出警告。

- [ ] **Step 4: Commit test results (if any code changes needed)**

---

## 自检清单

| Spec 章节 | 实现覆盖 |
|-----------|---------|
| Step 1 TUI 展示 | Task 3 `reviewTopicAnalysis` |
| Step 2 TUI 展示 | Task 3 `reviewTopicAssignment` |
| `r` 原地刷新 | Task 3 `onRewrite` callback |
| 标题锁定方向 | Task 5 context.set + Task 6 outline reads confirmed title |
| `--no-interactive` 兼容 | Task 5 `interactive` flag + TTY 检测 |
| topic-assignment 接收约束 | Task 4 `excludeDirections` + `selectedSubTopicFocus` |
| Prompt 模板更新 | Task 2 |
| 类型定义 | Task 1 |

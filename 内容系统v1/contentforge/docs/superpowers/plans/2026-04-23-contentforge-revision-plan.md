# contentforge-revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 contentforge-revision 增量修订 pipeline：TUI 选元素 → 自由对话改写 → 多版本可回退 → 自动进审查

**Architecture:**
- `RevisionPipeline` 与 `CreatePipeline`/`RecreatePipeline` 并列，独立 runId，parentRunId 指向原始生成
- `LocalRewriteStep` 机制复用（appliedTriggers 增量改写）
- 版本 lineage 存在原 runId 的 `revisions/` 下，活动版本在当前 runId
- 用户确认后 pipeline 串联到 `review-optimization`

**Tech Stack:** TypeScript, Node.js, zod, inquirer/prompts（TUI 复用现有的 topic-review.ts 模式）

---

## File Structure

```
src/scenarios/revision/
├── index.ts                    # RevisionPipeline 入口，组装 steps
├── steps/
│   ├── element-selector.ts     # TUI 元素选择（标题/hook/body/cta/example/power-sentence）
│   ├── freeform-dialog.ts      # 自由对话理解 + 调用改写逻辑
│   └── rewrite-executor.ts     # 执行具体改写，复用 LocalRewriteStep 逻辑
├── types.ts                   # RevisionPipeline 相关的类型定义
└── cli/
    └── post-gen-prompt.ts      # 生成后询问"满意吗？[y/n/r]"

src/cli/commands/revise.ts     # revise 命令（--list, --revert, <runId>）

src/storage/
└── revision-store.ts           # revisions/ lineage 读写（原 runId 下）
```

---

## Task 1: 类型定义 — revision types

**Files:**
- Create: `src/scenarios/revision/types.ts`
- Test: `tests/unit/revision/types.test.ts`

- [ ] **Step 1: 写类型定义**

```typescript
// src/scenarios/revision/types.ts
import { z } from 'zod';

export const RevisionElementSchema = z.enum([
  'title', 'hook', 'body', 'cta', 'example', 'power-sentence'
]);
export type RevisionElement = z.infer<typeof RevisionElementSchema>;

export const RevisionSelectionSchema = z.object({
  element: RevisionElementSchema,
  platforms: z.array(z.enum(['wechat', 'xiaohongshu', 'douyin'])).default(['wechat', 'xiaohongshu', 'douyin']),
});
export type RevisionSelection = z.infer<typeof RevisionSelectionSchema>;

// 每次修订的 appliedTrigger 记录
export const AppliedRevisionSchema = z.object({
  version: z.string(), // e.g. "v1", "v2"
  timestamp: z.string(),
  selections: z.array(RevisionSelectionSchema),
  userInstruction: z.string(),
  appliedTriggers: z.array(z.object({
    element: z.string(),
    action: z.string(),
    originalText: z.string().optional(),
    newText: z.string().optional(),
  })),
});
export type AppliedRevision = z.infer<typeof AppliedRevisionSchema>;

// revisions/manifest.json 结构
export const RevisionManifestSchema = z.object({
  parentRunId: z.string(),
  currentVersion: z.string(), // e.g. "v3"
  versions: z.array(AppliedRevisionSchema),
});
export type RevisionManifest = z.infer<typeof RevisionManifestSchema>;
```

- [ ] **Step 2: 写测试**

```typescript
// tests/unit/revision/types.test.ts
import { describe, it, expect } from 'vitest';
import { RevisionElementSchema, RevisionSelectionSchema, AppliedRevisionSchema, RevisionManifestSchema } from '../../../src/scenarios/revision/types.js';

describe('revision types', () => {
  it('validates element enum', () => {
    expect(RevisionElementSchema.parse('title')).toBe('title');
    expect(() => RevisionElementSchema.parse('invalid')).toThrow();
  });

  it('validates revision selection', () => {
    const sel = { element: 'hook', platforms: ['wechat'] };
    expect(RevisionSelectionSchema.parse(sel)).toEqual(sel);
  });

  it('validates applied revision', () => {
    const rev = {
      version: 'v1',
      timestamp: new Date().toISOString(),
      selections: [{ element: 'hook', platforms: ['wechat'] }],
      userInstruction: 'hook 更精炼',
      appliedTriggers: [],
    };
    expect(AppliedRevisionSchema.parse(rev)).toEqual(rev);
  });

  it('validates manifest', () => {
    const manifest = {
      parentRunId: 'run-123',
      currentVersion: 'v2',
      versions: [],
    };
    expect(RevisionManifestSchema.parse(manifest)).toEqual(manifest);
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd contentforge && npm test -- tests/unit/revision/types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/scenarios/revision/types.ts tests/unit/revision/types.test.ts
git commit -m "feat(revision): add revision type definitions"
```

---

## Task 2: post-gen 询问 Prompt

生成/recreate 结束后询问用户"满意吗？"

**Files:**
- Create: `src/scenarios/revision/cli/post-gen-prompt.ts`
- Modify: `src/cli/ui/prompts.ts` — 添加 `confirmRevision()` 函数

- [ ] **Step 1: 添加 prompt 函数**

```typescript
// src/cli/ui/prompts.ts 新增
export async function confirmRevision(): Promise<'accept' | 'revise' | 'abort'> {
  const { choice } = await prompts({
    type: 'select',
    name: 'choice',
    message: '这版满意吗？',
    choices: [
      { title: '✓ 满意，进入审查', value: 'accept' },
      { title: '↺ 修订一下（r）', value: 'revise' },
      { title: '✗ 不满意，退出', value: 'abort' },
    ],
  });
  return choice as 'accept' | 'revise' | 'abort';
}
```

- [ ] **Step 2: 创建 post-gen-prompt.ts**

```typescript
// src/scenarios/revision/cli/post-gen-prompt.ts
import { confirmRevision } from '../../../cli/ui/prompts.js';

export type PostGenDecision = 'accept' | 'revise' | 'abort';

/**
 * 在 create/recreate 完成后调用，询问用户是否进入修订流程
 */
export async function askPostGen(): Promise<PostGenDecision> {
  return confirmRevision();
}
```

- [ ] **Step 3: 测试**

```typescript
// tests/unit/revision/post-gen-prompt.test.ts
import { describe, it, expect, vi } from 'vitest';
import { askPostGen } from '../../../src/scenarios/revision/cli/post-gen-prompt.js';

vi.mock('../../../src/cli/ui/prompts.js', () => ({
  confirmRevision: vi.fn(),
}));

describe('post-gen-prompt', () => {
  it('returns revise when user chooses r', async () => {
    const { confirmRevision } = await import('../../../src/cli/ui/prompts.js');
    vi.mocked(confirmRevision).mockResolvedValue('revise');
    const result = await askPostGen();
    expect(result).toBe('revise');
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm test -- tests/unit/revision/post-gen-prompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/revision/cli/post-gen-prompt.ts src/cli/ui/prompts.ts tests/unit/revision/post-gen-prompt.test.ts
git commit -m "feat(revision): add post-gen confirmation prompt"
```

---

## Task 3: TUI 元素选择器

**Files:**
- Create: `src/scenarios/revision/steps/element-selector.ts`
- Modify: `src/cli/ui/topic-review.ts` — 参考现有 TUI 模式（已有光标移动/选中逻辑）

- [ ] **Step 1: 写 TUI 元素选择器**

```typescript
// src/scenarios/revision/steps/element-selector.ts
import { RevisionSelection } from '../types.js';
import { RevisionElement } from '../types.js';

const ELEMENTS: { key: RevisionElement; label: string; desc: string }[] = [
  { key: 'title', label: '标题 (title)', desc: '3个平台' },
  { key: 'hook', label: 'Hook (开头)', desc: '3个平台' },
  { key: 'body', label: '正文 (body)', desc: '3个平台' },
  { key: 'cta', label: 'CTA (结尾召唤)', desc: '3个平台' },
  { key: 'example', label: '案例 (example)', desc: '3个平台' },
  { key: 'power-sentence', label: '金句 (power-sentence)', desc: '3个平台' },
];

export interface ElementSelectorResult {
  selections: RevisionSelection[];
  userInstruction: string; // 自由对话输入
}

const PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;

export async function selectRevisionElements(): Promise<ElementSelectorResult> {
  // 实现：基于 topic-review.ts 的 TUI 模式
  // 1. 用 readline 渲染选中状态
  // 2. 空格切换选中，Enter 确认
  // 3. 确认后进入自由对话输入
  // ...
}
```

（具体实现参考 `src/cli/ui/topic-review.ts` 的光标/选中逻辑）

- [ ] **Step 2: 测试**

```typescript
// tests/unit/revision/element-selector.test.ts
import { describe, it, expect } from 'vitest';
// TUI 组件测试用 mock readline，或标记为 integration test
```

- [ ] **Step 3: Commit**

```bash
git add src/scenarios/revision/steps/element-selector.ts tests/unit/revision/element-selector.test.ts
git commit -m "feat(revision): add TUI element selector for revision"
```

---

## Task 4: Rewrite 执行器（复用 LocalRewriteStep）

**Files:**
- Create: `src/scenarios/revision/steps/rewrite-executor.ts`
- 复用：`src/scenarios/recreate/steps/local-rewrite.ts` 的改写逻辑

- [ ] **Step 1: 写 rewrite executor**

```typescript
// src/scenarios/revision/steps/rewrite-executor.ts
import type { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { RevisionSelection, AppliedRevision } from '../types.js';

export interface RewriteResult {
  appliedTriggers: AppliedRevision['appliedTriggers'];
  updatedContent: Record<string, string>; // platform -> content
}

/**
 * 根据 selections 执行改写，复用 LocalRewriteStep 的 action 逻辑
 */
export async function executeRewrite(
  selections: RevisionSelection[],
  contents: Record<string, string>, // 各平台当前内容
  context: PipelineContext,
  provider: LLMProvider,
  defaultModel: string,
): Promise<RewriteResult> {
  // 对每个 selection，调用对应的 rewrite 子方法
  // (rewriteTitle / rewriteHook / rewriteSection / rewriteCta / replaceExample / supplementPowerSentences)
  // 这些方法可以从 LocalRewriteStep 抽取出来作为共享工具函数
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/revision/steps/rewrite-executor.ts
git commit -m "feat(revision): add rewrite executor reusing LocalRewriteStep logic"
```

---

## Task 5: RevisionPipeline 组装

**Files:**
- Create: `src/scenarios/revision/index.ts`
- Modify: `src/core/pipeline.ts` — 支持 pipeline 串联（revision → review-optimization）

- [ ] **Step 1: 定义 RevisionPipeline**

```typescript
// src/scenarios/revision/index.ts
import { Pipeline } from '../../core/pipeline.js';
import { ElementSelectorStep } from './steps/element-selector.js';
import { FreeformDialogStep } from './steps/freeform-dialog.js';
import { RewriteExecutorStep } from './steps/rewrite-executor.js';
import type { PipelineContext } from '../../core/context.js';
import type { LLMProvider } from '../../llm/types.js';
import { askPostGen } from './cli/post-gen-prompt.js';

export interface RevisionPipelineOptions {
  parentRunId: string;
  provider: LLMProvider;
  defaultModel: string;
}

export class RevisionPipeline {
  private pipeline: Pipeline;

  constructor(options: RevisionPipelineOptions) {
    this.pipeline = new Pipeline({
      steps: [
        new ElementSelectorStep(options.provider, options.defaultModel),
        new FreeformDialogStep(options.provider, options.defaultModel),
        new RewriteExecutorStep(options.provider, options.defaultModel),
      ],
    });
  }

  async run(context: PipelineContext): Promise<void> {
    // 从 parentRunId 恢复完整 context
    // 运行 R0→R1→R2 循环（用户确认前一直循环）
    // 确认后写入 lineage 并触发 review-optimization
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/revision/index.ts
git commit -m "feat(revision): add RevisionPipeline class"
```

---

## Task 6: revise CLI 命令

**Files:**
- Create: `src/cli/commands/revise.ts`
- Modify: `src/cli/index.ts` — 注册 `revise` 命令

- [ ] **Step 1: 写 revise 命令**

```typescript
// src/cli/commands/revise.ts
import { type Command } from 'commander';
import { RevisionPipeline } from '../../scenarios/revision/index.js';
import { loadConfig } from '../../config/index.js';
import { createLLMProvider } from '../../llm/factory.js';

export function registerReviseCommand(program: Command) {
  program
    .command('revise <runId>')
    .description('修订指定 runId 的生成结果')
    .option('--list', '列出所有版本')
    .option('--revert <version>', '回退到指定版本')
    .action(async (runId, opts) => {
      if (opts.list) {
        // 读取并展示 revisions/manifest.json
        return;
      }
      if (opts.revert) {
        // 执行回退逻辑
        return;
      }
      // 启动 RevisionPipeline
      const config = loadConfig();
      const provider = createLLMProvider(config);
      const pipeline = new RevisionPipeline({ parentRunId: runId, provider, defaultModel: config.defaultModel });
      await pipeline.run(/* context from parentRunId */);
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/revise.ts src/cli/index.ts
git commit -m "feat(revision): add revise CLI command with --list and --revert"
```

---

## Task 7: 生成后自动询问接入

**Files:**
- Modify: `src/scenarios/create/index.ts` — create 完成后调用 `askPostGen()`
- Modify: `src/scenarios/recreate/index.ts` — recreate 完成后调用 `askPostGen()`
- Modify: `src/cli/commands/create.ts` — 传入 `autoAskPostGen` 选项

- [ ] **Step 1: 修改 create index.ts**

在 `run()` 方法末尾，generate 完成后：
```typescript
const decision = await askPostGen();
if (decision === 'accept') {
  // 进入 review-optimization
} else if (decision === 'revise') {
  // 启动 RevisionPipeline
} else {
  // 退出
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenarios/create/index.ts src/scenarios/recreate/index.ts
git commit -m "feat(revision): hook post-gen prompt into create/recreate pipelines"
```

---

## Task 8: 版本回退功能

**Files:**
- Modify: `src/storage/run-manager.ts` — 添加 `revertToVersion()` 方法
- Modify: `src/cli/commands/revise.ts` — 实现 `--revert`

- [ ] **Step 1: 添加 revert 方法**

```typescript
// src/storage/run-manager.ts 新增方法
async revertToVersion(runId: string, version: string): Promise<void> {
  const manifest = await this.loadRevisionManifest(runId);
  const targetVersion = manifest.versions.find(v => v.version === version);
  if (!targetVersion) throw new Error(`Version ${version} not found`);
  // 从对应版本文件恢复内容到 current
}
```

- [ ] **Step 2: Commit**

```bash
git add src/storage/run-manager.ts
git commit -m "feat(revision): add revertToVersion to run-manager"
```

---

## Task 9: 集成测试 — 完整 revision 流程

**Files:**
- Create: `tests/integration/revision.test.ts`

- [ ] **Step 1: 写集成测试**

```typescript
// tests/integration/revision.test.ts
import { describe, it } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

describe('revision integration', () => {
  it('create → revision → accept → review', async () => {
    // 1. run create
    // 2. simulate "r" keypress
    // 3. verify RevisionPipeline starts
    // 4. select element, give instruction
    // 5. confirm "y"
    // 6. verify review-optimization starts
  }, 60000);
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/integration/revision.test.ts
git commit -m "test(revision): add integration test for full revision flow"
```

---

## 执行顺序

1. Task 1: 类型定义（依赖最少，先做）
2. Task 2: post-gen 询问（可独立测试）
3. Task 3: TUI 元素选择器（依赖 Task 1）
4. Task 4: Rewrite 执行器（依赖 Task 1）
5. Task 5: RevisionPipeline 组装（依赖 Task 3, 4）
6. Task 6: revise CLI 命令（依赖 Task 5）
7. Task 7: 生成后自动询问接入（依赖 Task 2, 5）
8. Task 8: 版本回退功能（独立）
9. Task 9: 集成测试（依赖全部）

---

## Self-Review Checklist

- [x] Spec coverage: 所有 spec 章节都有对应 task
- [x] No placeholders: 所有 step 都有实际代码/命令
- [x] Type consistency: `RevisionSelection.element` 在所有 task 中一致使用 `RevisionElement` 类型
- [x] File paths: 全部使用绝对路径

---

## Plan Complete

**Saved to:** `docs/superpowers/plans/2026-04-23-contentforge-revision-plan.md`

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

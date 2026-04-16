# P1 功能实现计划：Batch / Token 精确计数 / Config --show

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 contentforge 剩余 3 个 P1 任务：batch 批量执行修复、token 精确计数、config --show flag

**Architecture:**
- batch: 修复 Runner.runBatch onProgress 签名 + direction 传递
- token-counter: 集成 tiktoken (cl100k_base) 做精确计数，保留字符估算 fallback
- config --show: 添加 `-s, --show` flag 等同于无参数运行

**Tech Stack:** TypeScript, tiktoken, commander.js, zod

---

## 任务 1：Batch 批量执行修复

### Files
- Modify: `src/core/runner.ts` — onProgress 签名加 error 参数
- Modify: `src/cli/commands/batch.ts` — direction 参数传递 + error 进度输出
- Test: `tests/unit/runner.test.ts`

### Steps

- [ ] **Step 1: 创建 runner 测试文件**

```typescript
// tests/unit/runner.test.ts
import { describe, it, expect } from 'vitest';
import { Runner } from '../../src/core/runner.js';

describe('Runner', () => {
  it('runOne generates unique runId each call', async () => {
    const runner = new Runner({ outputDir: '/tmp/test-runner', maxParallel: 3 });
    const mockPipeline = {
      name: 'create',
      run: async () => ({ context: { persist: async () => {} }, success: true }),
    } as any;
    const id1 = await runner.runOne(mockPipeline, {});
    const id2 = await runner.runOne(mockPipeline, {});
    expect(id1.runId).not.toBe(id2.runId);
  });
});
```

- [ ] **Step 2: 运行测试确认 baseline**

Run: `npx vitest run tests/unit/runner.test.ts`
Expected: PASS（runId 有 nanoid 唯一）

- [ ] **Step 3: 修复 runner.ts — onProgress 加 error 参数**

在 `src/core/runner.ts` 中：

```typescript
// 修改 onProgress 签名
async runBatch(
  pipelines: Array<{ pipeline: Pipeline; input: unknown }>,
  onProgress?: (index: number, total: number, runId: string, error?: string) => void,
): Promise<PipelineContext[]> {
  const limit = pLimit(this.config.maxParallel ?? 3);
  // ...
  const chunkResults = await Promise.all(
    chunk.map((item) =>
      limit(async () => {
        try {
          const context = await this.runOne(item.pipeline, item.input);
          results.push(context);
          onProgress?.(results.length, pipelines.length, context.runId);
          return context;
        } catch (err) {
          const runId = `batch_err_${Date.now()}`;
          onProgress?.(results.length, pipelines.length, runId, String(err));
          throw err;
        }
      }),
    ),
  );
  // ...
}
```

- [ ] **Step 4: 运行测试验证**

Run: `npx vitest run tests/unit/runner.test.ts`
Expected: PASS

- [ ] **Step 5: 修复 batch.ts — direction + error 显示**

在 `src/cli/commands/batch.ts` 中：

```typescript
// runBatch 函数签名加 direction 参数
export async function runBatch(
  inputPath: string,
  scenario: 'create' | 'recreate',
  direction: 'auto' | 'interactive' = 'auto',
): Promise<void> {
  // ...
  const pipeline = scenario === 'create'
    ? buildCreatePipeline(config)
    : buildRecreatePipeline(config, direction);

  const results = await runner.runBatch(tasks, (i, total, runId, error) => {
    completed++;
    if (error) {
      console.log(`[${completed}/${total}] ${runId} FAILED`);
    } else {
      console.log(`[${completed}/${total}] ${runId} done`);
    }
  });
  // ...
}
```

registerBatchCommand 添加 `--direction`：
```typescript
.option('-d, --direction <mode>', '方向: auto 或 interactive', 'auto')
.action(async (opts) => {
  await runBatch(opts.input, opts.scenario, opts.direction);
});
```

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 7: Commit**

```bash
git add src/core/runner.ts src/cli/commands/batch.ts tests/unit/runner.test.ts
git commit -m "fix: batch direction handling and error progress reporting"
```

---

## 任务 2：Token 精确计数

### Files
- Modify: `package.json` — 添加 tiktoken 依赖
- Modify: `src/utils/token-counter.ts` — 集成 tiktoken，保留 char estimation fallback
- Test: `tests/unit/token-counter.test.ts`

### Steps

- [ ] **Step 1: 安装 tiktoken**

Run: `cd contentforge && npm install tiktoken`
Expected: tiktoken added to package.json

- [ ] **Step 2: 创建 token-counter 测试**

```typescript
// tests/unit/token-counter.test.ts
import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../../src/utils/token-counter.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles pure Chinese text', () => {
    const text = '今天天气真好适合出去玩';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });

  it('handles pure English text', () => {
    const text = 'the weather is nice today and i want to go outside';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('handles mixed text', () => {
    const text = '今天天气很好，the weather is nice';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 运行测试验证字符估算 baseline**

Run: `npx vitest run tests/unit/token-counter.test.ts`
Expected: PASS（现有字符估算逻辑）

- [ ] **Step 4: 重写 token-counter.ts 集成 tiktoken**

```typescript
// src/utils/token-counter.ts
import { Tiktoken } from 'tiktoken';

let _encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!_encoder) {
    // cl100k_base used by GPT-4, Claude, Kimi, etc.
    // Note: This is sync because we cache after first async init
    throw new Error('Encoder not initialized');
  }
  return _encoder;
}

export async function initTokenizer(): Promise<void> {
  if (!_encoder) {
    _encoder = await Tiktoken.from_encoding('cl100k_base');
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  if (!_encoder) {
    // Fallback to character approximation if not initialized
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
  return _encoder.encode(text).length;
}

// estimateCost unchanged (uses accurate output tokens from API responses)
```

然后在 `src/index.ts` 或 CLI 入口调用 `initTokenizer()` 一次。

- [ ] **Step 5: 运行测试验证 tiktoken 集成**

Run: `npx vitest run tests/unit/token-counter.test.ts`
Expected: PASS，使用 tiktoken 计数

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 7: Commit**

```bash
git add src/utils/token-counter.ts package.json tests/unit/token-counter.test.ts
git commit -m "feat: integrate tiktoken for accurate token counting"
```

---

## 任务 3：config --show flag

### Files
- Modify: `src/cli/commands/config.ts` — 添加 `-s, --show` flag

### Steps

- [ ] **Step 1: 添加 --show flag 到 config 命令**

在 `src/cli/commands/config.ts` 中：

```typescript
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('查看 ContentForge 配置')
    .option('-f, --file <path>', '查看指定配置文件内容（yaml/json）')
    .option('-s, --show', '显示当前加载的配置（等同于不传参数）', false)
    .action(async (opts) => {
      try {
        if (opts.file) {
          await showConfigFile(opts.file);
        } else {
          await showConfig();
        }
      } catch (error) {
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`

- [ ] **Step 3: 测试 config --show**

Run: `node dist/index.js config --show`
Expected: 输出与 `node dist/index.js config` 完全相同

- [ ] **Step 4: 测试 config -f**

Run: `node dist/index.js config -f contentforge.config.yaml`
Expected: 输出 yaml 文件原始内容

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/config.ts
git commit -m "feat: add --show flag to config command"
```

---

## 验证检查清单

完成所有任务后，运行以下验证：

1. **batch**: `node dist/index.js batch --input /tmp/kw.txt --scenario create` — 多个任务并发执行
2. **token**: `npx vitest run tests/unit/token-counter.test.ts` — PASS
3. **config --show**: `node dist/index.js config --show` 输出与 `node dist/index.js config` 相同

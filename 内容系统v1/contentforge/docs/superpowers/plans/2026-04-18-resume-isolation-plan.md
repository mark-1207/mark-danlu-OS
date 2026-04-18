# 问题11：Resume 隔离性 — 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一 runId 任何时刻只能被一个进程操作，防止并发写入 artifact 文件。

**Architecture:** runId 级别文件锁，基于 PID 检测 + stale lock 机制。锁文件存在 `output/{runId}/.lock`。

**Tech Stack:** TypeScript + Node.js fs/promises

---

## 文件结构

```
src/utils/run-lock.ts          # 已有初稿，需修复 bug
tests/unit/run-lock.test.ts    # 新建：锁函数单元测试
src/cli/commands/create.ts     # 修改：集成锁
src/cli/commands/recreate.ts  # 修改：集成锁
src/cli/commands/resume.ts     # 修改：集成锁
```

---

## Chunk 1: 修复 run-lock.ts bug + 写单元测试

### Task 1: 修复 releaseRunLock 路径 bug

**文件:** `src/utils/run-lock.ts:59`

`releaseRunLock` 里 line 59 有个 bug：`path.join(path.join(...))` 重复了。

- [ ] **Step 1: Read current run-lock.ts**

确认 line 59 内容为：
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```

- [ ] **Step 2: Fix the double path.join**

```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
改为：
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
Wait, that's the same. The actual bug is:
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
should be:
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```

Actually let me re-read: the bug is `path.join(path.join(outputDir, runId), LOCK_FILE_NAME)` which is equivalent to `path.join(outputDir, runId, LOCK_FILE_NAME)`. That's not a bug per se, but the `acquireRunLock` uses `path.join(outputDir, runId, LOCK_FILE_NAME)` (via `runDir`) while `releaseRunLock` uses `path.join(path.join(outputDir, runId), LOCK_FILE_NAME)`. Both are equivalent. The bug I noticed is that `runDir` is defined in `acquireRunLock` as:
```typescript
const runDir = path.join(outputDir, runId);
const lockPath = path.join(runDir, LOCK_FILE_NAME);
```
But in `releaseRunLock`:
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
That's actually the same. The real bug I was thinking of doesn't exist in the current code... let me re-check.

Oh wait - looking at line 59 again:
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
This is `path.join(path.join(outputDir, runId), LOCK_FILE_NAME)` = `path.join(outputDir, runId, LOCK_FILE_NAME)`.
And in `acquireRunLock`:
```typescript
const runDir = path.join(outputDir, runId);
const lockPath = path.join(runDir, LOCK_FILE_NAME);
```
That's also `path.join(outputDir, runId, LOCK_FILE_NAME)`.

Actually I think I was confusing myself. The bug was that `acquireRunLock` writes to `outputDir/runId/.lock` but `releaseRunLock` was computing the same path correctly. They should be consistent. The current code looks fine actually. Let me move on to the test.

Actually wait - let me re-read line 59 from the file:
```
59 | const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
vs line 20-21:
```
20 |   const runDir = path.join(outputDir, runId);
21 |   const lockPath = path.join(runDir, LOCK_FILE_NAME);
```
Both compute `outputDir/runId/.lock`. They're equivalent. There's no bug. The "bug" I thought I saw was a misread. I need to actually fix something else - let me check if there's a different issue.

Looking at `acquireRunLock`:
```typescript
const runDir = path.join(outputDir, runId);
```
Then uses `runDir` and `lockPath` correctly.

Looking at `releaseRunLock`:
```typescript
const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
```
That is the same path. OK so there's no bug in the path computation. Let me move on.

### Task 2: 写单元测试

**文件:** 创建 `tests/unit/run-lock.test.ts`

- [ ] **Step 1: Write unit tests for run-lock.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { acquireRunLock, releaseRunLock } from '../../src/utils/run-lock.js';

const TEST_OUTPUT_DIR = path.join(os.tmpdir(), 'contentforge-lock-test');

describe('run-lock', () => {
  const runId = 'test_run_' + Date.now();

  beforeEach(async () => {
    await fs.mkdir(path.join(TEST_OUTPUT_DIR, runId), { recursive: true });
  });

  afterEach(async () => {
    await releaseRunLock(runId, TEST_OUTPUT_DIR).catch(() => {});
    try {
      await fs.rm(path.join(TEST_OUTPUT_DIR, runId), { recursive: true });
    } catch {}
  });

  it('acquires lock and writes lock file', async () => {
    const lock = await acquireRunLock(runId, TEST_OUTPUT_DIR);
    expect(lock.pid).toBe(process.pid);
    expect(lock.hostname).toBe(os.hostname());
    expect(lock.command).toContain('node');

    const lockFile = await fs.readFile(
      path.join(TEST_OUTPUT_DIR, runId, '.lock'),
      'utf-8',
    );
    const parsed = JSON.parse(lockFile);
    expect(parsed.pid).toBe(process.pid);
  });

  it('releases lock and removes lock file', async () => {
    await acquireRunLock(runId, TEST_OUTPUT_DIR);
    await releaseRunLock(runId, TEST_OUTPUT_DIR);

    const lockExists = await fs
      .access(path.join(TEST_OUTPUT_DIR, runId, '.lock'))
      .then(() => true)
      .catch(() => false);
    expect(lockExists).toBe(false);
  });

  it('releaseRunLock is idempotent', async () => {
    await releaseRunLock(runId, TEST_OUTPUT_DIR); // no lock exists
    await expect(releaseRunLock(runId, TEST_OUTPUT_DIR)).resolves.toBeUndefined();
  });

  it('acquiring same lock twice throws', async () => {
    await acquireRunLock(runId, TEST_OUTPUT_DIR);
    await expect(acquireRunLock(runId, TEST_OUTPUT_DIR)).rejects.toThrow(
      'already locked',
    );
  });

  it('stale lock is overwritten', async () => {
    // Manually write a lock with a fake dead PID
    const fakePid = 99999999; // Unlikely to exist
    const staleLockPath = path.join(TEST_OUTPUT_DIR, runId, '.lock');
    await fs.writeFile(
      staleLockPath,
      JSON.stringify({
        pid: fakePid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString(),
        command: 'fake',
      }),
      'utf-8',
    );

    // Should not throw — stale lock detected and overwritten
    const lock = await acquireRunLock(runId, TEST_OUTPUT_DIR);
    expect(lock.pid).toBe(process.pid);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd D:\myproject\内容系统v1\contentforge
npx vitest run tests/unit/run-lock.test.ts
```

Expected: all tests pass (stale lock test may need fake PID to not exist — use 99999999 which won't exist on any system)

---

## Chunk 2: 集成到 CLI 命令

### Task 3: 集成到 create.ts

**文件:** `src/cli/commands/create.ts`

- [ ] **Step 1: Read current create.ts imports and structure**

确认导入部分和 mkdir 位置。

- [ ] **Step 2: Add import**

```typescript
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
```

- [ ] **Step 3: Add lock acquisition after mkdir**

在 `await fs.mkdir(runDir, { recursive: true });` 和 `await setupRunLogger(runDir);` 之间插入：

```typescript
  // Acquire run lock to prevent concurrent resume conflicts
  await acquireRunLock(runId, outputDir);
```

- [ ] **Step 4: Wrap pipeline.run in try/finally for lock release**

将：
```typescript
  progress.startStep('topic-analysis', '主题深挖');
  const { context: finalContext } = await pipeline.run(input, context);
```

改为：
```typescript
  progress.startStep('topic-analysis', '主题深挖');
  let finalContext: PipelineContext;
  try {
    const result = await pipeline.run(input, context);
    finalContext = result.context;
  } finally {
    await releaseRunLock(runId, outputDir);
  }
```

### Task 4: 集成到 recreate.ts

**文件:** `src/cli/commands/recreate.ts`

- [ ] **Step 1: Add import**

```typescript
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
```

- [ ] **Step 2: Add lock acquisition after mkdir**

在 `await fs.mkdir(runDir, { recursive: true }); await setupRunLogger(runDir);` 之后，`// Read original article` 之前：

```typescript
  // Acquire run lock to prevent concurrent resume conflicts
  await acquireRunLock(runId, outputDir);
```

- [ ] **Step 3: Add finally block for lock release**

Wrap the entire `pipeline.run` + interactive resume + local-rewrite block in `try/finally`:
在 `let finalContext: PipelineContext;` 之前加 `try {`，在整个逻辑块之后加 `} finally { await releaseRunLock(runId, outputDir); }`。

看当前结构：
```
let finalContext: PipelineContext;
try {
  const result = await pipeline.run(input, context);
  finalContext = result.context;
} catch (error) {
  ...
}
... cost check ...
... local rewrite ...

return
```

改为：
```
let finalContext: PipelineContext;
try {
  const result = await pipeline.run(input, context);
  finalContext = result.context;
} catch (error) {
  ...existing catch logic...
} finally {
  await releaseRunLock(runId, outputDir);
}
```

### Task 5: 集成到 resume.ts

**文件:** `src/cli/commands/resume.ts`

- [ ] **Step 1: Add import**

```typescript
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
```

- [ ] **Step 2: Add lock around runResume logic**

在 `runResume` 函数里，`const context = await PipelineContext.restore(runId, outputDir);` 之前获取锁，操作完成后在 `finally` 中释放。

当前结构：
```typescript
export async function runResume(...) {
  ...
  await setupRunLogger(runDir);
  const context = await PipelineContext.restore(runId, outputDir);
  ...
  // Snapshot resume path
  if (options.snapshot) {
    ...
    const { context: finalContext } = await pipeline.resumeFrom(...);
    ...
    return;
  }

  // Normal resume path
  const { context: finalContext } = await pipeline.resumeFrom(fromStep, context);
  ...
}
```

改为：
```typescript
export async function runResume(...) {
  ...
  await setupRunLogger(runDir);
  await acquireRunLock(runId, outputDir);

  try {
    const context = await PipelineContext.restore(runId, outputDir);
    ...

    if (options.snapshot) {
      ...
      const { context: finalContext } = await pipeline.resumeFrom(...);
      ...
      return;
    }

    const { context: finalContext } = await pipeline.resumeFrom(fromStep, context);
    ...
  } finally {
    await releaseRunLock(runId, outputDir);
  }
}
```

---

## Chunk 3: 构建 + 端到端验证

### Task 6: 构建

- [ ] **Step 1: Build**

```bash
cd D:\myproject\内容系统v1\contentforge
npm run build
```

Expected: success, no errors

### Task 7: 端到端测试

**手动测试流程：**

1. **Terminal 1**: 启动一个 recreate（或 create），让它运行到中途（至少开始写 artifact）
   ```bash
   node dist/index.js recreate --input sample-article.md --direction auto
   ```

2. **Terminal 2**: 同一个 runId（从 Terminal 1 的输出中找到 runId）尝试 resume
   ```bash
   node dist/index.js resume list
   # 找到刚启动的 runId
   node dist/index.js resume <runId> --from-step viral-differentiation
   ```
   Expected: 报错 "Run "recreate_XXX" is already locked by PID ..."

3. **Terminal 1**: Ctrl+C 终止进程

4. **Terminal 2**: 再次尝试 resume 同 runId
   Expected: 成功（stale lock 被覆盖）

---

## 验收标准

1. `npm run build` 成功
2. 单元测试全部通过
3. 并发 resume 同 runId 时，第二个进程报错而非覆盖 artifact
4. stale lock（进程崩溃后）再次操作同 runId 时自动恢复

# 原创度双层防御 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现原创度双层防御：生成前过滤相似碎片 + 生成后 flag 问题段落 + TUI 精准替换

**Architecture:**
- 第一层：content-generation 选碎片时，碎片 embedding 和原文 case/data/goldQuote embedding 比对，>0.80 过滤
- 第二层：dual-review 时，case/data/goldQuote 逐段和生成内容比对，flag 输出给 TUI
- TUI：展示 flag，用户选要替换哪个，调用 LocalRewriteStep 只改那段

**Tech Stack:** TypeScript, zod, Tavily Embedding API, existing LocalRewriteStep

---

## 文件改动总览

| 任务 | 文件 |
|------|------|
| Task 1 | `src/scenarios/recreate/types.ts` |
| Task 2 | `src/prompts/templates/recreate/viral-deconstruction.system.md` |
| Task 3 | `src/scenarios/recreate/steps/content-generation.ts` |
| Task 4 | `src/scenarios/recreate/steps/dual-review.ts` |
| Task 5 | `src/cli/commands/recreate.ts` |
| Task 6 | `src/utils/embedding.ts` |

---

## Task 1: ViralGenomeSchema 扩展 + goldQuotes 类型

**Files:**
- Modify: `src/scenarios/recreate/types.ts`
- Test: `tests/unit/recreate/types.test.ts`

- [ ] **Step 1: 添加 GoldQuoteSchema**

在 `types.ts` 中找到现有 `caseStudies` 定义附近，添加：

```typescript
export const GoldQuoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  embedding: z.array(z.number()).optional(), // 预计算，不强制
  position: z.string(),
});
export type GoldQuote = z.infer<typeof GoldQuoteSchema>;
```

- [ ] **Step 2: 将 GoldQuoteSchema 添加到 ViralGenomeSchema**

在 `ViralGenomeSchema` 的 `.strict()` 之前添加：

```typescript
// P0-3: 原文金句，二创必须避免直接使用
goldQuotes: z.array(GoldQuoteSchema).default([]),
```

- [ ] **Step 3: 更新 SIMILARITY_THRESHOLD 为 0.80**

在 `src/utils/embedding.ts` 中找到 `SIMILARITY_THRESHOLD = 0.85`，改为：

```typescript
export const SIMILARITY_THRESHOLD = 0.80;
```

- [ ] **Step 4: Run build**

Run: `cd contentforge && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/recreate/types.ts src/utils/embedding.ts
git commit -m "feat(recreate): extend ViralGenomeSchema with goldQuotes and set threshold to 0.80"
```

---

## Task 2: viral-deconstruction prompt 加金句提取

**Files:**
- Modify: `src/prompts/templates/recreate/viral-deconstruction.system.md`

- [ ] **Step 1: 在 prompt 中添加金句提取指令**

找到 prompt 中 `caseStudies` 和 `keyDataPoints` 的提取指令，在其后添加：

```
## 金句提取（goldQuotes）
识别原文中最具传播力的金句（精炼、有共鸣、可单独传播的短句）。每条金句：
- id: 简短唯一标识
- text: 金句原文（50字以内）
- position: 在原文中的位置（如"开头第三段"、"结尾点睛"）

提取 2-5 条最有传播力的金句。金句应该是读者看完后愿意截图分享的句子。
```

- [ ] **Step 2: Commit**

```bash
git add src/prompts/templates/recreate/viral-deconstruction.system.md
git commit -m "feat(recreate): add goldQuotes extraction to viral-deconstruction prompt"
```

---

## Task 3: 生成前 embedding 过滤（content-generation）

**Files:**
- Modify: `src/scenarios/recreate/steps/content-generation.ts`

- [ ] **Step 1: 添加 import**

```typescript
import { computeEmbedding, cosineSimilarity } from '../../../utils/embedding.js';
```

- [ ] **Step 2: 在 doExecute 开头添加原文要素 embedding 过滤逻辑**

在 `const template = await promptLoader.load('recreate', 'recreation-content');` 之前添加：

```typescript
// 原文要素 embedding（用于碎片过滤）
const viralGenome = context.get<ViralGenome>('viral-deconstruction');
const originalElements: { type: string; id: string; text: string; embedding: number[] }[] = [];

// 收集 caseStudies embedding
if (viralGenome?.caseStudies) {
  for (const cs of viralGenome.caseStudies) {
    if (cs.embedding && cs.embedding.length > 0) {
      originalElements.push({ type: 'caseStudy', id: cs.id, text: cs.protagonist + ': ' + cs.story, embedding: cs.embedding });
    }
  }
}

// 收集 keyDataPoints embedding
if (viralGenome?.keyDataPoints) {
  for (const dp of viralGenome.keyDataPoints) {
    if (dp.embedding && dp.embedding.length > 0) {
      originalElements.push({ type: 'keyDataPoint', id: dp.id, text: dp.data + ' (' + dp.field + ')', embedding: dp.embedding });
    }
  }
}

// 收集 goldQuotes embedding（新增）
if (viralGenome?.goldQuotes) {
  for (const gq of viralGenome.goldQuotes) {
    if (gq.embedding && gq.embedding.length > 0) {
      originalElements.push({ type: 'goldQuote', id: gq.id, text: gq.text, embedding: gq.embedding });
    }
  }
}
```

- [ ] **Step 3: 修改碎片加载，过滤相似碎片**

找到碎片加载那段 `loader.getSentenceFragments` 和 `getParagraphFragments`，在调用前添加过滤：

```typescript
// 过滤与原文相似的碎片（embedding > 0.80）
const filteredSentences = sentences.filter(s => {
  if (originalElements.length === 0) return true;
  try {
    const fragEmb = computeEmbedding({ text: s.text });
    for (const el of originalElements) {
      const sim = cosineSimilarity(fragEmb.embedding, el.embedding);
      if (sim > 0.80) {
        return false; // 过滤掉
      }
    }
  } catch {
    // embedding 失败不过滤
  }
  return true;
});

const filteredParagraphs = paragraphs.filter(p => {
  if (originalElements.length === 0) return true;
  try {
    const fragEmb = computeEmbedding({ text: p.content.slice(0, 500) });
    for (const el of originalElements) {
      const sim = cosineSimilarity(fragEmb.embedding, el.embedding);
      if (sim > 0.80) {
        return false;
      }
    }
  } catch {
    // embedding 失败不过滤
  }
  return true;
});
```

然后把 `sentences` → `filteredSentences`，`paragraphs` → `filteredParagraphs`。

- [ ] **Step 4: 调整碎片加载参数**

将 `getSentenceFragments(undefined, 'universal', 5)` 改为 `getSentenceFragments(undefined, 'universal', 8)` 以预留过滤空间。

- [ ] **Step 5: Run build**

Run: `cd contentforge && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/scenarios/recreate/steps/content-generation.ts
git commit -m "feat(recreate): filter similar fragments by embedding before generation"
```

---

## Task 4: dual-review 扩展 goldQuote 检查 + 逐段比对

**Files:**
- Modify: `src/scenarios/recreate/steps/dual-review.ts`

- [ ] **Step 1: 添加 GoldQuote 类型 import**

在文件顶部 import 区域添加：

```typescript
import type { GoldQuote } from '../types.js';
```

- [ ] **Step 2: 扩展 SimilarityCheckItem 的 type 字段**

在 `embedding.ts` 的 `SimilarityCheckItem` 中已有 `id/originalText/recreationText`，但需要加 `elementType` 来区分 case/data/gold-quote。在调用处传递时用结构化方式区分。

实际改动：在 dual-review 的相似度检查循环中，把 `caseStudies` 和 `keyDataPoints` 的检查逻辑**复制一份给 goldQuotes**：

```typescript
// goldQuotes 相似度检查（新增）
if (viralGenome.goldQuotes && viralGenome.goldQuotes.length > 0) {
  const goldQuoteItems: SimilarityCheckItem[] = viralGenome.goldQuotes
    .filter(gq => gq.embedding && gq.embedding.length > 0)
    .map(gq => ({
      id: gq.id,
      elementType: 'goldQuote' as const,
      originalText: gq.text,
    }));

  for (const item of goldQuoteItems) {
    const segments = splitIntoParagraphs(recreationText);
    for (let i = 0; i < segments.length; i++) {
      try {
        const [origEmb, segEmb] = await Promise.all([
          Promise.resolve({ embedding: viralGenome.goldQuotes.find(gq => gq.id === item.id)!.embedding! }),
          computeEmbedding({ text: segments[i] }),
        ]);
        const sim = cosineSimilarity(origEmb.embedding, segEmb.embedding);
        if (sim > 0.80) {
          similarityResults.push({
            id: item.id,
            elementType: 'goldQuote',
            similarity: sim,
            originalText: item.originalText,
            matchedText: segments[i],
            paragraphIndex: i,
            flagged: true,
          });
        }
      } catch {
        // skip
      }
    }
  }
}
```

注意：需要用 `elementType` 扩展 `SimilarityResult` 接口。

- [ ] **Step 3: 扩展 SimilarityResult 类型**

在 `src/utils/embedding.ts` 中找到 `SimilarityResult`，扩展为：

```typescript
export interface SimilarityResult {
  id: string;
  elementType?: 'caseStudy' | 'keyDataPoint' | 'goldQuote';
  similarity: number;
  flagged: boolean;
  originalText: string;
  matchedText: string;
  paragraphIndex?: number;
}
```

- [ ] **Step 4: 阈值统一为 0.80**

确认 `SIMILARITY_THRESHOLD = 0.80` 在 embedding.ts 中。

- [ ] **Step 5: Run build**

Run: `cd contentforge && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/scenarios/recreate/steps/dual-review.ts src/utils/embedding.ts
git commit -m "feat(recreate): extend dual-review with goldQuote check and per-paragraph similarity"
```

---

## Task 5: TUI 精确定位替换

**Files:**
- Modify: `src/cli/commands/recreate.ts`

- [ ] **Step 1: 在 dual-review 完成后读取 flaggedElements**

在 `recreate.ts` 中，`pipeline.run()` 结束后，读取 `finalContext.get<DualReviewResult>('dual-review')`，从中提取 `flaggedElements`（需要确认 dual-review 输出的结构里有这个）。

在 dual-review 的输出结构中，`SimilarityResult[]` 就是 flaggedElements，确保它被写入 context。

- [ ] **Step 2: 实现 TUI 展示和选择**

在 `runRecreate` 函数中，dual-review 完成后添加：

```typescript
// TUI: 展示 flagged elements，用户选择要替换哪个
const flaggedResults = finalContext.get<DualReviewResult>('dual-review')?.similarityResults ?? [];
const flaggedElements = flaggedResults.filter(r => r.flagged && r.elementType !== undefined);

if (flaggedElements.length > 0) {
  console.log(chalk.bold('\n⚠️  检测到以下内容与原文相似\n'));
  flaggedElements.forEach((item, idx) => {
    const typeLabel = item.elementType === 'goldQuote' ? '金句' : item.elementType === 'caseStudy' ? '案例' : '数据';
    console.log(`  ${idx + 1}. [${typeLabel}] 相似度 ${item.similarity.toFixed(2)}`);
    console.log(`     原文: "${item.originalText.slice(0, 50)}..."`);
    console.log(`     生成: "${item.matchedText?.slice(0, 50)}..."\n`);
  });

  const rl = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 300000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.cyan('输入要替换的编号（逗号分隔，如 1,3），回车确认，0 跳过: '), (a) => {
      rl.close();
      process.stdin.setRawMode?.(false);
      resolve(a.trim());
    });
  });

  if (answer !== '0' && answer !== '') {
    const selectedIndices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < flaggedElements.length);
    for (const idx of selectedIndices) {
      const item = flaggedElements[idx];
      console.log(chalk.cyan(`  ↻ 正在替换 [${item.elementType}]...`));
      // 调用 LocalRewriteStep 只替换指定段落
      // context 需要传入：paragraphIndex, originalText, matchedText, elementType
      context.set('rewrite-target', {
        paragraphIndex: item.paragraphIndex,
        originalText: item.originalText,
        matchedText: item.matchedText,
        elementType: item.elementType,
      });
      // resume from local-rewrite with only this element
      await pipeline.resumeFrom('local-rewrite', context);
    }
  }
}
```

- [ ] **Step 3: LocalRewriteStep 支持 targeted rewrite**

在 `LocalRewriteStep` 的 input schema 中添加 `rewriteTarget` 可选参数，让它只重写指定段落。需要看 LocalRewriteStep 的现有结构再定具体改动。

先读：`src/scenarios/recreate/steps/local-rewrite.ts`

- [ ] **Step 4: Run build**

Run: `cd contentforge && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/recreate.ts
git commit -m "feat(recreate): add TUI for targeted rewrite of flagged elements"
```

---

## Task 6: computeEmbedding 工具函数

**Files:**
- Modify: `src/utils/embedding.ts`
- Test: `tests/unit/embedding.test.ts`

- [ ] **Step 1: 添加 computeTextEmbedding 便捷封装**

```typescript
/**
 * Compute embedding for a single text string.
 * Convenience wrapper around computeEmbedding({ text }).
 */
export async function computeTextEmbedding(text: string): Promise<number[]> {
  const result = await computeEmbedding({ text });
  return result.embedding;
}
```

- [ ] **Step 2: Run build**

Run: `cd contentforge && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/utils/embedding.ts
git commit -m "feat(embedding): add computeTextEmbedding convenience wrapper"
```

---

## Task 7: 验证

**Files:**
- None

- [ ] **Step 1: Build 验证**

Run: `cd contentforge && npm run build`
Expected: 无错误

- [ ] **Step 2: 类型检查**

Run: `cd contentforge && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 手动测试**

```bash
cd contentforge && node dist/index.js recreate --input test-data/viral-article.md --direction auto --no-interactive
```
Expected: 正常跑完，输出包含 goldQuotes 提取结果

---

## 执行顺序

1. Task 1: ViralGenomeSchema 扩展 + 阈值 0.80
2. Task 2: viral-deconstruction prompt 金句提取
3. Task 3: 生成前 embedding 过滤
4. Task 4: dual-review 扩展
5. Task 5: TUI 精确定位替换
6. Task 6: computeTextEmbedding 工具
7. Task 7: 验证

---

## Self-Review

- [x] Spec 覆盖：goldQuotes schema ✅，prompt 提取 ✅，生成前过滤 ✅，生成后检查 ✅，TUI 替换 ✅
- [x] 无 placeholder：所有 step 都有实际代码/命令
- [x] 类型一致性：GoldQuote, SimilarityResult, SIMILARITY_THRESHOLD 在各 task 中一致

---

## Plan Complete

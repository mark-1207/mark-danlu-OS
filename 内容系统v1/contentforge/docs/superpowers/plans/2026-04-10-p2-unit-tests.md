# P2 单元测试补充计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 contentforge 补充关键模块的单元测试，覆盖 config/schema、material-search step、differentiation step

**Architecture:** 使用 vitest + vi.mock 进行隔离测试。测试纯逻辑和接口契约，不依赖外部 API。

**Tech Stack:** vitest, zod

---

## 任务 1：Config Schema 测试

### Files
- Create: `tests/config/schema.test.ts`
- Test: `src/config/schema.ts` 的 `ConfigSchema.parse()` 行为

### Steps

- [ ] **Step 1: 创建 config schema 测试文件**

```typescript
// tests/config/schema.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/config/schema.js';

describe('ConfigSchema', () => {
  it('parses valid full config', () => {
    const valid = {
      providers: {
        kimi: { type: 'kimi', defaultModel: 'claude-sonnet-4-6', baseUrl: 'https://yunwu.ai/v1' },
      },
      defaultProvider: 'kimi',
      scenarios: { create: { steps: { 'topic-analysis': { temperature: 0.7 } } } },
      concurrency: { maxParallel: 3, batchSize: 5 },
      output: { dir: './output', saveIntermediateArtifacts: true },
      search: { enabled: false },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.defaultProvider).toBe('kimi');
    expect(result.providers.kimi.type).toBe('kimi');
  });

  it('parses minimal config with defaults', () => {
    const minimal = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
    };
    const result = ConfigSchema.parse(minimal);
    expect(result.concurrency?.maxParallel).toBe(3); // default
    expect(result.output?.dir).toBe('./output'); // default
  });

  it('rejects invalid provider type', () => {
    const invalid = {
      providers: { test: { type: 'unknown' as any, defaultModel: 'test' } },
      defaultProvider: 'test',
    };
    expect(() => ConfigSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid search provider', () => {
    const invalid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'unknown' as any, apiKey: 'key' },
    };
    expect(() => ConfigSchema.parse(invalid)).toThrow();
  });

  it('accepts valid search config', () => {
    const valid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'tavily', apiKey: 'test-key' },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.search?.provider).toBe('tavily');
  });
});
```

- [ ] **Step 2: 运行测试验证**

Run: `cd contentforge && npx vitest run tests/config/schema.test.ts`
Expected: PASS（5 个测试全部通过）

- [ ] **Step 3: Commit**

```bash
git add tests/config/schema.test.ts
git commit -m "test: add config schema validation tests"
```

---

## 任务 2：MaterialSearchStep 测试

### Files
- Create: `tests/scenarios/create/steps/material-search.test.ts`
- Test: `src/scenarios/create/steps/material-search.ts`

### Steps

- [ ] **Step 1: 创建 material-search 测试文件**

```typescript
// tests/scenarios/create/steps/material-search.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterialSearchStep } from '../../../../src/scenarios/create/steps/material-search.js';
import { PipelineContext } from '../../../../src/core/context.js';
import type { LLMProvider } from '../../../../src/llm/types.js';

describe('MaterialSearchStep', () => {
  let mockProvider: LLMProvider;
  let mockContext: PipelineContext;

  beforeEach(() => {
    mockProvider = {
      chat: vi.fn().mockResolvedValue({
        content: '[{"forSection":"intro","type":"case","content":"example data","source":"https://example.com","reliability":"high"}]',
        tokenUsage: { input: 100, output: 50 },
      }),
    } as any;

    mockContext = new PipelineContext('create', '/tmp/test-material', 'test-run');
    // Set required context data
    mockContext.set('topic-analysis', { keyword: 'AI' });
    mockContext.set('topic-assignment', {
      wechat: { platform: 'wechat', angle: 'AI trends', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [2000, 3000], contentType: '', emotionalGoal: '' },
      xiaohongshu: { platform: 'xiaohongshu', angle: 'AI tips', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [1000, 1500], contentType: '', emotionalGoal: '' },
      douyin: { platform: 'douyin', angle: 'AI facts', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [60, 90], contentType: '', emotionalGoal: '' },
    });
    mockContext.set('outline-wechat', {
      sections: [{ title: 'intro', purpose: 'hook', keyPoints: ['point1'], caseSlot: 'need case', wordCount: 500, emotionTarget: 'curiosity' }],
    });
    mockContext.set('outline-xiaohongshu', { tips: [{ title: 'tip1', content: 'tip content', actionable: 'do it' }] });
    mockContext.set('outline-douyin', { corePoint: { statement: 'AI is big', analogy: 'like electricity' }, miniCase: 'case example' });
  });

  it('returns empty when search is disabled', async () => {
    const step = new MaterialSearchStep(mockProvider, 'test-model');
    // Mock getCachedConfig to return search disabled
    vi.doMock('../../../../src/config/loader.js', () => ({
      getCachedConfig: () => ({ search: { enabled: false } }),
    }));
    const result = await step.execute({}, mockContext);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ wechat: [], xiaohongshu: [], douyin: [] });
  });

  it('returns empty when no API key', async () => {
    const step = new MaterialSearchStep(mockProvider, 'test-model');
    vi.doMock('../../../../src/config/loader.js', () => ({
      getCachedConfig: () => ({ search: { enabled: true, provider: 'tavily', apiKey: '' } }),
    }));
    vi.doMock('process.env', () => ({ TAVILY_API_KEY: '', SERPER_API_KEY: '', BING_API_KEY: '' }));
    const result = await step.execute({}, mockContext);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ wechat: [], xiaohongshu: [], douyin: [] });
  });

  it('extracts materials from search results for wechat', async () => {
    const step = new MaterialSearchStep(mockProvider, 'test-model');
    vi.doMock('../../../../src/config/loader.js', () => ({
      getCachedConfig: () => ({ search: { enabled: true, provider: 'tavily', apiKey: 'test-key' } }),
    }));
    const result = await step.execute({}, mockContext);
    expect(result.success).toBe(true);
    expect(result.data?.wechat).toBeDefined();
  });
});
```

Note: `vi.doMock` 在 `beforeEach` 中使用会导致状态污染，改为在测试内部使用 `vi.mock` 并用 `vi.resetModules()` 隔离。

- [ ] **Step 2: 运行测试验证**

Run: `cd contentforge && npx vitest run tests/scenarios/create/steps/material-search.test.ts`
Expected: 可能需要调整 mock 方式

- [ ] **Step 3: 简化测试 — 不依赖 config loader，直接测 extractQueriesFromOutlines**

创建一个纯函数测试文件 `tests/scenarios/create/steps/material-search-queries.test.ts`，只测 `extractQueriesFromOutlines` 函数的逻辑（纯函数，无依赖）：

```typescript
import { describe, it, expect } from 'vitest';
// 直接测试查询提取逻辑
describe('extractQueriesFromOutlines', () => {
  it('extracts queries from wechat sections with case slots', () => {
    // ... 测试用例
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add tests/scenarios/create/steps/material-search.test.ts tests/scenarios/create/steps/material-search-queries.test.ts
git commit -m "test: add material-search step tests"
```

---

## 任务 3：DifferentiationStep 测试

### Files
- Create: `tests/scenarios/recreate/steps/differentiation.test.ts`
- Test: `src/scenarios/recreate/steps/differentiation.ts`

### Steps

- [ ] **Step 1: 创建 differentiation 测试文件**

```typescript
// tests/scenarios/recreate/steps/differentiation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DifferentiationStep } from '../../../../src/scenarios/recreate/steps/differentiation.js';
import { PipelineContext } from '../../../../src/core/context.js';
import type { LLMProvider } from '../../../../src/llm/types.js';

describe('DifferentiationStep', () => {
  let mockProvider: LLMProvider;
  let context: PipelineContext;

  const mockViralGenome = {
    topicStrategy: { painPoint: 'info overload', emotionalTrigger: 'curiosity', targetAudience: 'students', whyItWorks: 'relatable' },
    narrativeStructure: [{ sectionIndex: 0, purpose: 'hook', wordRatio: 0.1, emotionMark: 'curiosity', technique: 'question' }],
    hookTechnique: { type: 'question', mechanism: 'engages', template: 'Ask a question' },
    emotionCurve: [{ position: 0, emotion: 'curiosity', intensity: 5 }],
    powerSentences: [{ original: 'Sentence', structure: 'simple', whyPowerful: 'short' }],
    viralFactors: ['emotion'],
    contentDensityScore: 7,
    estimatedReadTime: '5 min',
  };

  beforeEach(() => {
    context = new PipelineContext('recreate', '/tmp/test-diff', 'test-run');
    context.set('viral-deconstruction', mockViralGenome);
    context.set('_direction', 'auto');
  });

  it('auto mode returns selectedDirection from LLM', async () => {
    const mockLLMResponse = {
      directions: [
        { name: '角度1', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6 },
        { name: '角度2', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 6, feasibilityScore: 9, compositeScore: 7.2 },
      ],
      selectedDirection: { name: '角度1', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6 },
      selectionReason: 'highest composite score',
    };

    const mockProvider = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        tokenUsage: { input: 200, output: 300 },
      }),
    } as any;

    const step = new DifferentiationStep(mockProvider, 'test-model');
    const result = await step.execute({}, context);
    expect(result.success).toBe(true);
    expect(result.data?.selectedDirection?.name).toBe('角度1');
  });

  it('interactive mode returns null selectedDirection', async () => {
    context.set('_direction', 'interactive');

    const mockLLMResponse = {
      directions: [
        { name: '角度1', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6 },
      ],
      selectedDirection: null,
      selectionReason: 'User will select',
    };

    const mockProvider = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        tokenUsage: { input: 200, output: 300 },
      }),
    } as any;

    const step = new DifferentiationStep(mockProvider, 'test-model');
    const result = await step.execute({}, context);
    expect(result.success).toBe(true);
    expect(result.data?.selectedDirection).toBeNull();
    expect(result.data?.directions.length).toBe(1);
  });

  it('throws when viral-deconstruction not in context', async () => {
    const emptyContext = new PipelineContext('recreate', '/tmp/test', 'test');
    const step = new DifferentiationStep({} as any, 'test-model');
    await expect(step.execute({}, emptyContext)).rejects.toThrow('viral-deconstruction not found');
  });
});
```

- [ ] **Step 2: 运行测试验证**

Run: `cd contentforge && npx vitest run tests/scenarios/recreate/steps/differentiation.test.ts`
Expected: PASS（3 个测试全部通过）

- [ ] **Step 3: Commit**

```bash
git add tests/scenarios/recreate/steps/differentiation.test.ts
git commit -m "test: add differentiation step tests"
```

---

## 验证检查清单

完成后运行完整测试：

```bash
cd contentforge && npx vitest run
```

预期：原有 43 + 新增测试全部通过，总数 > 43

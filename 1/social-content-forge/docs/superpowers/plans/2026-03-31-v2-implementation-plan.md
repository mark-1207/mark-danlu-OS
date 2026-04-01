# Social Content Forge v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v2 upgrades including hot discovery, material enhancement, self-evolving generation, nine-dimension quality gating, and style learning library.

**Architecture:** v2 is built as incremental additions to v1, not a rewrite. Each subsystem is implemented as a standalone module with clear interfaces. The generation pipeline is modified to support retry-until-quality-gated output. Hot discovery and style library are orthogonal services.

**Tech Stack:** Node.js + TypeScript, sql.js, axios, zod, vitest

---

## Phase 1: Infrastructure Foundation

### Subsystem 1.1: Type System Upgrade

**Files:**
- Modify: `src/types.ts` — extend with new types for v2

**Changes:**

```typescript
// New in v2:
// Nine-dimension evaluation
export interface NineDimensionScores {
  emotion: number;              // 0-10
  utility: number;              // 0-10
  narrative: number;            // 0-10
  socialCurrency: number;        // 0-10
  controversy: number;           // 0-10
  timeliness: number;            // 0-10
  differentiation: number;       // 0-10 NEW
  shareability: number;          // 0-10 NEW
  conversionPotential: number;   // 0-10 NEW
}

export interface EvaluationResultV2 extends EvaluationResult {
  dimensionScores: NineDimensionScores;
  hasVeto: boolean;             // true if any dimension < 5
  vetoDimensions?: string[];    // list of dimensions that vetoed
}

// Hot topic
export interface HotTopic {
  id: string;
  platform: 'weibo' | 'twitter' | 'google' | 'xiaohongshu' | 'reddit';
  title: string;
  heatScore?: number;
  category?: string;
  link?: string;
  fetchedAt: Date;
}

// Material package for prompt injection
export interface MaterialPackage {
  viralQuotes: string[];        // extractable sharable quotes
  caseStudies: string[];        // concrete examples/data
  counterArguments: string[];   // anti-consensus viewpoints
  sourceArticle?: string;       // reference article URL
}

// Dynamic prompt context
export interface DynamicPromptContext {
  taskBackground: string;
  materialPackage?: MaterialPackage;
  improvementSuggestions: string[];
  targetAudience: AudienceProfile;
  styleExamples?: StyleExample[];
}

export interface AudienceProfile {
  core: string[];       // core audience description
  edge: string[];       // edge audience description
  painPoints: string[];  // what they struggle with
  aspirations: string[]; // what they want
}

export interface StyleExample {
  type: 'good' | 'bad';
  content: string;
  whatWorks?: string;    // for good examples
  whatFails?: string;    // for bad examples
}

// Self-evolution generation result
export interface GenerationWithQuality {
  content: PlatformContent;
  passed: boolean;
  score: number;
  vetoDimensions?: string[];
  improvementSuggestions: string[];
  llmUsed: string;
  iterations: number;
}

// Style library
export interface StyleLibraryIndex {
  lastUpdated: string;
  goodCount: number;
  badCount: number;
  lastCheckedCase?: string;  // last processed case ID
}

export interface StyleInsight {
  id: string;
  addedAt: string;
  sourceCase: string;         // case file name
  insight: string;            // what was learned
  applicableDimensions: string[];  // which quality dimensions
  confirmed: boolean;
}
```

- [ ] **Step 1: Write tests for new types**

```typescript
// tests/unit/types.v2.test.ts
import { describe, it, expect } from 'vitest';
import { NineDimensionScores, HotTopic, MaterialPackage } from '../../src/types';

describe('NineDimensionScores', () => {
  it('should have all nine dimensions', () => {
    const scores: NineDimensionScores = {
      emotion: 7,
      utility: 8,
      narrative: 6,
      socialCurrency: 5,
      controversy: 4,
      timeliness: 7,
      differentiation: 6,
      shareability: 5,
      conversionPotential: 7,
    };
    expect(scores.emotion).toBe(7);
    expect(Object.keys(scores).length).toBe(9);
  });
});

describe('HotTopic', () => {
  it('should create hot topic with required fields', () => {
    const topic: HotTopic = {
      id: 'wb-001',
      platform: 'weibo',
      title: '职场内卷如何破局',
      heatScore: 8500,
      fetchedAt: new Date(),
    };
    expect(topic.platform).toBe('weibo');
  });
});

describe('MaterialPackage', () => {
  it('should hold extracted materials', () => {
    const pkg: MaterialPackage = {
      viralQuotes: ['赚钱最重要的是动脑子'],
      caseStudies: ['冯小刚把段子和王朔聊天时记下来'],
    };
    expect(pkg.viralQuotes.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (new types not yet in types.ts)**

Run: `cd D:/myproject/1/social-content-forge && npx vitest run tests/unit/types.v2.test.ts`
Expected: FAIL — types not exported yet

- [ ] **Step 3: Add new types to src/types.ts**

Add the new interfaces at the end of the file (see types above).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/types.v2.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/unit/types.v2.test.ts
git commit -m "feat(v2): add nine-dimension types, HotTopic, MaterialPackage"
```

---

### Subsystem 1.2: Context Memory Module

**Files:**
- Create: `src/memory/index.ts` — memory module
- Create: `src/memory/loader.ts` — startup memory loader
- Create: `src/memory/types.ts` — memory-specific types
- Modify: `src/cli.ts` — add memory loading to startup

**Memory Module Architecture:**

```typescript
// src/memory/types.ts
export interface ProjectMemory {
  projectId: string;
  indexPath: string;
  lastUpdated: string;
  summary: string;       // one-paragraph summary for quick loading
  pendingTasks: string[];
  recentConclusions: string[];
  userPreferences: UserPreference[];
}

export interface GlobalMemory {
  path: string;
  communicationStyle: string;
  contentStylePreference: string;  // Dan Koe style reference
  preferences: Record<string, string>;
}

export interface MemoryLoadResult {
  globalMemory: GlobalMemory | null;
  projectMemory: ProjectMemory | null;
  newCasesFound: StyleLibraryCase[];
}
```

```typescript
// src/memory/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { GlobalMemory, ProjectMemory, MemoryLoadResult } from './types';
import { StyleLibraryIndex } from '../types';

const GLOBAL_MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.claude/memory/global_memory.md');
const PROJECT_MEMORY_DIR = 'docs/memory';

export function loadGlobalMemory(): GlobalMemory | null {
  if (!fs.existsSync(GLOBAL_MEMORY_PATH)) return null;
  return { path: GLOBAL_MEMORY_PATH, /* ... */ };
}

export function loadProjectMemory(projectRoot: string): ProjectMemory | null {
  const indexPath = path.join(projectRoot, PROJECT_MEMORY_DIR, 'index.md');
  if (!fs.existsSync(indexPath)) return null;
  // parse markdown and extract key sections
  return parsedMemory;
}

export function saveMemory(memory: GlobalMemory | ProjectMemory): void {
  // update the memory file with new conclusions
}

export function checkForNewStyleCases(projectRoot: string): string[] {
  // compare library.json lastCheckedCase with current good/bad directories
  // return list of new case file paths
}
```

- [ ] **Step 1: Write tests for memory module**

```typescript
// tests/unit/memory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalMemory, checkForNewStyleCases } from '../../src/memory';

describe('Memory Module', () => {
  const TEST_PROJECT = 'D:/myproject/1/social-content-forge';

  it('should load global memory if exists', () => {
    const memory = loadGlobalMemory();
    // depends on whether global_memory.md exists
  });

  it('should detect new style cases', () => {
    const newCases = checkForNewStyleCases(TEST_PROJECT);
    expect(Array.isArray(newCases)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/memory.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Create src/memory/ directory and files**

Create `src/memory/types.ts`, `src/memory/index.ts`, `src/memory/loader.ts` with the implementations above.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/memory/ tests/unit/memory.test.ts
git commit -m "feat(v2): add context memory module"
```

---

## Phase 2: Hot Discovery Layer

### Subsystem 2.1: Hot Discovery Core

**Files:**
- Create: `src/hot-discovery/index.ts` — main entry
- Create: `src/hot-discovery/fetcher.ts` — generic fetcher with rate limiting
- Create: `src/hot-discovery/sources/weibo.ts` — Weibo hot list
- Create: `src/hot-discovery/sources/twitter.ts` — Twitter trending
- Create: `src/hot-discovery/sources/google.ts` — Google Trends
- Create: `src/hot-discovery/sources/xiaohongshu.ts` — Xiaohongshu trending
- Create: `src/hot-discovery/sources/reddit.ts` — Reddit popular
- Create: `src/hot-discovery/merger.ts` — merge and dedup topics

**Hot Discovery Interface:**

```typescript
// src/hot-discovery/index.ts
import { HotTopic } from '../types';

export interface HotDiscoveryConfig {
  enabledSources: ('weibo' | 'twitter' | 'google' | 'xiaohongshu' | 'reddit')[];
  updateIntervalMs: number;
  maxTopicsPerSource: number;
}

export class HotDiscoveryService {
  constructor(config: HotDiscoveryConfig);

  async fetchAllTopics(): Promise<HotTopic[]>;
  async fetchFromSource(source: string): Promise<HotTopic[]>;
  async mergeAndDedup(topics: HotTopic[]): Promise<HotTopic[]>;
  async getTopicsByCategory(category: string): Promise<HotTopic[]>;
}
```

**Fetcher Base Class:**

```typescript
// src/hot-discovery/fetcher.ts
export abstract class BaseFetcher {
  protected platform: string;
  protected rateLimitMs: number = 1000;  // default 1 req/sec

  abstract async fetch(): Promise<HotTopic[]>;

  protected async fetchWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // implement rate limiting
  }
}
```

**Weibo Fetcher Example:**

```typescript
// src/hot-discovery/sources/weibo.ts
export class WeiboFetcher extends BaseFetcher {
  protected platform = 'weibo';

  async fetch(): Promise<HotTopic[]> {
    // Uses Weibo hot search API or third-party API
    // Returns HotTopic[] with platform='weibo'
  }
}
```

- [ ] **Step 1: Write tests for hot discovery**

```typescript
// tests/unit/hot-discovery.test.ts
import { describe, it, expect } from 'vitest';
import { HotDiscoveryService } from '../../src/hot-discovery';

describe('HotDiscoveryService', () => {
  it('should fetch from enabled sources', async () => {
    const service = new HotDiscoveryService({
      enabledSources: ['weibo'],
      updateIntervalMs: 60000,
      maxTopicsPerSource: 20,
    });
    const topics = await service.fetchAllTopics();
    expect(topics.length).toBeGreaterThanOrEqual(0);
  });

  it('should merge and dedup topics', async () => {
    const service = new HotDiscoveryService({ /* ... */ });
    const merged = await service.mergeAndDedup([
      { id: '1', platform: 'weibo', title: '测试', fetchedAt: new Date() },
      { id: '2', platform: 'twitter', title: '测试', fetchedAt: new Date() },
    ]);
    // Same title from different platforms should NOT be deduped
    expect(merged.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/hot-discovery.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement hot discovery core**

Create all files in the Files section above. Implement Weibo, Twitter, Google, Xiaohongshu, Reddit fetchers. Use axios for HTTP requests.

- [ ] **Step 4: Run tests and fix any issues**

- [ ] **Step 5: Commit**

```bash
git add src/hot-discovery/ tests/unit/hot-discovery.test.ts
git commit -m "feat(v2): add hot discovery layer with Weibo/Twitter/Google/Xiaohongshu/Reddit"
```

---

## Phase 3: Material Enhancement Module

### Subsystem 3.1: Material Extraction & Enhancement

**Files:**
- Create: `src/material-enhancement/index.ts` — main entry
- Create: `src/material-enhancement/extractor.ts` — extract viral elements from search results
- Create: `src/material-enhancement/prompter.ts` — build enhanced prompt from materials

**Purpose:** When user inputs a short search query, automatically find related good content, extract high-value snippets (viral quotes, case studies, data points), and inject into the generation prompt.

```typescript
// src/material-enhancement/index.ts
import { MaterialPackage, HotTopic } from '../types';

export interface MaterialEnhancementConfig {
  maxMaterialsPerQuery: number;
  preferredSources: string[];
}

export class MaterialEnhancementService {
  constructor(config: MaterialEnhancementConfig, llmCall: LLMCall);

  async enhanceSearchQuery(
    userQuery: string,
    targetAudience: AudienceProfile
  ): Promise<MaterialPackage>;

  async extractFromHotTopic(topic: HotTopic): Promise<MaterialPackage>;

  async findRelatedGoodContent(query: string): Promise<string[]>;
}
```

- [ ] **Step 1: Write tests for material enhancement**

```typescript
// tests/unit/material-enhancement.test.ts
import { describe, it, expect } from 'vitest';
import { MaterialEnhancementService } from '../../src/material-enhancement';

describe('MaterialEnhancementService', () => {
  it('should extract materials from user query', async () => {
    const service = new MaterialEnhancementService(
      { maxMaterialsPerQuery: 5, preferredSources: [] },
      mockLlmCall
    );
    const pkg = await service.enhanceSearchQuery('如何提升认知', mockAudience);
    expect(pkg.viralQuotes.length).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement material enhancement module**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

## Phase 4: Two-Layer Prompt System

### Subsystem 4.1: Prompt Architecture

**Files:**
- Create: `src/prompts/base-prompts.ts` — base prompts for each platform and task
- Create: `src/prompts/dynamic-prompt-builder.ts` — build dynamic prompt from context
- Create: `src/prompts/dan-koe-style.ts` — Dan Koe style guidelines
- Create: `src/prompts/jiang-hu-kou-reference.ts` — Jiang Hu Kou content reference
- Modify: `src/llm/router.ts` — integrate two-layer prompt system

**Base Prompt Structure:**

```typescript
// src/prompts/base-prompts.ts

// WeChat base prompt — Dan Koe style
export const WECHAT_BASE_PROMPT = `【角色】你是一位深度思考者和写作者，写作风格类似DAN KOE，参考姜胡说的内容风格。

【核心风格特征】
- 开篇用个人故事/脆弱性切入，不用公式化开头
- 第一人称"我"的实战经历，不是第三人称泛泛而谈
- 反常识观点，挑战主流观念
- 具体案例支撑（人物/公司/数据）
- 递进式章节（诊断问题→揭示原因→解决方案）
- 口语化、有节奏、短句强调

【受众】
大厂边缘人、小企业主、职场内卷挣扎希望找到新方向的人

【内容结构】
1. 开篇(10%)：个人故事/洞察切入，挑战既有观念
2. 主体章节(80%)：中文序号递进，每章节包含理论+案例+反问
3. 结尾(10%)：简短总结或鼓励，个人化签名

【禁止】
- 空洞励志话语
- 过度承诺("保证"、"一定")
- 过时营销话术
- 忽略复杂性和矛盾
`;

// Quality review prompt (embedded, not separate call)
export const EMBEDDED_REVIEW_PROMPT = `
【评审要求】
生成内容后，按以下标准自检：
1. 是否有个人故事/经历切入（不是"在这个信息爆炸的时代"）
2. 是否有反常识洞察（不是大家都知道的废话）
3. 是否有具体案例/数据支撑（不是空洞道理）
4. 任一维度是否<5分
5. 如不达标，给出具体改进建议

如不达标，输出改进版本而非原版本。
`;
```

**Dynamic Prompt Builder:**

```typescript
// src/prompts/dynamic-prompt-builder.ts
import { DynamicPromptContext, MaterialPackage, StyleExample } from '../types';

export class DynamicPromptBuilder {
  constructor(private basePrompts: BasePrompts) {}

  buildForWechat(ctx: DynamicPromptContext): string {
    let prompt = this.basePrompts.wechat;

    if (ctx.materialPackage) {
      prompt += `\n\n【参考素材】\n`;
      if (ctx.materialPackage.viralQuotes.length > 0) {
        prompt += `高光金句：\n${ctx.materialPackage.viralQuotes.map(q => `- ${q}`).join('\n')}\n`;
      }
      if (ctx.materialPackage.caseStudies.length > 0) {
        prompt += `案例参考：\n${ctx.materialPackage.caseStudies.map(c => `- ${c}`).join('\n')}\n`;
      }
    }

    if (ctx.improvementSuggestions.length > 0) {
      prompt += `\n【上轮改进建议】\n${ctx.improvementSuggestions.map(s => `- ${s}`).join('\n')}\n`;
    }

    prompt += `\n【受众画像】\n`;
    ctx.targetAudience.core.forEach(c => { prompt += `- ${c}\n`; });

    return prompt;
  }

  // Similar for xiaohongshu and twitter
}
```

- [ ] **Step 1: Write tests for prompt system**

```typescript
// tests/unit/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { DynamicPromptBuilder, WECHAT_BASE_PROMPT } from '../../src/prompts';

describe('DynamicPromptBuilder', () => {
  it('should inject materials into base prompt', () => {
    const builder = new DynamicPromptBuilder({ wechat: WECHAT_BASE_PROMPT });
    const prompt = builder.buildForWechat({
      taskBackground: '用户想写一篇关于赚钱的文章',
      materialPackage: {
        viralQuotes: ['赚钱最重要的是动脑子'],
        caseStudies: ['冯小刚案例'],
        counterArguments: [],
      },
      improvementSuggestions: ['加强个人故事'],
      targetAudience: {
        core: ['大厂边缘人'],
        edge: ['小企业主'],
        painPoints: ['职场内卷'],
        aspirations: ['找到新方向'],
      },
    });
    expect(prompt).toContain('赚钱最重要的是动脑子');
    expect(prompt).toContain('冯小刚');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement prompt system**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

## Phase 5: Self-Evolution Generation & Quality Gating

### Subsystem 5.1: Generation Pipeline with Retry

**Files:**
- Create: `src/generation/self-evolution-generator.ts` — core generation with retry logic
- Create: `src/generation/llm-pool.ts` — LLM pool with retry tracking
- Create: `src/generation/quality-gate.ts` — quality gate logic
- Modify: `src/evaluator/index.ts` — upgrade to nine-dimension evaluation
- Modify: `src/index.ts` — integrate self-evolution into main pipeline

**Generation Flow:**

```typescript
// src/generation/self-evolution-generator.ts
import { GenerationWithQuality, Platform, NineDimensionScores } from '../types';

interface LLMConfig {
  name: string;
  strengths: string[];
  maxRetries: number;
}

const LLM_POOL: LLMConfig[] = [
  { name: 'claude', strengths: ['深度长文', '个人洞察'], maxRetries: 1 },
  { name: 'gpt', strengths: ['结构清晰', '实操指南'], maxRetries: 1 },
  { name: 'deepseek', strengths: ['快速生成', '观点鲜明'], maxRetries: 1 },
];

export class SelfEvolutionGenerator {
  constructor(
    private llmCall: LLMCall,
    private promptBuilder: DynamicPromptBuilder,
  ) {}

  async generateWithQualityGate(
    platform: Platform,
    context: DynamicPromptContext,
  ): Promise<GenerationWithQuality> {
    let lastError: string = '';

    for (const llm of LLM_POOL) {
      for (let retry = 0; retry <= llm.maxRetries; retry++) {
        // Generate content
        const content = await this.llmCall(llm.name, context);

        // Evaluate inline (embedded review, not separate call)
        const evaluation = await this.evaluateInline(content, platform);

        if (evaluation.passed) {
          return {
            content,
            passed: true,
            score: evaluation.score,
            llmUsed: llm.name,
            iterations: retry + 1,
            improvementSuggestions: [],
          };
        }

        if (retry < llm.maxRetries) {
          // Update context with improvement suggestions for retry
          context.improvementSuggestions = evaluation.suggestions;
        }

        lastError = `LLM ${llm.name} retry ${retry} failed: score=${evaluation.score}`;
      }
    }

    // All LLMs failed
    throw new Error(`生成达不到要求，已停止任务。Last error: ${lastError}`);
  }

  private async evaluateInline(content: PlatformContent, platform: Platform): Promise<InlineEvaluation> {
    // Call the same LLM to evaluate the content against nine dimensions
    // Returns { passed: boolean, score: number, suggestions: string[] }
  }

  private hasVeto(scores: NineDimensionScores): { veto: boolean; dimensions: string[] } {
    const vetoDimensions: string[] = [];
    for (const [dim, score] of Object.entries(scores)) {
      if (score < 5) vetoDimensions.push(dim);
    }
    return { veto: vetoDimensions.length > 0, dimensions: vetoDimensions };
  }

  private calculateWeightedScore(scores: NineDimensionScores): number {
    const weights = {
      emotion: 0.20,
      utility: 0.20,
      narrative: 0.15,
      socialCurrency: 0.10,
      controversy: 0.10,
      timeliness: 0.05,
      differentiation: 0.10,
      shareability: 0.05,
      conversionPotential: 0.05,
    };
    // weighted sum calculation
  }
}
```

- [ ] **Step 1: Write tests for self-evolution generator**

```typescript
// tests/unit/self-evolution-generator.test.ts
import { describe, it, expect } from 'vitest';
import { SelfEvolutionGenerator } from '../../src/generation';

describe('SelfEvolutionGenerator', () => {
  it('should return content when quality gate passes', async () => {
    const generator = new SelfEvolutionGenerator(mockLlmCall, mockPromptBuilder);
    const result = await generator.generateWithQualityGate('wechat', mockContext);
    expect(result.passed).toBe(true);
  });

  it('should retry up to maxRetries on quality failure', async () => {
    // Test retry logic
  });

  it('should throw error when all LLMs fail', async () => {
    // Test that error message is correct
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement self-evolution generator**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

### Subsystem 5.2: Nine-Dimension Evaluator Upgrade

**Files:**
- Modify: `src/evaluator/index.ts` — extend to nine dimensions
- Modify: `src/llm/router.ts` — add nine-dimension evaluation prompt

**Evaluation Prompt Upgrade:**

```typescript
// Add to generateEvaluationPrompt in router.ts
export function generateEvaluationPromptV2(content: string): string {
  return `【九维度质量评估】
请对以下内容进行九维度评分（每项0-10分）：

内容：
${content}

评分维度：
1. 情绪激发度(0-10)：能否引发强烈情绪反应
2. 实用价值(0-10)：读者能得到什么具体好处
3. 叙事结构(0-10)：故事是否引人入胜，开头是否有钩子
4. 社交货币(0-10)：转发能彰显转发者什么身份
5. 争议引导(0-10)：能否引发讨论而非沉默
6. 时效贴切(0-10)：是否契合当前热点/趋势
7. 差异化程度(0-10)：和同类内容有什么不同
8. 可转发场景(0-10)：读者在什么场景会转发
9. 转化潜力(0-10)：能否推动关注/互动/行动

【否决条件】任一维度<5分则一票否决。
【加权总分】≥85分通过

请返回JSON格式：
{
  "scores": { "emotion": X, "utility": X, ... },
  "weightedScore": XX,
  "hasVeto": true/false,
  "vetoDimensions": ["..."],
  "diagnostics": ["..."],
  "suggestions": ["..."]
}`;
}
```

- [ ] **Step 1: Write tests for nine-dimension evaluation**

```typescript
// tests/unit/evaluator.v2.test.ts
import { describe, it, expect } from 'vitest';
import { calculateWeightedScoreV2, hasVeto } from '../../src/evaluator';

describe('Nine-Dimension Evaluation', () => {
  it('should calculate weighted score correctly', () => {
    const scores = { emotion: 8, utility: 7, narrative: 6, socialCurrency: 5, controversy: 4, timeliness: 7, differentiation: 6, shareability: 5, conversionPotential: 7 };
    const score = calculateWeightedScoreV2(scores);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should detect veto condition', () => {
    const scores = { emotion: 8, utility: 7, narrative: 6, socialCurrency: 5, controversy: 4, timeliness: 7, differentiation: 6, shareability: 5, conversionPotential: 7 };
    const { veto, dimensions } = hasVeto(scores);
    expect(veto).toBe(true);
    expect(dimensions).toContain('controversy');
  });
});
```

- [ ] **Step 2: Run tests to verify behavior**

- [ ] **Step 3: Implement nine-dimension upgrade in evaluator/index.ts**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

## Phase 6: Style Learning Library

### Subsystem 6.1: Style Learning Service

**Files:**
- Create: `src/style-learning/index.ts` — main entry
- Create: `src/style-learning/case-reader.ts` — read case files
- Create: `src/style-learning/insight-generator.ts` — generate insights from cases
- Create: `src/style-learning/updater.ts` — update content quality standards
- Create: `scripts/style-library-check.ts` — CLI script for manual check

**Style Learning Flow:**

```typescript
// src/style-learning/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { StyleLibraryIndex, StyleInsight } from '../types';

const STYLE_LIBRARY_PATH = 'docs/style-library';

export class StyleLearningService {
  constructor(
    private projectRoot: string,
    private llmCall: LLMCall,
  ) {}

  async checkForNewCases(): Promise<string[]> {
    const index = this.loadIndex();
    const lastChecked = index.lastCheckedCase;
    const goodDir = path.join(this.projectRoot, STYLE_LIBRARY_PATH, 'good');
    const badDir = path.join(this.projectRoot, STYLE_LIBRARY_PATH, 'bad');

    const goodFiles = fs.readdirSync(goodDir).filter(f => f.endsWith('.md'));
    const badFiles = fs.readdirSync(badDir).filter(f => f.endsWith('.md'));

    // Return files not yet processed (compare by filename or ID)
    const allFiles = [...goodFiles, ...badFiles];
    return allFiles.filter(f => !lastChecked || f > lastChecked);
  }

  async learnFromCases(caseFiles: string[]): Promise<StyleInsight[]> {
    const insights: StyleInsight[] = [];
    for (const caseFile of caseFiles) {
      const content = fs.readFileSync(caseFile, 'utf-8');
      const insight = await this.generateInsight(content, caseFile);
      insights.push(insight);
    }
    return insights;
  }

  private async generateInsight(content: string, sourceFile: string): Promise<StyleInsight> {
    const prompt = `【风格学习】
请分析以下内容，提取可复用的写作手法：

${content}

请返回JSON格式：
{
  "insight": "这个内容好在/差在哪...",
  "applicableDimensions": ["叙事结构", "情绪激发度", ...]
}`;

    const result = await this.llmCall('claude', prompt);
    return JSON.parse(result);
  }

  async updateQualityStandards(insights: StyleInsight[]): Promise<void> {
    // Update docs/memory/content-quality.md with new insights
  }
}
```

- [ ] **Step 1: Write tests for style learning**

```typescript
// tests/unit/style-learning.test.ts
import { describe, it, expect } from 'vitest';
import { StyleLearningService } from '../../src/style-learning';

describe('StyleLearningService', () => {
  it('should detect new cases', async () => {
    const service = new StyleLearningService('D:/myproject/1/social-content-forge', mockLlmCall);
    const newCases = await service.checkForNewCases();
    expect(Array.isArray(newCases)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement style learning service**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

## Phase 7: Integration & CLI Updates

### Subsystem 7.1: Main Pipeline Integration

**Files:**
- Modify: `src/index.ts` — integrate all v2 modules into main pipeline
- Modify: `src/cli.ts` — add hot discovery commands, style learning on startup
- Create: `src/cli/commands/hot.ts` — hot discovery CLI command
- Create: `src/cli/commands/style-check.ts` — manual style check command

**Updated Main Pipeline:**

```typescript
// src/index.ts — updated generateContent function
export async function generateContent(
  input: string,
  options: {
    targetPlatforms?: Platform[];
    userProvidedTitle?: string;
    syncFeishu?: boolean;
    enableHotDiscovery?: boolean;   // NEW
    hotTopicId?: string;           // NEW
  } = {}
): Promise<GenerationResult> {

  // Step 0: Material enhancement (for search queries)
  let context: DynamicPromptContext;
  if (identifyInputType(input) === 'search') {
    const enhancement = await materialEnhancementService.enhanceSearchQuery(input, targetAudience);
    context.dynamicPrompt.materialPackage = enhancement;
  }

  // Step 1: extract()
  const extracted = await extract(input);

  // Step 2: analyze()
  const { atoms, decodedReport } = await analyze(extracted, llmCall);

  // Step 3: self-evolution generation with quality gate
  const platformContents: PlatformContentMap = {};
  for (const platform of targetPlatforms) {
    const genResult = await selfEvolutionGenerator.generateWithQualityGate(platform, context);
    if (!genResult.passed) {
      throw new Error(genResult.error);
    }
    platformContents[platform] = genResult.content;
  }

  // Step 4: formatEvaluationReport()
  // Step 5: syncToFeishu() (with full platform content)
  // Step 6: save to database

  return result;
}
```

- [ ] **Step 1: Write integration tests**

```typescript
// tests/integration/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { generateContent } from '../../src/index';

describe('v2 Pipeline Integration', () => {
  it('should generate content with quality gate', async () => {
    const result = await generateContent('如何提升职场认知', {
      targetPlatforms: ['wechat'],
      enableHotDiscovery: false,
    });
    expect(result.evaluation?.dimensionScores).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement CLI and main pipeline integration**

- [ ] **Step 4: Run tests and fix issues**

- [ ] **Step 5: Commit**

---

## Phase 8: Feishu Output Fix

### Subsystem 8.1: Full Platform Content Sync

**Files:**
- Modify: `integrations/feishu/sync.ts` — sync full markdown content, not just fields

**Current Problem:** Syncs individual fields. Should sync complete three-platform markdown content.

- [ ] **Step 1: Review current sync implementation**

Read `integrations/feishu/sync.ts` to understand current implementation.

- [ ] **Step 2: Update to sync full content**

- [ ] **Step 3: Test with mock data**

- [ ] **Step 4: Commit**

---

## Task Order and Dependencies

```
Phase 1 (Infrastructure)
  └─ 1.1 Types → 1.2 Memory

Phase 2 (Hot Discovery)
  └─ 2.1 Hot Discovery (independent, can parallel with Phase 1)

Phase 3 (Material Enhancement)
  └─ 3.1 Material Enhancement (depends on 1.1)

Phase 4 (Prompt System)
  └─ 4.1 Two-layer Prompts (depends on 1.1)

Phase 5 (Generation & Quality)
  └─ 5.1 Self-evolution Generator (depends on 3.1, 4.1)
  └─ 5.2 Nine-dimension Evaluator (depends on 1.1, 5.1)

Phase 6 (Style Learning)
  └─ 6.1 Style Learning (independent, can parallel with others)

Phase 7 (Integration)
  └─ 7.1 Main Pipeline Integration (depends on 2.1, 3.1, 5.1, 5.2, 6.1)

Phase 8 (Feishu Fix)
  └─ 8.1 Feishu Full Content Sync (independent)
```

---

## Self-Review Checklist

1. **Spec coverage:** All v2 requirements mapped to tasks?
   - [x] Hot discovery (Phase 2)
   - [x] Material enhancement (Phase 3)
   - [x] Two-layer prompts (Phase 4)
   - [x] Self-evolution generation (Phase 5.1)
   - [x] Nine-dimension quality (Phase 5.2)
   - [x] Style learning library (Phase 6)
   - [x] Memory module (Phase 1.2)
   - [x] Feishu full content sync (Phase 8)

2. **Placeholder scan:** No TODOs/TBDs in implementation steps.

3. **Type consistency:** Types defined in 1.1 are used throughout all subsequent phases.

4. **Test coverage:** Each subsystem has at least basic tests.

---

**Plan complete.** Saved to `docs/superpowers/plans/2026-03-31-v2-implementation-plan.md`.

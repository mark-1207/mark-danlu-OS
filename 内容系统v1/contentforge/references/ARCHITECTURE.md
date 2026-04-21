# ARCHITECTURE.md


## 1. 系统架构图

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ create   │ │ recreate │ │  batch   │ │  resume  │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
└───────┼─────────────┼───────────┼─────────────┼─────────────┘
        │             │           │             │
        ▼             ▼           ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Engine Layer                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Pipeline    │  │   Context    │  │    Runner    │       │
│  │   Executor    │◄─┤   Manager   │  │  (Batch/     │       │
│  │              │  │              │  │   Concurrent) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │               │
└─────────┼─────────────────┼──────────────────┼───────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Scenario Layer                             │
│                                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │  Scenario: Create   │    │ Scenario: Recreate  │         │
│  │  ┌───┐┌───┐┌───┐   │    │  ┌───┐┌───┐┌───┐   │         │
│  │  │S1 ││S2 ││S3 │...│    │  │S1 ││S2 ││S3 │...│         │
│  │  └───┘└───┘└───┘   │    │  └───┘└───┘└───┘   │         │
│  └─────────┬───────────┘    └─────────┬───────────┘         │
└────────────┼──────────────────────────┼─────────────────────┘
             │                          │
             ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                        │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   LLM    │  │  Prompt   │  │ Storage  │  │  Config  │    │
│  │ Provider │  │  Loader   │  │ (Disk)   │  │  Loader  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 2. 核心设计原则

### 2.1 Pipeline 即配置

每个场景的 Pipeline 通过组合 Step 实例来定义，Step 之间通过 Context 传递数据。新增场景只需定义新的 Step 序列，不需要修改引擎代码。

### 2.2 Prompt 与逻辑分离

所有 prompt 模板存储为独立的 Markdown 文件，通过模板变量（`{{variable}}`）注入动态内容。修改 prompt 不需要改代码，不需要重新编译。

### 2.3 Provider 可插拔

LLM Provider 通过接口抽象，新增 provider 只需实现 `LLMProvider` 接口。不同步骤可以使用不同的 provider 和模型。

### 2.4 中间产物即状态

Pipeline 的执行状态完全由 Context 中的中间产物决定。Context 可以持久化到磁盘并恢复，实现断点续跑。

## 3. 数据流设计

### 3.1 场景 A 数据流

```plaintext
keyword: "AI"
    │
    ▼
[Step1: topic-analysis]
    │ output: TopicAnalysis { sub_topics, pain_points, trending_angles, ... }
    ▼
[Step2: topic-assignment]
    │ output: PlatformAssignments { wechat: TopicCard, xiaohongshu: TopicCard, douyin: TopicCard }
    ▼
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
[Step3a: outline]  [Step3b: outline]  [Step3c: outline]    ← 并行
wechat             xiaohongshu        douyin
    │                  │                  │
    ▼                  ▼                  ▼
[Step4a: search]   [Step4b: search]   [Step4c: search]    ← 并行（可选）
    │                  │                  │
    ▼                  ▼                  ▼
[Step5a: generate] [Step5b: generate] [Step5c: generate]  ← 并行
    │                  │                  │
    ▼                  ▼                  ▼
[Step6a: review]   [Step6b: review]   [Step6c: review]    ← 并行
    │                  │                  │
    ▼                  ▼                  ▼
    └──────────────────┴──────────────────┘
                       │
                       ▼
                 FinalOutput
```

### 3.2 场景 B 数据流

```plaintext
original_article: "..."
    │
    ▼
[Step1: viral-deconstruction]
    │ output: ViralGenome { narrative_structure, hook_technique, emotion_curve, ... }
    ▼
[Step2: differentiation]
    │ output: DifferentiationDirections[] → auto-select best
    ▼
[Step3: new-outline]
    │ input: ViralGenome (structure only) + selected direction
    │ ⚠️ 不传入原文
    │ output: NewOutline
    ▼
[Step4: content-generation]
    │ input: ViralGenome (structure + emotion only) + NewOutline
    │ ⚠️ 不传入原文
    │ output: DraftArticle
    ▼
[Step5: dual-review]
    │ input: DraftArticle + original_article (此步需要对比)
    │ output: { finalArticle, originalityReport, qualityScore }
    │
    │ ← 条件回环：如果 originalityReport 有 flagged paragraphs
    │    → 回到 Step4 仅重写标记段落（最多 3 次）
    ▼
FinalOutput
```

## 4. 并行执行设计

场景 A 中 Step 3-6 的三个平台分支是并行执行的。实现方式：

```typescript
// Pipeline 执行引擎中的并行处理
async function executeParallelSteps(
  steps: PipelineStep[],
  inputs: unknown[],
  context: PipelineContext,
  concurrency: number
): Promise<stepresult[]> {
  const limit = pLimit(concurrency);
  const tasks = steps.map((step, i) =>
    limit(() => step.execute(inputs[i], context))
  );
  return Promise.all(tasks);
}
</stepresult[]>
```

Pipeline 定义中通过 `parallelGroups` 声明哪些步骤可以并行：

```typescript
const createPipeline = new Pipeline({
  name: 'create',
  steps: [
    topicAnalysisStep,
    topicAssignmentStep,
    // 以下步骤按平台分组并行
    outlineWechatStep,
    outlineXiaohongshuStep,
    outlineDouyinStep,
    contentWechatStep,
    contentXiaohongshuStep,
    contentDouyinStep,
    reviewWechatStep,
    reviewXiaohongshuStep,
    reviewDouyinStep,
  ],
  parallelGroups: [
    { stepNames: ['outline-wechat', 'outline-xiaohongshu', 'outline-douyin'], concurrency: 3 },
    { stepNames: ['content-wechat', 'content-xiaohongshu', 'content-douyin'], concurrency: 3 },
    { stepNames: ['review-wechat', 'review-xiaohongshu', 'review-douyin'], concurrency: 3 },
  ],
});
```

## 5. 条件回环设计（场景 B Step 5）

```typescript
// 场景B的审查步骤包含条件回环逻辑
class DualReviewStep extends PipelineStep {
  private maxIterations = 3;

  async execute(input: DualReviewInput, context: PipelineContext): Promise<stepresult> {
    let draft = input.draftArticle;
    let iteration = 0;

    while (iteration < this.maxIterations) {
      const reviewResult = await this.review(draft, input.originalArticle);

      if (reviewResult.flaggedParagraphs.length === 0) {
        // 原创度达标，返回终稿
        return { success: true, data: { finalArticle: draft, ...reviewResult } };
      }

      // 原创度不达标，仅重写标记段落
      draft = await this.rewriteFlaggedParagraphs(
        draft,
        reviewResult.flaggedParagraphs,
        context.get('new-outline')
      );
      iteration++;
    }

    // 达到最大迭代次数，返回当前版本并标记警告
    return { success: true, data: { finalArticle: draft, warning: 'Max iterations reached' } };
  }
}
</stepresult>
```

## 6. 中间产物持久化设计

### 6.1 存储结构

```plaintext
output/
└── {run_id}/                           # 每次运行的唯一 ID
    ├── run-meta.json                   # 运行元信息
    ├── step1-topic-analysis.json       # Step 1 输出
    ├── step2-topic-assignment.json     # Step 2 输出
    ├── step3-outline-wechat.json       # Step 3a 输出
    ├── step3-outline-xiaohongshu.json  # Step 3b 输出
    ├── step3-outline-douyin.json       # Step 3c 输出
    ├── step5-content-wechat.md         # Step 5a 输出（Markdown）
    ├── step5-content-xiaohongshu.md    # Step 5b 输出
    ├── step5-content-douyin.md         # Step 5c 输出
    ├── step6-review-wechat.json        # Step 6a 输出
    ├── step6-review-xiaohongshu.json   # Step 6b 输出
    ├── step6-review-douyin.json        # Step 6c 输出
    ├── final-output.json               # 最终输出汇总
    └── run.log                         # 详细日志
```

### 6.2 run-meta.json 结构

```json
{
  "runId": "abc123",
  "scenario": "create",
  "input": { "keyword": "AI" },
  "startedAt": "2026-03-28T22:00:00Z",
  "completedAt": "2026-03-28T22:04:30Z",
  "status": "completed",
  "completedSteps": [
    "topic-analysis",
    "topic-assignment",
    "outline-wechat",
    "outline-xiaohongshu",
    "outline-douyin",
    "content-wechat",
    "content-xiaohongshu",
    "content-douyin",
    "review-wechat",
    "review-xiaohongshu",
    "review-douyin"
  ],
  "tokenUsage": {
    "input": 15000,
    "output": 12000,
    "estimatedCost": 0.45
  }
}
```

### 6.3 断点恢复机制

```typescript
// 从指定步骤恢复执行
async function resumeRun(runId: string, fromStep: string) {
  // 1. 从磁盘恢复 Context
  const context = await PipelineContext.restore(runId);
  
  // 2. 验证所有前置步骤的输出都存在
  const pipeline = getPipelineForScenario(context.scenario);
  const stepIndex = pipeline.steps.findIndex(s => s.config.name === fromStep);
  
  for (let i = 0; i < stepIndex; i++) {
    const step = pipeline.steps[i];
    const output = context.get(step.config.name);
    if (!output) {
      throw new Error(`Missing output for step ${step.config.name}, cannot resume`);
    }
  }
  
  // 3. 从指定步骤继续执行
  return pipeline.resumeFrom(fromStep, context);
}
```

## 7. 错误恢复与重试策略

### 7.1 步骤级重试

每个 Step 可以配置独立的重试策略：

```typescript
class TopicAnalysisStep extends PipelineStep {
  config = {
    name: 'topic-analysis',
    retries: 3,
    retryDelay: 2000, // 初始延迟 2 秒
    retryBackoff: 2,  // 指数退避系数
  };

  async execute(input: unknown, context: PipelineContext): Promise<stepresult> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.doExecute(input, context);
        return { success: true, data: result };
      } catch (error) {
        lastError = error;
        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(this.config.retryBackoff, attempt);
          await sleep(delay);
        }
      }
    }
    
    return { success: false, error: lastError.message };
  }
}
</stepresult>
```

### 7.2 Pipeline 级容错

```typescript
class Pipeline {
  async run(input: unknown): Promise<pipelineresult> {
    const context = new PipelineContext();
    
    for (const step of this.steps) {
      const result = await step.execute(input, context);
      
      if (!result.success) {
        if (step.config.optional) {
          // 可选步骤失败，记录警告并继续
          logger.warn(`Optional step ${step.config.name} failed, continuing`);
          continue;
        } else {
          // 必需步骤失败，终止 Pipeline
          await context.persist(); // 保存当前状态
          throw new Error(`Step ${step.config.name} failed: ${result.error}`);
        }
      }
      
      // 保存中间产物
      context.set(step.config.name, result.data);
      await context.persist();
    }
    
    return { success: true, context };
  }
}
</pipelineresult>
```

## 8. 扩展性设计

### 8.1 新增平台

新增一个平台（如 B 站）只需：

1. 创建平台策略文件：`src/strategies/bilibili.md`

2. 创建 Prompt 模板：

   - `src/prompts/templates/create/step3-outline-bilibili.system.md`

   - `src/prompts/templates/create/step5-content-bilibili.system.md`

   - `src/prompts/templates/create/step6-review-bilibili.system.md`

3. 在 `src/scenarios/create/index.ts` 中添加 B 站分支的 Step 实例

4. 更新 `parallelGroups` 配置

不需要修改核心引擎代码。

### 8.2 新增场景

新增一个场景（如“长文拆分成系列短文”）只需：

1. 创建场景目录：`src/scenarios/split/`

2. 定义步骤：`src/scenarios/split/steps/`

3. 创建 Prompt 模板：`src/prompts/templates/split/`

4. 组装 Pipeline:`src/scenarios/split/index.ts`

5. 在 CLI 中注册新命令：`src/cli/commands/split.ts`

核心引擎和基础设施层完全复用。

### 8.3 新增 LLM Provider

新增一个 Provider（如本地 Ollama）只需：

1. 实现 `LLMProvider` 接口：`src/llm/ollama.ts`

2. 在 `src/llm/factory.ts` 中注册

3. 在配置文件中添加 provider 配置

```typescript
// src/llm/ollama.ts
export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  
  async chat(options: LLMRequestOptions): Promise<llmresponse> {
    // 实现 Ollama API 调用
  }
}
</llmresponse>
```

```yaml
# config/contentforge.yaml
providers:
  ollama:
    type: ollama
    baseUrl: http://localhost:11434
    defaultModel: llama3
```
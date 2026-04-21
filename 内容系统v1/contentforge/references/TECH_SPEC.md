# TECH_SPEC.md


## 1. 技术栈

### 1.1 语言与运行时

- **语言**：TypeScript 5.x

- **运行时**：Node.js 20+ (LTS)

- **包管理**：pnpm

### 1.2 核心依赖

| 依赖 | 用途 | 版本 |
| --- | --- | --- |
| `@anthropic-ai/sdk` | Anthropic Claude API 客户端 | latest |
| `openai` | OpenAI API 客户端 | latest |
| `commander` | CLI 框架 | ^12.x |
| `zod` | 运行时类型校验（LLM 输出解析） | ^3.x |
| `chalk` | CLI 彩色输出 | ^5.x |
| `ora` | CLI loading spinner | ^8.x |
| `dotenv` | 环境变量管理 | ^16.x |
| `p-limit` | 并发控制 | ^6.x |
| `cosmiconfig` | 配置文件加载 | ^9.x |
| `winston` | 日志 | ^3.x |
| `nanoid` | 运行 ID 生成 | ^5.x |

### 1.3 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `vitest` | 单元测试 |
| `tsx` | TypeScript 直接执行 |
| `tsup` | 打包构建 |
| `eslint` + `prettier` | 代码规范 |
| `@types/node` | Node.js 类型定义 |

## 2. 项目结构

```plaintext
contentforge/
├── package.json
├── tsconfig.json
├── .env.example                    # 环境变量模板
├── config/contentforge.yaml        # 默认配置文件
├── README.md
│
├── src/
│   ├── index.ts                    # 入口
│   ├── cli/                        # CLI 层
│   │   ├── index.ts                # commander 注册
│   │   ├── commands/
│   │   │   ├── create.ts           # 场景A命令
│   │   │   ├── recreate.ts         # 场景B命令
│   │   │   ├── batch.ts            # 批量执行命令
│   │   │   ├── resume.ts           # 断点续跑命令
│   │   │   └── config.ts           # 配置查看命令
│   │   └── ui/
│   │       ├── spinner.ts          # loading 动画
│   │       ├── progress.ts         # 进度显示
│   │       └── prompts.ts          # 交互式选择
│   │
│   ├── core/                       # 核心引擎
│   │   ├── pipeline.ts             # Pipeline 执行引擎
│   │   ├── step.ts                 # Step 基类/接口
│   │   ├── context.ts              # Pipeline 上下文（中间产物传递）
│   │   └── runner.ts               # 并发/批量执行器
│   │
│   ├── scenarios/                  # 场景定义
│   │   ├── create/                 # 场景A：原创生成
│   │   │   ├── index.ts            # Pipeline 组装
│   │   │   ├── steps/
│   │   │   │   ├── topic-analysis.ts
│   │   │   │   ├── topic-assignment.ts
│   │   │   │   ├── outline-generation.ts
│   │   │   │   ├── material-search.ts
│   │   │   │   ├── content-generation.ts
│   │   │   │   └── review-optimization.ts
│   │   │   └── types.ts            # 场景A的类型定义
│   │   │
│   │   └── recreate/               # 场景B：爆款二创
│   │       ├── index.ts            # Pipeline 组装
│   │       ├── steps/
│   │       │   ├── viral-deconstruction.ts
│   │       │   ├── differentiation.ts
│   │       │   ├── new-outline.ts
│   │       │   ├── content-generation.ts
│   │       │   └── dual-review.ts
│   │       └── types.ts            # 场景B的类型定义
│   │
│   ├── llm/                        # LLM 抽象层
│   │   ├── provider.ts             # Provider 接口
│   │   ├── anthropic.ts            # Anthropic 实现
│   │   ├── openai.ts               # OpenAI 实现
│   │   ├── factory.ts              # Provider 工厂
│   │   └── types.ts                # LLM 相关类型
│   │
│   ├── prompts/                    # Prompt 管理
│   │   ├── loader.ts               # Prompt 模板加载器
│   │   ├── renderer.ts             # 变量渲染引擎
│   │   └── templates/              # Prompt 模板文件
│   │       ├── create/
│   │       │   ├── step1-topic-analysis.system.md
│   │       │   ├── step1-topic-analysis.user.md
│   │       │   ├── step2-topic-assignment.system.md
│   │       │   ├── step2-topic-assignment.user.md
│   │       │   ├── step3-outline-wechat.system.md
│   │       │   ├── step3-outline-xiaohongshu.system.md
│   │       │   ├── step3-outline-douyin.system.md
│   │       │   ├── step5-content-wechat.system.md
│   │       │   ├── step5-content-xiaohongshu.system.md
│   │       │   ├── step5-content-douyin.system.md
│   │       │   ├── step6-review-wechat.system.md
│   │       │   ├── step6-review-xiaohongshu.system.md
│   │       │   └── step6-review-douyin.system.md
│   │       └── recreate/
│   │           ├── step1-deconstruction.system.md
│   │           ├── step1-deconstruction.user.md
│   │           ├── step2-differentiation.system.md
│   │           ├── step3-new-outline.system.md
│   │           ├── step4-content-generation.system.md
│   │           └── step5-dual-review.system.md
│   │
│   ├── strategies/                 # 平台策略知识库
│   │   ├── wechat.md
│   │   ├── xiaohongshu.md
│   │   └── douyin.md
│   │
│   ├── config/                     # 配置管理
│   │   ├── schema.ts               # 配置 schema (zod)
│   │   ├── loader.ts               # 配置加载
│   │   └── defaults.ts             # 默认配置
│   │
│   ├── storage/                    # 持久化
│   │   ├── artifact-store.ts       # 中间产物存储
│   │   └── run-manager.ts          # 运行记录管理
│   │
│   └── utils/
│       ├── json-parser.ts          # 安全的 JSON 解析（处理 LLM 输出）
│       ├── retry.ts                # 重试逻辑
│       ├── token-counter.ts        # Token 计数
│       └── logger.ts               # 日志工具
│
├── tests/
│   ├── core/
│   │   ├── pipeline.test.ts
│   │   └── context.test.ts
│   ├── scenarios/
│   │   ├── create/
│   │   │   └── steps/*.test.ts
│   │   └── recreate/
│   │       └── steps/*.test.ts
│   ├── llm/
│   │   └── provider.test.ts
│   └── fixtures/                   # 测试用的固定数据
│       ├── sample-keyword-output.json
│       └── sample-viral-article.md
│
└── output/                         # 运行输出目录（gitignore）
    └── {run_id}/
        ├── run-meta.json
        ├── step1-topic-analysis.json
        ├── step2-topic-assignment.json
        ├── step3-outline-wechat.json
        ├── step3-outline-xiaohongshu.json
        ├── step3-outline-douyin.json
        ├── ...
        └── final-output.json
```

## 3. 核心接口定义

### 3.1 Pipeline 引擎

```typescript
// src/core/step.ts
interface StepConfig {
  name: string;
  description: string;
  /** 该步骤使用的 LLM provider key，对应配置文件中的 provider 配置 */
  providerKey?: string;
  /** 该步骤使用的模型，覆盖 provider 默认模型 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大输出 token */
  maxTokens?: number;
  /** 是否可跳过 */
  optional?: boolean;
  /** 重试次数 */
  retries?: number;
}

interface StepResult<t =="" unknown=""> {
  success: boolean;
  data?: T;
  error?: string;
  tokenUsage: {
    input: number;
    output: number;
  };
  durationMs: number;
}

abstract class PipelineStep<tinput =="" unknown,="" toutput="unknown"> {
  abstract config: StepConfig;
  abstract execute(input: TInput, context: PipelineContext): Promise<stepresult<toutput>>;
  abstract validateOutput(output: unknown): TOutput; // zod schema validation
}
</stepresult<toutput></tinput></t>
```

```typescript
// src/core/pipeline.ts
interface PipelineConfig {
  name: string;
  description: string;
  steps: PipelineStep[];
  /** 并行步骤组定义 */
  parallelGroups?: {
    stepNames: string[];
    /** 最大并发数 */
    concurrency?: number;
  }[];
}

class Pipeline {
  constructor(config: PipelineConfig);
  
  /** 从头执行 */
  run(input: unknown): Promise<pipelineresult>;
  
  /** 从指定步骤恢复执行 */
  resumeFrom(stepName: string, context: PipelineContext): Promise<pipelineresult>;
  
  /** 注册步骤完成回调（用于 CLI 进度显示） */
  onStepComplete(callback: (stepName: string, result: StepResult) => void): void;
}
</pipelineresult></pipelineresult>
```

```typescript
// src/core/context.ts
class PipelineContext {
  readonly runId: string;
  readonly startedAt: Date;
  
  /** 存储中间产物 */
  set(key: string, value: unknown): void;
  
  /** 获取中间产物 */
  get<t>(key: string): T;
  
  /** 持久化当前上下文到磁盘 */
  persist(): Promise<void>;
  
  /** 从磁盘恢复上下文 */
  static restore(runId: string): Promise<pipelinecontext>;
  
  /** 获取 token 用量汇总 */
  getTotalTokenUsage(): { input: number; output: number; estimatedCost: number };
}
</pipelinecontext></void></t>
```

### 3.2 LLM Provider 抽象

```typescript
// src/llm/types.ts
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMRequestOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 强制 JSON 输出（如果 provider 支持） */
  jsonMode?: boolean;
}

interface LLMResponse {
  content: string;
  tokenUsage: {
    input: number;
    output: number;
  };
  model: string;
  finishReason: string;
}

// src/llm/provider.ts
interface LLMProvider {
  name: string;
  chat(options: LLMRequestOptions): Promise<llmresponse>;
}
</llmresponse>
```

### 3.3 Prompt 模板

```typescript
// src/prompts/loader.ts
interface PromptTemplate {
  system: string;
  user: string;
}

class PromptLoader {
  /** 加载指定场景和步骤的 prompt 模板 */
  load(scenario: string, stepName: string, variant?: string): PromptTemplate;
  
  /** 渲染模板变量 */
  render(template: string, variables: Record<string, string="">): string;
}
</string,>
```

### 3.4 配置 Schema

```typescript
// src/config/schema.ts
const ConfigSchema = z.object({
  /** LLM Provider 配置 */
  providers: z.record(z.string(), z.object({
    type: z.enum(['anthropic', 'openai']),
    apiKey: z.string().optional(), // 可从环境变量读取
    baseUrl: z.string().optional(),
    defaultModel: z.string(),
  })),
  
  /** 默认 provider */
  defaultProvider: z.string(),
  
  /** 场景级别的步骤配置覆盖 */
  scenarios: z.object({
    create: z.object({
      steps: z.record(z.string(), z.object({
        providerKey: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
      })).optional(),
    }).optional(),
    recreate: z.object({
      steps: z.record(z.string(), z.object({
        providerKey: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
      })).optional(),
    }).optional(),
  }).optional(),
  
  /** 并发配置 */
  concurrency: z.object({
    maxParallel: z.number().default(3),
    batchSize: z.number().default(5),
  }).optional(),
  
  /** 输出配置 */
  output: z.object({
    dir: z.string().default('./output'),
    saveIntermediateArtifacts: z.boolean().default(true),
  }).optional(),
  
  /** 搜索 API 配置（用于素材检索步骤） */
  search: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['tavily', 'serper', 'bing']).optional(),
    apiKey: z.string().optional(),
  }).optional(),
});
```

## 4. 配置文件示例

```yaml
# config/contentforge.yaml

providers:
  anthropic:
    type: anthropic
    defaultModel: claude-sonnet-4-20250514
  openai:
    type: openai
    defaultModel: gpt-4o

defaultProvider: anthropic

scenarios:
  create:
    steps:
      topic-analysis:
        temperature: 0.7
        maxTokens: 4000
      topic-assignment:
        temperature: 0.6
        maxTokens: 4000
      outline-generation:
        temperature: 0.6
        maxTokens: 4000
      content-generation:
        temperature: 0.8
        maxTokens: 8000
      review-optimization:
        temperature: 0.4
        maxTokens: 8000
  recreate:
    steps:
      viral-deconstruction:
        temperature: 0.3
        maxTokens: 6000
      differentiation:
        temperature: 0.8
        maxTokens: 4000
      new-outline:
        temperature: 0.6
        maxTokens: 4000
      content-generation:
        temperature: 0.8
        maxTokens: 8000
      dual-review:
        temperature: 0.3
        maxTokens: 8000

concurrency:
  maxParallel: 3
  batchSize: 5

output:
  dir: ./output
  saveIntermediateArtifacts: true

search:
  enabled: false
```

## 5. 错误处理规范

### 5.1 错误分类

| 错误类型 | 处理策略 |
| --- | --- |
| API 限流 (429) | 指数退避重试，初始 2s，最多 3 次 |
| API 服务错误 (5xx) | 指数退避重试，初始 1s，最多 3 次 |
| API 认证失败 (401/403) | 立即终止，提示检查 API Key |
| JSON 解析失败 | 重试 1 次（在 user prompt 中追加格式提醒），仍失败则尝试宽松解析 |
| 输出校验失败 (zod) | 重试 1 次（在 user prompt 中追加缺失字段提醒），仍失败则记录警告继续 |
| 网络超时 | 重试 2 次，超时时间递增（30s → 60s → 120s） |
| 中间产物缺失 | 检查磁盘缓存，如有则恢复，如无则从该步骤重新执行 |

### 5.2 JSON 安全解析

LLM 输出的 JSON 经常包含 markdown 代码块标记或尾部多余文本。JSON 解析器需要：

1. 先尝试直接 `JSON.parse`

2. 失败则提取 `json ... ` 代码块内容再解析

3. 仍失败则用正则提取第一个 `{` 到最后一个 `}` 之间的内容再解析

4. 仍失败则抛出错误触发重试

## 6. 日志规范

使用 winston，三个级别：

- `info`：步骤开始/完成、token 用量、运行摘要

- `warn`：输出校验部分失败、重试触发

- `error`：不可恢复错误

日志同时输出到 console（简洁格式）和文件（`output/{run_id}/run.log`，详细 JSON 格式）。
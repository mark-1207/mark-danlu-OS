# CLAUDE_CODE_INSTRUCTIONS.md


## 项目概述

你要开发一个名为 ContentForge 的 CLI 工具，它是一个基于多步骤 LLM 编排的内容生成系统。请严格按照以下文档进行开发：

- `PRD.md` — 产品需求文档（功能定义和优先级）

- `TECH_SPEC.md` — 技术规范（技术栈、项目结构、接口定义）

- `ARCHITECTURE.md` — 架构设计（系统架构、数据流、并行/回环设计）

- `WORKFLOW_DESIGN.md` — 工作流详细设计（每个步骤的输入输出 Schema）

- `PROMPT_TEMPLATES.md` — Prompt 模板库（所有 LLM 调用的 prompt）

## 开发顺序

请按照以下顺序进行开发，每完成一个阶段后暂停等待确认：

### Phase 1: 项目脚手架

1. 初始化项目：`pnpm init`，配置 `package.json`、`tsconfig.json`、`.eslintrc`、`.prettierrc`

2. 安装所有依赖（参见 TECH_SPEC.md 1.2 和 1.3 节）

3. 创建完整的目录结构（参见 TECH_SPEC.md 第 2 节）

4. 创建 `.env.example` 文件

5. 创建默认配置文件 `contentforge.config.yaml`（参见 TECH_SPEC.md 第 4 节）

### Phase 2: 基础设施层

1. 实现配置管理（`src/config/`）：schema 定义、加载器、默认值

2. 实现 LLM Provider 抽象层（`src/llm/`）:Provider 接口、Anthropic 实现、OpenAI 实现、工厂方法

3. 实现 Prompt 管理（`src/prompts/`）：模板加载器、变量渲染引擎

4. 实现工具函数（`src/utils/`）：JSON 安全解析、重试逻辑、Token 计数、日志

5. 创建所有 Prompt 模板文件（参见 PROMPT_TEMPLATES.md）

6. 创建平台策略文件（`src/strategies/`）

### Phase 3: 核心引擎

1. 实现 PipelineContext（`src/core/context.ts`）：中间产物存储、持久化、恢复

2. 实现 PipelineStep 基类（`src/core/step.ts`）：执行、输出校验

3. 实现 Pipeline 执行引擎（`src/core/pipeline.ts`）：顺序执行、并行执行、步骤回调

4. 实现 Runner（`src/core/runner.ts`）：批量执行、并发控制

5. 实现存储层（`src/storage/`）：中间产物存储、运行记录管理

### Phase 4: 场景 A — 原创生成

1. 实现 Step 1: topic-analysis

2. 实现 Step 2: topic-assignment

3. 实现 Step 3: outline-generation（三个平台变体）

4. 实现 Step 5: content-generation（三个平台变体）

5. 实现 Step 6: review-optimization（三个平台变体）

6. 组装 Create Pipeline（`src/scenarios/create/index.ts`）

7. 跳过 Step 4 (material-search)，标记为 P1

### Phase 5: 场景 B — 爆款二创

1. 实现 Step 1: viral-deconstruction

2. 实现 Step 2: differentiation

3. 实现 Step 3: new-outline

4. 实现 Step 4: content-generation（含原文隔离逻辑）

5. 实现 Step 5: dual-review（含条件回环逻辑）

6. 组装 Recreate Pipeline（`src/scenarios/recreate/index.ts`）

### Phase 6: CLI 层

1. 实现 CLI 入口和命令注册（`src/cli/`）

2. 实现 `create` 命令

3. 实现 `recreate` 命令（含 `--direction auto|interactive` 选项）

4. 实现 `config` 命令

5. 实现 CLI UI 组件：spinner、进度显示、交互式选择

6. 实现 `src/index.ts` 入口文件

7. 配置 `tsup` 打包，确保 `npx contentforge` 可用

### Phase 7: 测试

1. 为核心引擎编写单元测试（Pipeline、Context、Step）

2. 为 JSON 安全解析编写单元测试

3. 为各步骤的输出 Schema 校验编写测试

4. 创建测试 fixtures（sample keyword output、sample viral article）

## 开发规范

### 代码风格

- 使用 TypeScript strict mode

- 所有函数和方法必须有 JSDoc 注释

- 所有 LLM 输出必须经过 zod schema 校验

- 错误处理遵循 TECH_SPEC.md 第 5 节的规范

- 使用 async/await，不使用 callback

### Prompt 模板规范

- 所有 prompt 模板存储为 `.md` 文件

- 模板变量使用 `{{variableName}}` 格式

- 条件块使用 `{{#if variableName}}...{{/if}}` 格式

- 每个步骤的 system prompt 和 user prompt 分开存储

### 输出格式规范

- 需要结构化输出的步骤，在 prompt 中明确要求 JSON 输出并提供 Schema

- 在 LLM 请求中启用 jsonMode（如果 provider 支持）

- 所有 JSON 输出必须经过安全解析（参见 TECH_SPEC.md 5.2 节）

### 平台策略文件

请为三个平台各创建一份详细的策略文件（Markdown 格式），内容包括：

- 平台用户画像

- 内容偏好和算法特征

- 最佳内容长度

- 标题写作规范

- 开头写作规范

- 互动引导最佳实践

- 敏感词/限流词清单（常见的）

- 发布时间建议

### 关键实现细节

1. **并行执行**：场景 A 的 Step 3-6 三个平台分支必须并行执行（使用 p-limit 控制并发）

2. **原文隔离**：场景 B 的 Step 3 和 Step 4 的 LLM 上下文中绝对不能包含原文全文，这是架构级的防抄袭设计。只有 Step 5（审查步骤）才能访问原文。

3. **条件回环**：场景 B 的 Step 5 如果发现原创度不达标，需要回到 Step 4 仅重写标记的段落，最多循环 3 次。

4. **JSON 安全解析**：LLM 输出的 JSON 经常不规范，解析器需要依次尝试：直接解析 → 提取代码块 → 正则提取 → 报错重试。

5. **中间产物持久化**：每一步执行完毕后，立即将结果写入磁盘（`output/{run_id}/`），确保断点可恢复。

## 验收标准

### 场景 A 验收

```bash
# 基本执行
npx contentforge create --keyword "AI"

# 应输出：
# 1. 执行过程中每一步的进度和耗时
# 2. 三篇文章的终稿（公众号/小红书/抖音）
# 3. 每篇文章的 5 个候选标题
# 4. 质量评分报告
# 5. Token 用量和预估成本
# 6. 所有中间产物保存在 output/ 目录
```

### 场景 B 验收

```bash
# 自动选择差异化方向
npx contentforge recreate --input ./sample-article.md

# 交互式选择差异化方向
npx contentforge recreate --input ./sample-article.md --direction interactive

# 应输出：
# 1. 爆款基因图谱
# 2. 差异化方向列表和选择结果
# 3. 二创终稿
# 4. 原创度报告
# 5. 爆款潜力评分（与原文对比）
# 6. Token 用量和预估成本
# 7. 所有中间产物保存在 output/ 目录
```

### 通用验收

```bash
# 查看配置
npx contentforge config --show

# 应正确加载并显示配置文件内容
```

## 注意事项

1. 先完成 Phase 1-3 的基础设施，确保架构稳固后再实现业务逻辑

2. 每个 Phase 完成后暂停，等待我确认后再继续下一个 Phase

3. 如果遇到 PRD 或技术规范中不明确的地方，请主动提问而不是自行假设

4. Prompt 模板是整个系统的核心资产，请认真对待每一个 prompt 的编写

5. 优先保证代码的可读性和可维护性，其次才是性能优化

## 环境变量示例

创建 `.env.example` 文件，内容如下：

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# 搜索 API Key（可选，用于素材检索步骤）
TAVILY_API_KEY=your_tavily_api_key_here
SERPER_API_KEY=your_serper_api_key_here
BING_API_KEY=your_bing_api_key_here

# 输出目录（可选，默认为 ./output）
OUTPUT_DIR=./output

# 日志级别（可选，默认为 info）
LOG_LEVEL=info
```

## package.json 脚本建议

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  }
}
```

## tsconfig.json 建议配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## 开始开发

请从 Phase 1 开始，完成项目脚手架搭建。完成后向我汇报进度，等待确认后再继续 Phase 2。
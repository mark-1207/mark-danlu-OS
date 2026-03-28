# 内容处理中枢（Prompt Router）设计文档

## 背景与目标

当前项目中的提示词模板散落在 `src/data/` 多个 TypeScript 文件中，通过人工约定的导出关系调用。这种方式存在以下问题：
- 新增提示词需要改多个文件
- 调用链路不透明，调试困难
- 提示词内容对用户不可见

**目标**：将提示词模板统一到文件系统，通过一个中枢程序自动加载和调度，实现：
- 模板集中管理（prompts/ 文件夹）
- 新增模板自动发现（重启后生效）
- 调用链路统一入口
- 支持同步/流式两种调用方式

---

## 目录结构

```
content-rewrite-workshop/
├── prompts/                          # 提示词模板根目录
│   ├── index.yaml                    # 可选，手动路由配置（覆盖自动扫描）
│   │
│   ├── analysis/                     # 内容分析
│   │   └── default.md               # 默认分析模板
│   │
│   ├── content/                      # 内容生成
│   │   ├── gzh-title.md             # 公众号标题
│   │   ├── gzh-content.md           # 公众号正文
│   │   ├── xhs-title.md             # 小红书标题
│   │   ├── xhs-content.md           # 小红书正文
│   │   ├── douyin-title.md          # 抖音标题
│   │   └── douyin-content.md        # 抖音正文
│   │
│   ├── quality/                     # 质检
│   │   ├── gzh-quality.md
│   │   ├── xhs-quality.md
│   │   └── douyin-quality.md
│   │
│   └── optimization/               # 优化
│       ├── gzh-optimization.md
│       ├── xhs-optimization.md
│       └── douyin-optimization.md
│
└── src/services/promptRouter.ts     # 中枢核心模块
```

---

## 模板文件格式

每个提示词模板为一个 Markdown 文件，包含 YAML frontmatter 和模板正文。

### frontmatter 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识，调用时使用 |
| `name` | string | 是 | 显示名称 |
| `type` | string | 否 | 类型标签，推荐值：`content-title`（标题生成）、`content-body`（正文生成）、`analysis`（内容分析）、`quality`（质检）、`optimization`（优化） |
| `platform` | string | 否 | 适用平台（gzh, xhs, douyin） |
| `variables` | string[] | 否 | 使用的变量列表，用于校验 |
| `system` | boolean | 否 | 是否为系统级提示词（默认 false） |

### 示例

```markdown
---
id: gzh-title
name: 公众号标题生成
type: content-title
platform: gzh
variables:
  - content
  - keywords
  - audience
---
你是一个公众号内容专家，请根据以下信息生成5个爆款标题：

【目标受众】{audience}
【关键词】{keywords}
【内容原文】{content}

要求：
1. 符合公众号平台风格
2. 包含痛点或共鸣点
3. 字数控制在13-25字
```

### 变量替换规则

- 模板中使用 `{变量名}` 作为占位符
- 调用时传入的 context 对象键名与变量名对应
- 未传入的变量替换为空字符串
- context 中存在但模板未声明的变量会被**静默忽略**（不会报错）

---

## 路由机制

### 自动扫描

Router 启动时自动扫描 `prompts/` 目录下所有 `.md` 文件：
1. 读取每个文件的 frontmatter，提取 `id`
2. 构建 `id → 文件路径` 的路由表
3. 如果 `prompts/index.yaml` 存在，以其为覆盖配置

### index.yaml 格式（可选）

```yaml
# 手动路由配置，可覆盖自动扫描结果
routes:
  - id: gzh-title
    path: content/gzh-title.md
    desc: 公众号标题生成

  - id: gzh-content
    path: content/gzh-content.md
    desc: 公众号正文生成

# 如果某 id 在这里定义了，使用这里定义的 path
# 否则使用自动扫描得到的 path
```

### 路由优先级

1. `index.yaml` 中定义的路由（最高优先级）
2. 自动扫描得到的路由

---

## Router 接口设计

### 模型选择逻辑

- 如果 `options.model` 指定了模型，直接使用
- 如果未指定，使用 settingsStore 中该供应商的第一个可用模型

### 核心方法

```typescript
// 初始化（应用启动时调用一次）
await promptRouter.init();

// 同步执行
async execute(
  templateId: string,                    // 模板 id
  context: Record<string, string>,       // 变量上下文
  options?: {
    systemPrompt?: string;                // 可选的系统提示词
    model?: string;                       // 可选指定模型
  }
): Promise<RouterResult>

// 流式执行
async executeStream(
  templateId: string,
  context: Record<string, string>,
  onChunk: (chunk: StreamingChunk) => void,
  options?: {
    systemPrompt?: string;
    model?: string;
  }
): Promise<StreamResult>
```

### 返回类型

```typescript
interface RouterResult {
  success: boolean;
  raw: string;                    // LLM 原始输出
  parsed: any | null;             // 如果是 JSON 则解析后的对象，否则 null
  usedTemplateId: string;          // 实际使用的模板 id
  usedModel: string;               // 实际使用的模型
  error?: string;                 // 错误信息
}

interface StreamingChunk {
  content: string;                // 增量内容
  done: boolean;                   // 是否结束
}

interface StreamResult {
  success: boolean;
  content: string;                 // 完整内容（流式结束后累加）
  usedTemplateId: string;
  usedModel: string;
  error?: string;
}
```

### 错误处理

| 错误情况 | 处理方式 |
|----------|----------|
| 模板 id 不存在 | 抛出 `Error: Template not found: xxx` |
| LLM 调用失败 | `RouterResult.success = false`，`error` 包含原因 |
| 流式调用失败 | 尝试降级到同步模式 |

---

## 与现有系统的迁移

### 迁移对应关系

| 原文件 (src/data/) | 新路径 (prompts/) |
|---|---|
| analysisPrompt.ts | analysis/default.md |
| gzhContentPrompt.ts | content/gzh-title.md + gzh-content.md |
| xhsContentPrompt.ts | content/xhs-title.md + xhs-content.md |
| douyinContentPrompt.ts | content/douyin-title.md + douyin-content.md |
| gzhQualityPrompt.ts | quality/gzh-quality.md |
| xhsQualityPrompt.ts | quality/xhs-quality.md |
| douyinQualityPrompt.ts | quality/douyin-quality.md |
| gzhOptimizationPrompt.ts | optimization/gzh-optimization.md |
| xhsOptimizationPrompt.ts | optimization/xhs-optimization.md |
| douyinOptimizationPrompt.ts | optimization/douyin-optimization.md |

### 迁移步骤

1. 创建 `prompts/` 目录结构
2. 将现有提示词内容迁移到对应 .md 文件
3. 实现 `promptRouter.ts`
4. 改造 `llmService.ts` 中的调用，改用 `promptRouter.execute()`
5. 改造各组件（ProModePanel、QuickModePanel 等）的 LLM 调用逻辑
6. 删除 `src/data/` 中的提示词文件

### UI 模板配置模块处理

**决定：删除 SettingsPage 中的模板配置模块**

- 用户如需修改模板，直接编辑 `prompts/` 下的 .md 文件
- 用户新增模板，添加到对应子文件夹后重启应用即可自动加载
- 不再通过 UI 管理模板配置

---

## 配置依赖

LLM 相关配置（供应商、API Key、模型等）继续使用现有的 `src/stores/settingsStore.ts`，Router 调用时自动引用。

---

## 文件清单

| 文件 | 作用 |
|------|------|
| `prompts/index.yaml` | 可选的手动路由配置 |
| `prompts/analysis/default.md` | 默认内容分析模板 |
| `prompts/content/*.md` | 各平台内容生成模板 |
| `prompts/quality/*.md` | 各平台质检模板 |
| `prompts/optimization/*.md` | 各平台优化模板 |
| `src/services/promptRouter.ts` | 中枢核心模块 |

---

## 后续优化方向（可选）

- [ ] 模板版本管理（同一 id 多个版本）
- [ ] 模板市场/导入导出
- [ ] 模板预览功能
- [ ] 模板使用统计

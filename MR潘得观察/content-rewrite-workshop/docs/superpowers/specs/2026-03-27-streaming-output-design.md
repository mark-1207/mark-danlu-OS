# 流式输出（Streaming）设计方案

## 1. 背景与目标

### 问题
- 相同提示词，官方网页端响应快（流式输出），项目 API 慢（阻塞式返回）
- 用户等待时间长，体验差
- 不知道 AI 还在"思考"，容易误以为卡死

### 目标
- 实现流式输出，内容逐字实时显示（打字机效果）
- 流式失败时自动降级到非流式模式
- 计时器从始至终累计计算

---

## 2. 核心设计

### 2.1 架构

```
LLMManager
├── chat()        → 非流式（已有）
└── chatStream()  → 流式 + 降级

LLMAdapter 接口
├── chat(config, provider) → Promise<LLMResponse>
└── chatStream(config, provider) → AsyncGenerator<string>
```

### 2.2 流式接口定义

```typescript
// types.ts 新增
export interface StreamingChunk {
  content: string;      // 当前片段内容
  done: boolean;        // 是否完成
  error?: string;       // 错误信息（如果失败）
}

export type StreamCallback = (chunk: StreamingChunk) => void;
```

### 2.3 适配器实现

| 适配器 | 流式实现 | 备注 |
|--------|----------|------|
| OpenAI | `stream: true` + SSE 解析 | 支持最完善 |
| Anthropic | `audeo: false` + SSE 解析 | 需解析 `delta` |
| Kimi/Moonshot | OpenAI 兼容格式 | 直接复用 |
| DeepSeek | OpenAI 兼容格式 | 直接复用 |
| MiniMax | 需验证 | 可能不支持流式 |
| Custom | 透传到 baseUrl | 由中转站决定 |

---

## 3. 实现方案

### 3.1 manager.ts

```typescript
// 新增流式方法
async chatStream(
  messages: Message[],
  providers: ProviderConfig[],
  failover: FailoverConfig,
  callback: StreamCallback,
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<void> {
  const availableProviders = providers.filter(p => p.isEnabled);
  if (availableProviders.length === 0) {
    throw new APIError('没有可用的 AI 供应商', 'none', undefined, false);
  }

  const sortedProviders = [...availableProviders].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });

  let lastError: APIError | null = null;

  for (const provider of sortedProviders) {
    try {
      const adapter = this.getAdapter(provider.provider);
      const config: LLMRequestConfig = {
        model: options.model || provider.model,
        messages,
        temperature: options.temperature ?? provider.temperature,
        maxTokens: options.maxTokens || provider.maxTokens,
        stream: true,
      };

      // 尝试流式
      for await (const chunk of adapter.chatStream(config, provider)) {
        callback(chunk);
      }
      return; // 成功完成

    } catch (error) {
      lastError = this.normalizeError(error, provider.name);

      // 不可重试错误 -> 切换供应商
      if (!lastError.isRetryable) {
        continue;
      }

      // 可重试错误 -> 立即切换供应商（快速失败策略）
      continue;
    }
  }

  // 所有供应商流式都失败
  throw lastError || new APIError('所有 AI 供应商流式调用都失败了', 'all', undefined, false);
}
```

### 3.2 降级策略

```typescript
async function callAIWithStreaming(
  messages: Message[],
  callback: StreamCallback,
  options: LLMServiceOptions = {}
): Promise<string> {
  let fullContent = '';
  const startTime = Date.now();

  try {
    // 尝试流式
    await llmManager.chatStream(
      messages,
      useSettingsStore.getState().ai.providers,
      useSettingsStore.getState().ai.failover,
      (chunk) => {
        if (chunk.error) {
          // 降级
          throw new Error(chunk.error);
        }
        fullContent += chunk.content;
        callback(chunk);
      },
      options
    );
    return fullContent;

  } catch (error) {
    // 流式失败，降级到非流式
    console.warn('流式调用失败，降级到非流式:', error);

    const response = await llmManager.chat(
      messages,
      useSettingsStore.getState().ai.providers,
      useSettingsStore.getState().ai.failover,
      options
    );

    // 模拟流式返回（逐字回调）
    for (const char of response.content) {
      fullContent += char;
      callback({ content: char, done: false });
      await sleep(10); // 模拟打字效果
    }
    callback({ content: '', done: true });

    return fullContent;
  }
}
```

### 3.3 计时器逻辑

```typescript
// 统一计时器
const startTime = Date.now();

const updateProgress = (progress: number, status: 'pending' | 'success' | 'error') => {
  const elapsed = Date.now() - startTime; // 累计时间
  options.onProgress?.(progress, status, { elapsed });
};
```

---

## 4. UI 集成

### 4.1 QuickModePanel

```typescript
const [displayText, setDisplayText] = useState('');

// 流式回调
const handleStreamChunk = (chunk: StreamingChunk) => {
  if (chunk.error) {
    setApiError(chunk.error);
    return;
  }

  if (chunk.done) {
    setIsGenerating(false);
    setGenerationComplete(true);
    return;
  }

  setDisplayText(prev => prev + chunk.content);
  // 更新进度
  const progress = calculateProgress(displayText.length);
  updateProgress(progress, 'pending');
};

// 生成内容
const handleGenerate = async () => {
  setDisplayText('');
  setIsGenerating(true);
  setGenerationSteps([
    { id: 1, label: '调用AI大模型', status: 'pending' },
    { id: 2, label: '流式接收内容', status: 'pending' },
    { id: 3, label: '实时渲染', status: 'pending' },
  ]);

  await callAIWithStreaming(messages, handleStreamChunk, { onProgress: updateProgress });
};
```

### 4.2 ProModePanel

每个平台独立流式接收，独立显示进度。

---

## 5. 兼容性考虑

### 5.1 不支持流式的供应商
- 某些中转站可能不支持 SSE
- 自动降级到非流式

### 5.2 Anthropic 流式差异
```typescript
// Anthropic 的 delta 格式
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你"}}
data: {"type":"content_block_stop","index":0}
```
需要适配器解析 `delta.text` 而不是 `choices[0].delta.content`

---

## 6. 测试计划

| 场景 | 预期 |
|------|------|
| OpenAI 流式正常 | 逐字显示，无卡顿 |
| Anthropic 流式正常 | 逐字显示，格式正确解析 |
| 流式失败降级 | 自动切换非流式，用户无感知 |
| 中转站不支持流式 | 直接降级非流式 |
| 网络超时 | 正确报错，提示用户检查网络 |

---

## 7. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/services/llm/types.ts` | 新增 StreamingChunk, StreamCallback |
| `src/services/llm/adapters.ts` | 每个适配器新增 chatStream() |
| `src/services/llm/manager.ts` | 新增 chatStream() + 降级逻辑 |
| `src/services/llm/llmService.ts` | 新增 callAIWithStreaming() |
| `src/components/QuickModePanel.tsx` | 集成流式回调 |
| `src/components/ProModePanel.tsx` | 集成流式回调 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 部分供应商不支持流式 | 降级机制完善 |
| 流式中断恢复困难 | 中断后整体重试 |
| UI 更新频率影响性能 | 使用 requestAnimationFrame 节流 |

---

*最后更新：2026-03-27*

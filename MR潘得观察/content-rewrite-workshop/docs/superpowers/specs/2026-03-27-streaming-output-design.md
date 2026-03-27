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
└── chatStream(config, provider) → AsyncGenerator<StreamingChunk>
```

### 2.2 流式接口定义

```typescript
// types.ts 新增
export interface StreamingChunk {
  content: string;      // 当前片段内容
  done: boolean;        // 是否完成
  usage?: {             // 完成时返回 usage 信息
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;       // 完成时返回实际使用的模型
}

export interface StreamError {
  message: string;
  isRetryable: boolean;
  retryAfterMs?: number;
}

export type StreamCallback = (chunk: StreamingChunk) => void;
```

### 2.3 适配器实现

| 适配器 | 流式实现 | 备注 |
|--------|----------|------|
| OpenAI | `stream: true` + SSE (fetch) | 使用 fetch API 接收流 |
| Anthropic | `stream: true` + SSE (fetch) | 同样使用 SSE 格式 |
| Kimi/Moonshot | OpenAI 兼容格式 | 直接复用 |
| DeepSeek | OpenAI 兼容格式 | 直接复用 |
| MiniMax | 需验证 | 可能不支持流式 |
| Custom | 透传到 baseUrl | 由中转站决定 |

**重要**：axios 不支持真正的 SSE 流式读取，必须改用 **fetch API**。

### 2.4 SSE 解析实现

#### OpenAI SSE 格式
```
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

#### Anthropic SSE 格式
```
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_stop
data: {"type":"message_stop"}
```

解析器实现：
```typescript
async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          return; // 完成
        }
        try {
          const parsed = JSON.parse(data);
          // OpenAI 格式
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }

      // Anthropic 事件格式 (event: xxx)
      if (line.startsWith('event: ')) {
        const eventType = line.slice(7);
        if (eventType === 'message_stop') {
          return; // 完成
        }
      }
    }
  }
}
```

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

      // 尝试流式，传入 callback
      await adapter.chatStream(config, provider, callback);
      return; // 成功完成

    } catch (error) {
      lastError = this.normalizeError(error, provider.name);

      // 如果 failover 关闭，只尝试一次
      if (!failover.enabled) {
        throw lastError;
      }

      // 不可重试错误 -> 切换供应商
      if (!lastError.isRetryable) {
        continue;
      }

      // 可重试错误 -> 立即切换供应商（快速失败策略）
      // 不在当前供应商重试，直接跳到下一个
      continue;
    }
  }

  // 所有供应商流式都失败
  throw lastError || new APIError('所有 AI 供应商流式调用都失败了', 'all', undefined, false);
}
```

### 3.2 适配器 chatStream 实现示例（OpenAI）

```typescript
// OpenAIAdapter 新增方法
async chatStream(
  config: LLMRequestConfig,
  providerConfig: ProviderConfig,
  callback: StreamCallback
): Promise<void> {
  const baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1';
  const controller = new AbortController();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${providerConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: config.messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new APIError(`HTTP ${response.status}`, 'OpenAI', response.status, response.status >= 500);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            callback({ content: '', done: true });
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              callback({ content, done: false });
            }
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callback({ content: '', done: true });
}
```

### 3.3 降级策略

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
        if (chunk.done) {
          // 流式完成
          return;
        }
        fullContent += chunk.content;
        callback(chunk);
      },
      options
    );

    callback({ content: '', done: true });
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

    // 降级模拟：批量回调，不逐字等待
    // 按句子或段落回调，体验更自然
    const BATCH_SIZE = 50; // 每批50字符
    let pos = 0;

    while (pos < response.content.length) {
      const batch = response.content.slice(pos, pos + BATCH_SIZE);
      fullContent += batch;
      callback({ content: batch, done: false });
      pos += BATCH_SIZE;

      // 小延迟让 UI 有时间更新，但不逐字等待
      await sleep(20);
    }

    callback({ content: '', done: true });
    return fullContent;
  }
}
```

### 3.4 计时器逻辑

```typescript
// 统一计时器 - 累计计算
const startTime = Date.now();

interface ProgressInfo {
  progress: number;
  status: 'pending' | 'success' | 'error';
  elapsed: number; // 累计毫秒数
}

const updateProgress = (progress: number, status: 'pending' | 'success' | 'error') => {
  const elapsed = Date.now() - startTime; // 始终累计
  options.onProgress?.(progress, status, { elapsed });
};
```

---

## 4. UI 集成

### 4.1 QuickModePanel

```typescript
// 状态
const [displayText, setDisplayText] = useState('');
const [isGenerating, setIsGenerating] = useState(false);

// 流式回调
const handleStreamChunk = (chunk: StreamingChunk) => {
  if (chunk.done) {
    setIsGenerating(false);
    return;
  }

  // 追加内容（使用函数式更新避免闭包问题）
  setDisplayText(prev => prev + chunk.content);
};

// 生成内容
const handleGenerate = async () => {
  setDisplayText('');
  setIsGenerating(true);

  await callAIWithStreaming(messages, handleStreamChunk, { onProgress: updateProgress });
};
```

**注意**：`displayText` 直接使用 `prev => prev + chunk.content` 追加，不依赖外部 `displayText` 变量。

### 4.2 进度估算

流式输出无法预知总长度，进度条改为以下策略：

```typescript
// 估算进度（基于字符数增长趋势）
const estimateProgress = (charCount: number, elapsedMs: number) => {
  // 初始阶段（前5秒）：进度条快速到30%
  if (elapsedMs < 5000) {
    return Math.min(30, (elapsedMs / 5000) * 30);
  }
  // 中期：基于字符数估算（假设平均每秒50字符）
  const estimatedTotal = (charCount / elapsedMs) * 30000; // 估算30秒总长
  if (estimatedTotal > 0) {
    return Math.min(90, (charCount / estimatedTotal) * 100);
  }
  return 50; // 默认50%
};
```

### 4.3 ProModePanel 多平台流式

每个平台独立状态：

```typescript
interface PlatformStreamState {
  displayText: string;
  isStreaming: boolean;
  error: string | null;
}

// 状态管理
const [platformStates, setPlatformStates] = useState<Record<string, PlatformStreamState>>({});

// 每个平台独立的回调
const createPlatformCallback = (platformId: string) => (chunk: StreamingChunk) => {
  setPlatformStates(prev => ({
    ...prev,
    [platformId]: {
      displayText: chunk.done ? prev[platformId].displayText :
        prev[platformId].displayText + chunk.content,
      isStreaming: !chunk.done,
      error: null,
    }
  }));
};
```

取消操作：使用 `AbortController` 取消流式请求。

---

## 5. 兼容性考虑

### 5.1 中转站 SSE 支持检测

```typescript
// 降级触发条件
async function detectStreamingSupport(provider: ProviderConfig): Promise<boolean> {
  try {
    // 发送一个很小的流式请求测试
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { /* ... */ },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
        stream: true,
      }),
    });

    // 检查 Content-Type 是否为 text/event-stream
    const contentType = response.headers.get('content-type');
    return contentType?.includes('text/event-stream') ?? false;
  } catch {
    return false;
  }
}
```

### 5.2 Anthropic SSE 额外事件处理

```typescript
// Anthropic 事件类型
type AnthropicEvent =
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop';

// 解析 Anthropic SSE
for (const line of lines) {
  if (line.startsWith('event: ')) {
    eventType = line.slice(7);
    continue;
  }
  if (line.startsWith('data: ')) {
    const data = JSON.parse(line.slice(6));
    if (eventType === 'content_block_delta' && data.delta?.text) {
      yield data.delta.text;
    }
    if (eventType === 'message_stop') {
      // 检查是否有 usage 信息
      if (data.usage) {
        yield { content: '', done: true, usage: data.usage };
      }
      return;
    }
  }
}
```

---

## 6. 测试计划

| 场景 | 预期 |
|------|------|
| OpenAI 流式正常 | 逐字显示，无卡顿 |
| Anthropic 流式正常 | 逐字显示，格式正确解析 |
| 流式失败降级 | 自动切换非流式，批量显示内容 |
| 中转站不支持流式 | 检测到后直接降级非流式 |
| 网络超时 | 正确报错，提示用户检查网络 |
| 多平台并行流式 | 各平台独立显示，互不影响 |

---

## 7. 涉及文件

| 文件 | 改动 |
|------|------|
| `src/services/llm/types.ts` | 新增 StreamingChunk, StreamError, StreamCallback |
| `src/services/llm/adapters.ts` | 每个适配器新增 chatStream()（使用 fetch） |
| `src/services/llm/manager.ts` | 新增 chatStream() + 降级逻辑 |
| `src/services/llm/llmService.ts` | 新增 callAIWithStreaming() |
| `src/components/QuickModePanel.tsx` | 集成流式回调 |
| `src/components/ProModePanel.tsx` | 集成流式回调 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| axios 不支持 SSE | 改用 fetch API |
| 中转站不支持流式 | 添加自动检测，降级到非流式 |
| 部分供应商流式失败 | 快速切换到下一个供应商 |
| UI 更新过频影响性能 | 使用 requestAnimationFrame 节流 |
| 流式中断丢失内容 | 降级后整体重试非流式 |

---

## 9. 已修复的审查问题

| 问题 | 修复方案 |
|------|----------|
| `audeo: false` 参数不存在 | 改为 `stream: true`，使用 fetch 接收 SSE |
| axios 不支持真正流式 | 适配器改用 fetch API + ReadableStream |
| 降级打字效果太慢 | 改为批量回调（50字符/批），20ms 延迟 |
| 缺少进度计算逻辑 | 添加基于时间和字符数估算的进度 |
| Anthropic 事件格式遗漏 | 添加 `event:` 前缀解析和 `message_stop` 处理 |
| `failover.enabled` 未检查 | 添加 `if (!failover.enabled) throw lastError` |
| 多平台并行流式状态管理 | 每个平台独立 state 和 callback |

---

*最后更新：2026-03-27*

import axios from 'axios';
import type {
  ProviderConfig,
  LLMRequestConfig,
  LLMResponse,
} from './types';

import type { StreamCallback } from './types';

/**
 * LLM 供应商适配器接口
 */
export interface LLMAdapter {
  /** 供应商名称 */
  name: string;
  /** 调用 API */
  chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse>;
  /** 流式调用 */
  chatStream(config: LLMRequestConfig, providerConfig: ProviderConfig, callback: StreamCallback): Promise<void>;
  /** 测试连接 */
  testConnection(providerConfig: ProviderConfig): Promise<boolean>;
}

/**
 * OpenAI 适配器
 */
export class OpenAIAdapter implements LLMAdapter {
  name = 'OpenAI';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1';

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: config.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: config.stream ?? false,
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    const baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1';

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
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callback({ content: '', done: true });
  }

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1';
      await axios.get(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Anthropic (Claude) 适配器
 */
export class AnthropicAdapter implements LLMAdapter {
  name = 'Anthropic';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    // 将消息转换为 Anthropic 格式
    const systemMessage = config.messages.find(m => m.role === 'system');
    const userMessages = config.messages.filter(m => m.role !== 'system');

    const baseUrl = providerConfig.baseUrl || 'https://api.anthropic.com/v1';

    const response = await axios.post(
      `${baseUrl}/messages`,
      {
        model: config.model,
        max_tokens: config.maxTokens || 1024,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: config.temperature ?? 0.7,
      },
      {
        headers: {
          'x-api-key': providerConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 content 是否存在
    const contentItem = response.data?.content?.[0];
    if (!contentItem || contentItem.type !== 'text') {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = contentItem.text || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.input_tokens || 0,
        completionTokens: response.data.usage?.output_tokens || 0,
        totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0),
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    const systemMessage = config.messages.find(m => m.role === 'system');
    const userMessages = config.messages.filter(m => m.role !== 'system');

    const baseUrl = providerConfig.baseUrl || 'https://api.anthropic.com/v1';

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': providerConfig.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens || 1024,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: config.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Anthropic 使用 event: 前缀
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
            continue;
          }
          // 数据行
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              // content_block_delta 事件
              if (eventType === 'content_block_delta' && parsed.delta?.text) {
                callback({ content: parsed.delta.text, done: false });
              }

              // message_stop 事件 - 完成
              if (eventType === 'message_stop') {
                callback({
                  content: '',
                  done: true,
                  usage: parsed.usage ? {
                    promptTokens: parsed.usage.input_tokens || 0,
                    completionTokens: parsed.usage.output_tokens || 0,
                    totalTokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
                  } : undefined,
                  model: parsed.model,
                });
                return;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    callback({ content: '', done: true });
  }

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: providerConfig.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        {
          headers: {
            'x-api-key': providerConfig.apiKey,
            'anthropic-version': '2023-06-01',
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * MiniMax 适配器
 */
export class MiniMaxAdapter implements LLMAdapter {
  name = 'MiniMax';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = providerConfig.baseUrl || 'https://api.minimax.chat/v1';

    const response = await axios.post(
      `${baseUrl}/text/chatcompletion_v2`,
      {
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    // MiniMax 使用不同的 API 端点
    const baseUrl = providerConfig.baseUrl || 'https://api.minimax.chat/v1';

    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://api.minimax.chat/v1';
      await axios.post(
        `${baseUrl}/text/chatcompletion_v2`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Kimi (月之暗面) 适配器
 */
export class KimiAdapter implements LLMAdapter {
  name = 'Kimi';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = providerConfig.baseUrl || 'https://api.moonshot.cn/v1';

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    const baseUrl = providerConfig.baseUrl || 'https://api.moonshot.cn/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://api.moonshot.cn/v1';
      await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 火山引擎 Ark 适配器
 */
export class ArkAdapter implements LLMAdapter {
  name = 'Ark';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com';

    // 将 messages 转换为 Ark 格式
    const messages = config.messages.map((msg) => {
      // 处理文本内容
      const content = typeof msg.content === 'string' ? msg.content : String(msg.content);

      return {
        role: msg.role,
        content,
      };
    });

    const requestBody: any = {
      model: providerConfig.model,
      messages,
      temperature: config.temperature ?? 0.7,
    };

    if (config.maxTokens) {
      requestBody.max_tokens = config.maxTokens;
    }

    const response = await axios.post(
      `${baseUrl}/api/v3/chat/completions`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    const baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com';

    const messages = config.messages.map((msg) => {
      const content = typeof msg.content === 'string' ? msg.content : String(msg.content);
      return { role: msg.role, content };
    });

    const response = await fetch(`${baseUrl}/api/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com';
      await axios.post(
        `${baseUrl}/api/v3/chat/completions`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * DeepSeek 适配器
 */
export class DeepSeekAdapter implements LLMAdapter {
  name = 'DeepSeek';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = providerConfig.baseUrl || 'https://api.deepseek.com/v1';

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    const baseUrl = providerConfig.baseUrl || 'https://api.deepseek.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://api.deepseek.com/v1';
      await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 自定义/中转站适配器
 */
export class CustomAdapter implements LLMAdapter {
  name = 'Custom';

  async chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse> {
    if (!providerConfig.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }

    const response = await axios.post(
      `${providerConfig.baseUrl}/chat/completions`,
      {
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时
      }
    );

    // 防御性处理：检查 choices 是否存在
    const choice = response.data?.choices?.[0];
    if (!choice) {
      throw new Error('API返回为空，未收到有效响应');
    }

    const content = choice?.message?.content || '';
    if (!content) {
      throw new Error('API返回内容为空');
    }

    return {
      content,
      usage: {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      },
      model: response.data.model || config.model,
    };
  }

  async chatStream(
    config: LLMRequestConfig,
    providerConfig: ProviderConfig,
    callback: StreamCallback
  ): Promise<void> {
    if (!providerConfig.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }

    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: config.messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      if (!providerConfig.baseUrl) {
        return false;
      }
      await axios.post(
        `${providerConfig.baseUrl}/chat/completions`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 适配器工厂
 */
export function createAdapter(provider: string): LLMAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'minimax':
      return new MiniMaxAdapter();
    case 'kimi':
      return new KimiAdapter();
    case 'deepseek':
      return new DeepSeekAdapter();
    case 'ark':
      return new ArkAdapter();
    case 'custom':
      return new CustomAdapter();
    default:
      // 默认尝试作为 OpenAI 兼容接口
      return new OpenAIAdapter();
  }
}

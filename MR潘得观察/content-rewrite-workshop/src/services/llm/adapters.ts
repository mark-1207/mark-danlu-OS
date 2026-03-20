import axios from 'axios';
import type {
  ProviderConfig,
  LLMRequestConfig,
  LLMResponse,
} from './types';

/**
 * LLM 供应商适配器接口
 */
export interface LLMAdapter {
  /** 供应商名称 */
  name: string;
  /** 调用 API */
  chat(config: LLMRequestConfig, providerConfig: ProviderConfig): Promise<LLMResponse>;
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

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
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

  async testConnection(providerConfig: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com';
      await axios.post(
        `${baseUrl}/api/v3/chat/completions`,
        {
          model: providerConfig.model,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
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

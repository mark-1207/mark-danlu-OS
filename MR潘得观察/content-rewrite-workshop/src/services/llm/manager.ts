import { createAdapter, type LLMAdapter } from './adapters';
import type {
  ProviderConfig,
  FailoverConfig,
  Message,
  LLMRequestConfig,
  LLMResponse,
} from './types';

/**
 * API 错误类型
 */
export class APIError extends Error {
  provider: string;
  statusCode?: number;
  isRetryable: boolean;

  constructor(
    message: string,
    provider: string,
    statusCode?: number,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

/**
 * LLM 管理器
 * 负责供应商选择、自动切换、错误处理
 */
export class LLMManager {
  private adapters: Map<string, LLMAdapter> = new Map();

  constructor() {
    // 预创建常用适配器
    this.adapters.set('openai', createAdapter('openai'));
    this.adapters.set('anthropic', createAdapter('anthropic'));
    this.adapters.set('minimax', createAdapter('minimax'));
    this.adapters.set('kimi', createAdapter('kimi'));
    this.adapters.set('deepseek', createAdapter('deepseek'));
    this.adapters.set('ark', createAdapter('ark'));
    this.adapters.set('custom', createAdapter('custom'));
  }

  /**
   * 获取适配器
   */
  private getAdapter(provider: string): LLMAdapter {
    let adapter = this.adapters.get(provider);
    if (!adapter) {
      adapter = createAdapter(provider);
      this.adapters.set(provider, adapter);
    }
    return adapter;
  }

  /**
   * 调用 LLM，支持自动切换
   */
  async chat(
    messages: Message[],
    providers: ProviderConfig[],
    failover: FailoverConfig,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<LLMResponse & { provider: string }> {
    // 过滤出可用的供应商
    const availableProviders = providers.filter(p => p.isEnabled);

    if (availableProviders.length === 0) {
      throw new APIError('没有可用的 AI 供应商', 'none', undefined, false);
    }

    // 按优先级排序：主供应商优先，然后是备用
    const sortedProviders = [...availableProviders].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return 0;
    });

    // 尝试每个供应商
    let lastError: APIError | null = null;

    for (const provider of sortedProviders) {
      // 重试逻辑
      let retries = 0;

      while (retries <= failover.maxRetries) {
        try {
          const config: LLMRequestConfig = {
            model: options.model || provider.model,
            messages,
            temperature: options.temperature ?? provider.temperature,
            maxTokens: options.maxTokens || provider.maxTokens,
          };

          const adapter = this.getAdapter(provider.provider);
          const response = await adapter.chat(config, provider);

          return {
            ...response,
            provider: provider.name,
          };
        } catch (error) {
          retries++;
          lastError = this.normalizeError(error, provider.name);

          // 如果是不可重试的错误，直接抛出
          if (!lastError.isRetryable) {
            if (!failover.enabled) {
              throw lastError;
            }
            break;
          }

          // 如果还有重试次数，等待后重试
          if (retries <= failover.maxRetries) {
            await this.sleep(failover.retryDelay);
          }
        }
      }

      // 如果关闭了自动切换，并且出错了，抛出错误
      if (!failover.enabled && lastError) {
        throw lastError;
      }
    }

    // 所有供应商都失败了
    throw lastError || new APIError('所有 AI 供应商都失败了', 'all', undefined, false);
  }

  /**
   * 测试供应商连接
   */
  async testConnection(provider: ProviderConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const adapter = this.getAdapter(provider.provider);
      const success = await adapter.testConnection(provider);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: unknown, providerName: string): APIError {
    if (error instanceof APIError) {
      return error;
    }

    if (error instanceof Error) {
      // axios 错误
      if ('response' in error) {
        const axiosError = error as any;
        const statusCode = axiosError.response?.status;

        // 常见可重试的状态码
        const retryableCodes = [429, 500, 502, 503, 504];
        const isRetryable = retryableCodes.includes(statusCode) ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED');

        // 额度用完
        if (statusCode === 401 || statusCode === 403) {
          return new APIError(
            'API 密钥无效或额度已用完',
            providerName,
            statusCode,
            false // 不可重试
          );
        }

        return new APIError(
          error.message,
          providerName,
          statusCode,
          isRetryable
        );
      }

      // 网络错误
      return new APIError(
        error.message,
        providerName,
        undefined,
        true // 可重试
      );
    }

    return new APIError(
      'Unknown error',
      providerName,
      undefined,
      false
    );
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
export const llmManager = new LLMManager();

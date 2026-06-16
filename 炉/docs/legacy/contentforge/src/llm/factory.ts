import type { LLMProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { KimiProvider } from './kimi.js';
import { logger } from '../utils/logger.js';

export type ProviderType = 'anthropic' | 'openai' | 'kimi';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
}

/**
 * Factory to create LLM provider instances.
 */
export class LLMProviderFactory {
  private providers = new Map<string, { config: ProviderConfig; instance: LLMProvider }>();

  /**
   * Register a named provider configuration.
   */
  register(name: string, config: ProviderConfig): void {
    const apiKey = config.apiKey ?? this.getEnvApiKey(config.type);
    const baseUrl = config.baseUrl ?? this.getEnvBaseUrl(config.type);

    if (!apiKey) {
      logger.warn(`Skipping provider '${name}': missing API key. Set ${this.getEnvKeyName(config.type)} to enable.`);
      return;
    }

    const instance = this.createProvider(config.type, apiKey, baseUrl);
    this.providers.set(name, { config, instance });
    logger.info(`Registered LLM provider '${name}' (${config.type}, model: ${config.defaultModel}, baseUrl: ${baseUrl ?? 'default'})`);
  }

  /**
   * Get a registered provider instance.
   */
  get(name: string): LLMProvider {
    const entry = this.providers.get(name);
    if (!entry) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(`Provider '${name}' not found. Available: ${available || 'none'}`);
    }
    return entry.instance;
  }

  /**
   * Get provider config (without API key).
   */
  getConfig(name: string): ProviderConfig {
    const entry = this.providers.get(name);
    if (!entry) {
      throw new Error(`Provider '${name}' not found`);
    }
    return entry.config;
  }

  private createProvider(type: ProviderType, apiKey: string, baseUrl?: string): LLMProvider {
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey, baseUrl);
      case 'kimi':
        return new KimiProvider(apiKey, baseUrl);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  private getEnvApiKey(type: ProviderType): string | undefined {
    switch (type) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'kimi':
        return process.env.KIMI_API_KEY;
      default:
        return undefined;
    }
  }

  private getEnvKeyName(type: ProviderType): string {
    switch (type) {
      case 'anthropic':
        return 'ANTHROPIC_API_KEY';
      case 'openai':
        return 'OPENAI_API_KEY';
      case 'kimi':
        return 'KIMI_API_KEY';
      default:
        return 'API_KEY';
    }
  }

  private getEnvBaseUrl(type: ProviderType): string | undefined {
    switch (type) {
      case 'kimi':
        return process.env.KIMI_BASE_URL;
      case 'openai':
        return process.env.OPENAI_BASE_URL;
      default:
        return undefined;
    }
  }
}

/** Global factory instance */
export const llmFactory = new LLMProviderFactory();

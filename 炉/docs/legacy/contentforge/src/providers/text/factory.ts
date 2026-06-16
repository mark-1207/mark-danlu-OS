import { llmFactory } from '../../llm/factory.js';
import { TextLLMRotationRouter } from './router.js';

export type TextProviderName = 'anthropic' | 'openai' | 'kimi' | 'gemini';

export class TextLLMFactory {
  /**
   * Register Google Gemini as a named provider.
   * Uses OpenAI-compatible endpoint with custom baseUrl.
   */
  registerGemini(name: string, apiKey: string, defaultModel = 'gemini-2.0-flash'): void {
    llmFactory.register(name, {
      type: 'openai',
      apiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      defaultModel,
    });
  }

  createRotationRouter(providerNames: string[]): TextLLMRotationRouter {
    return new TextLLMRotationRouter(providerNames);
  }
}

export const textLLMFactory = new TextLLMFactory();

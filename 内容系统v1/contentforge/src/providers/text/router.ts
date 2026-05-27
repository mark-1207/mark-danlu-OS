import type { LLMProvider, LLMRequestOptions, LLMResponse } from '../../llm/types.js';
import { llmFactory } from '../../llm/factory.js';
import { logger } from '../../utils/logger.js';

export class TextLLMRotationRouter implements LLMProvider {
  name = 'rotation-router';

  private errorCounts = new Map<string, number>();
  private currentIndex = 0;
  private providers: string[];

  constructor(
    private providerNames: string[],
    private maxErrorsPerProvider = 3,
  ) {
    this.providers = [...providerNames];
  }

  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    const errors: string[] = [];

    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const idx = (this.currentIndex + attempt) % this.providers.length;
      const name = this.providers[idx];

      try {
        const provider = llmFactory.get(name);
        const response = await provider.chat(options);
        this.errorCounts.set(name, 0);
        this.currentIndex = (idx + 1) % this.providers.length;
        return response;
      } catch (err) {
        const errStr = String(err);
        errors.push(`${name}: ${errStr}`);
        const count = (this.errorCounts.get(name) ?? 0) + 1;
        this.errorCounts.set(name, count);

        if (count >= this.maxErrorsPerProvider) {
          logger.warn(`Provider '${name}' exceeded error threshold (${count}), removing from rotation`);
          this.providers = this.providers.filter(p => p !== name);
          if (this.providers.length === 0) break;
        }

        if (this.isHttpError(err)) {
          this.currentIndex = (idx + 1) % this.providers.length;
        }
      }
    }

    throw new Error(`All text LLM providers failed: ${errors.join(' | ')}`);
  }

  private isHttpError(err: unknown): boolean {
    const status = (err as Record<string, unknown>)['status']
      ?? (err as Record<string, unknown>)['statusCode']
      ?? (err as { response?: { status?: number } })['response']?.status;
    return typeof status === 'number' && status >= 400;
  }
}

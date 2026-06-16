import type { EmbeddingProvider, EmbeddingOptions, EmbeddingResult } from './types.js';
import { embeddingCache } from './cache.js';
import { logger } from '../../utils/logger.js';

export class EmbeddingRouter {
  constructor(
    private primary: EmbeddingProvider,
    private fallback: EmbeddingProvider,
  ) {}

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const cached = embeddingCache.get(options.text);
    if (cached) return cached;

    try {
      const result = await this.primary.embed(options);
      embeddingCache.set(options.text, result);
      return result;
    } catch (primaryErr) {
      logger.warn(`Primary embedding '${this.primary.name}' failed: ${primaryErr}, falling back to '${this.fallback.name}'`);
      const result = await this.fallback.embed(options);
      embeddingCache.set(options.text, result);
      return result;
    }
  }
}

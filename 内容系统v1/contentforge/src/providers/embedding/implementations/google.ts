import type { EmbeddingProvider, EmbeddingOptions, EmbeddingResult } from '../types.js';
import { withRetry } from '../../../utils/retry.js';

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  name = 'google-embedding';

  constructor(private apiKey: string) {}

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    return withRetry(async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/embed?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: [options.text],
            model: options.model ?? 'text-embedding-004',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Embedding API error: ${response.status}`);
      }

      const data = await response.json() as {
        embeddings: Array<{ value: number[]; statistics: { tokenCount: number } }>;
      };
      return {
        embedding: data.embeddings[0].value,
        tokens: data.embeddings[0].statistics.tokenCount,
      };
    }, {}, 'GoogleEmbedding embed()');
  }
}

import type { EmbeddingProvider, EmbeddingOptions, EmbeddingResult } from '../types.js';
import { withRetry } from '../../../utils/retry.js';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';

  constructor(private apiKey: string) {}

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    return withRetry(async () => {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: options.text }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI embeddings error ${response.status}: ${err}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
      };
      return { embedding: data.data[0].embedding, tokens: data.usage.total_tokens };
    }, {}, 'OpenAIEmbedding embed()');
  }
}
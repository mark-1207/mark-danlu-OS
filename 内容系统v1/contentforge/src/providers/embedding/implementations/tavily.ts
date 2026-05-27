import type { EmbeddingProvider, EmbeddingOptions, EmbeddingResult } from '../types.js';
import { withRetry } from '../../../utils/retry.js';

export class TavilyEmbeddingProvider implements EmbeddingProvider {
  name = 'tavily';

  constructor(private apiKey: string) {}

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    return withRetry(async () => {
      const response = await fetch('https://api.tavily.com/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [options.text] }),
      });

      if (!response.ok) {
        throw new Error(`Tavily embeddings API error: ${response.status}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; tokens: number }>;
      };
      return { embedding: data.data[0].embedding, tokens: data.data[0].tokens };
    }, {}, 'TavilyEmbedding embed()');
  }
}

import type { EmbeddingProvider, EmbeddingOptions, EmbeddingResult } from '../types.js';
import { withRetry } from '../../../utils/retry.js';

export class ZhipuEmbeddingProvider implements EmbeddingProvider {
  name = 'zhipu';
  private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
  private model = 'embedding-3';

  constructor(private apiKey: string) {}

  async embed(options: EmbeddingOptions): Promise<EmbeddingResult> {
    return withRetry(async () => {
      const text = options.text.length > 8000 ? options.text.slice(0, 8000) : options.text;
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        const error = new Error(`Zhipu embeddings error ${response.status}: ${err}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
      };
      return { embedding: data.data[0].embedding, tokens: data.usage.total_tokens };
    }, {}, 'ZhipuEmbedding embed()');
  }
}
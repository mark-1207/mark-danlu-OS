import { getCachedConfig } from '../config/loader.js';
import { logger } from './logger.js';

export interface EmbeddingOptions {
  text: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

/**
 * Compute embedding using Tavily API (same API key as search)
 * API: POST https://api.tavily.com/embeddings
 * Body: { texts: string[] }
 * Response: { data: [{ embedding: number[], tokens: number }] }
 */
export async function computeEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const config = getCachedConfig();
  const apiKey = config.search?.apiKey ?? process.env.TAVILY_API_KEY ?? '';
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const response = await fetch('https://api.tavily.com/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [options.text] }),
  });

  if (!response.ok) {
    throw new Error(`Tavily embeddings API error: ${response.status}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[]; tokens: number }> };
  return { embedding: data.data[0].embedding, tokens: data.data[0].tokens };
}

/**
 * Compute cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const SIMILARITY_THRESHOLD = 0.85;

export interface SimilarityCheckItem {
  id: string;
  originalText: string;
  recreationText: string;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  flagged: boolean;
  originalText: string;
  recreationText: string;
}

/**
 * Check embedding similarity for a list of case/data items.
 * Flags items where cosine similarity > SIMILARITY_THRESHOLD.
 */
export async function checkSimilarity(
  items: SimilarityCheckItem[],
): Promise<SimilarityResult[]> {
  if (items.length === 0) return [];

  const results: SimilarityResult[] = [];

  for (const item of items) {
    try {
      const [origEmb, recrEmb] = await Promise.all([
        computeEmbedding({ text: item.originalText }),
        computeEmbedding({ text: item.recreationText }),
      ]);

      const similarity = cosineSimilarity(origEmb.embedding, recrEmb.embedding);
      results.push({
        id: item.id,
        similarity,
        flagged: similarity > SIMILARITY_THRESHOLD,
        originalText: item.originalText,
        recreationText: item.recreationText,
      });
    } catch (err) {
      logger.warn(`[embedding] similarity check failed for ${item.id}:`, String(err));
      results.push({
        id: item.id,
        similarity: 0,
        flagged: false,
        originalText: item.originalText,
        recreationText: item.recreationText,
      });
    }
  }

  return results;
}
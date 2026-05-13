export type { EmbeddingOptions, EmbeddingResult } from '../providers/embedding/types.js';
import { getEmbeddingRouter } from '../providers/embedding/factory.js';
import { logger } from './logger.js';

/**
 * Compute embedding with automatic primary → fallback routing.
 * Primary: Tavily
 * Fallback: Google (text-embedding-004)
 * Results are cached in-memory to avoid recomputing the same text.
 */
export async function computeEmbedding(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const router = getEmbeddingRouter();
  return router.embed(options);
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

export const SIMILARITY_THRESHOLD = 0.80;

export interface SimilarityCheckItem {
  id: string;
  originalText: string;
  matchedText: string;
  elementType?: 'caseStudy' | 'keyDataPoint' | 'goldQuote';
}

export interface SimilarityResult {
  id: string;
  elementType?: 'caseStudy' | 'keyDataPoint' | 'goldQuote';
  similarity: number;
  flagged: boolean;
  originalText: string;
  matchedText: string;
  paragraphIndex?: number;
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
        computeEmbedding({ text: item.matchedText }),
      ]);

      const similarity = cosineSimilarity(origEmb.embedding, recrEmb.embedding);
      results.push({
        id: item.id,
        similarity,
        flagged: similarity > SIMILARITY_THRESHOLD,
        originalText: item.originalText,
        matchedText: item.matchedText,
      });
    } catch (err) {
      logger.warn(`[embedding] similarity check failed for ${item.id}:`, String(err));
      results.push({
        id: item.id,
        similarity: 0,
        flagged: false,
        originalText: item.originalText,
        matchedText: item.matchedText,
      });
    }
  }

  return results;
}
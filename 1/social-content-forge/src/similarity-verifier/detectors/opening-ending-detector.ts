import type { DimensionResult } from '../../types';

/**
 * Extract opening (first paragraph) and ending (last paragraph) from text
 */
function extractOpeningEnding(text: string): { opening: string; ending: string } {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);
  const opening = paragraphs[0] || '';
  const ending = paragraphs[paragraphs.length - 1] || '';
  return { opening, ending };
}

/**
 * Simple word overlap ratio between two texts
 */
function wordOverlapRatio(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 1));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 1));
  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  return overlap / words1.size;
}

/**
 * Detect difference in opening and ending sections
 * Returns score: % difference (higher = more different = better)
 */
export function detectOpeningEndingDifference(
  originalText: string,
  rewrittenText: string
): DimensionResult {
  const orig = extractOpeningEnding(originalText);
  const rew = extractOpeningEnding(rewrittenText);

  // Calculate overlap for opening
  const openingOverlap = wordOverlapRatio(orig.opening, rew.opening);
  // Calculate overlap for ending
  const endingOverlap = wordOverlapRatio(orig.ending, rew.ending);

  // Combined: 50% opening overlap + 50% ending overlap (unweighted average)
  const combinedSimilarity = openingOverlap * 0.5 + endingOverlap * 0.5;
  const score = Math.round((1 - combinedSimilarity) * 100);
  const passed = score >= 50;

  return {
    score,
    passed,
    detail: `开头差异${Math.round((1-openingOverlap)*100)}%, 结尾差异${Math.round((1-endingOverlap)*100)}%`,
  };
}

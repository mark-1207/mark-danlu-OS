import type { DimensionResult } from '../types';

const QUOTE_MIN_LENGTH = 15; // 连续15字以上判定为照搬（但先提取10字以上的引号）

/**
 * Detect quote copying between original and rewritten
 * Returns score: % of original quotes copied (>15 chars) in rewritten
 */
export function detectQuoteSimilarity(
  originalText: string,
  rewrittenText: string
): DimensionResult {
  // Extract quoted passages from original (双引号、单引号、原文中用引号标出的内容)
  const quoteRegex = /[""]([^""]{10,})[""]/g;
  const originalQuotes: string[] = [];
  let match;
  while ((match = quoteRegex.exec(originalText)) !== null) {
    originalQuotes.push(match[1].trim());
  }

  if (originalQuotes.length === 0) {
    return { score: 0, passed: true, detail: '原文无引号内容' };
  }

  // Count how many original quotes appear in rewritten (as substring)
  let copiedCount = 0;
  const copiedDetails: string[] = [];

  for (const quote of originalQuotes) {
    if (quote.length >= QUOTE_MIN_LENGTH && rewrittenText.includes(quote)) {
      copiedCount++;
      if (copiedDetails.length < 3) {
        copiedDetails.push(`"${quote.slice(0, 20)}..."`);
      }
    }
  }

  const score = Math.round((copiedCount / originalQuotes.length) * 100);
  const passed = score <= 15;

  return {
    score,
    passed,
    detail: copiedDetails.length > 0
      ? `检测到${copiedCount}处照搬: ${copiedDetails.join(', ')}`
      : '无照搬',
  };
}

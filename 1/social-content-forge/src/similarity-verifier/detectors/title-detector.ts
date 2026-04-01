import type { DimensionResult } from '../../types';

/**
 * Calculate title difference using simple character-level diff
 * Returns score: % difference (higher = more different = better)
 */
export function detectTitleDifference(
  originalTitle: string,
  rewrittenTitle: string
): DimensionResult {
  if (!originalTitle || !rewrittenTitle) {
    return { score: 0, passed: false, detail: '标题缺失' };
  }

  // Calculate Levenshtein distance
  const len1 = originalTitle.length;
  const len2 = rewrittenTitle.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) {
    return { score: 100, passed: true, detail: '两标题均为空' };
  }

  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (originalTitle[i - 1] === rewrittenTitle[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const distance = dp[len1][len2];
  const score = Math.round((distance / maxLen) * 100);
  const passed = score >= 60;

  return {
    score,
    passed,
    detail: `差异度${score}%, 原:"${originalTitle.slice(0, 15)}" vs 改:"${rewrittenTitle.slice(0, 15)}"`,
  };
}

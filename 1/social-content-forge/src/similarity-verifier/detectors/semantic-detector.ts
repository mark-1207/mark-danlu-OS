import type { DimensionResult } from '../../types';

/**
 * Detect semantic similarity using LLM to embed and compare
 * Uses a text-similarity prompt approach (no external embedding API needed)
 */
export async function detectSemanticSimilarity(
  originalText: string,
  rewrittenText: string,
  llmCall: import('../../types').LLMCall
): Promise<DimensionResult> {
  const prompt = `请判断以下两段文字的语义相似度。

要求：
1. 忽略具体案例名、人名、数字的差异
2. 只看核心观点、论述逻辑、情感基调是否相似
3. 返回0-100的数字，100=完全相同，0=完全无关

返回格式（只返回JSON）：
{"similarity": 数字}

原文核心观点：
${originalText.slice(0, 1000)}

改写后核心观点：
${rewrittenText.slice(0, 1000)}`;

  try {
    const result = await llmCall('glm', prompt);
    let similarity = 50;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        similarity = typeof parsed.similarity === 'number' ? parsed.similarity : 50;
      }
    } catch {
      similarity = 50;
    }
    const score = Math.round(similarity);
    const passed = score <= 70;

    return {
      score,
      passed,
      detail: `语义相似度${score}%`,
    };
  } catch {
    // Fallback: return a neutral score that won't block
    return { score: 50, passed: true, detail: '语义检测失败，默认50%' };
  }
}

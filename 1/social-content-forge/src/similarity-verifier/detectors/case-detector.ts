import type { DimensionResult, LLMCall } from '../../types';

/**
 * Extract named entities (people, companies, products, events) from text
 * Uses LLM for NER-like extraction
 */
async function extractEntities(text: string, llmCall: LLMCall): Promise<string[]> {
  const prompt = `从以下文本中提取所有具体实体：人名、公司名，品牌名、产品名、活动名、数字统计（如"2.3亿"）。

只返回实体列表，每行一个，不要解释。如果无实体，返回"无"。

文本：
${text.slice(0, 2000)}`;

  try {
    const result = await llmCall('glm', prompt);
    const lines = result.split('\n').filter(l => l.trim() && l.trim() !== '无');
    return lines.map(l => l.trim());
  } catch {
    return [];
  }
}

/**
 * Calculate entity overlap between original and rewritten
 * Returns score: % of original entities that appear in rewritten
 */
export async function detectCaseSimilarity(
  originalText: string,
  rewrittenText: string,
  llmCall: LLMCall
): Promise<DimensionResult> {
  const [origEntities, rewEntities] = await Promise.all([
    extractEntities(originalText, llmCall),
    extractEntities(rewrittenText, llmCall),
  ]);

  if (origEntities.length === 0) {
    return { score: 0, passed: true, detail: '原文无实体案例' };
  }

  // Count how many original entities appear in rewritten (case-insensitive)
  const rewLower = rewrittenText.toLowerCase();
  let overlapCount = 0;
  const overlappedEntities: string[] = [];

  for (const entity of origEntities) {
    if (rewLower.includes(entity.toLowerCase())) {
      overlapCount++;
      if (overlappedEntities.length < 5) {
        overlappedEntities.push(entity);
      }
    }
  }

  const score = Math.round((overlapCount / origEntities.length) * 100);
  const passed = score <= 20;

  return {
    score,
    passed,
    detail: `原文${origEntities.length}个实体, 改写中出现${overlapCount}个: ${overlappedEntities.slice(0, 3).join(', ')}`,
  };
}

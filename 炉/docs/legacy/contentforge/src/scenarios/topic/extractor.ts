import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { callWithFallback } from '../../utils/llm-call.js';
import type { CompetitorArticle } from './types.js';

/**
 * Parse JSON from LLM response — handles arrays, wrapped arrays, single objects,
 * and nested structures like { "hook": [{...}], "transition": [{...}] } or
 * { "opening": {...}, "argument": {...} }.
 */
function parseJsonItems<T>(raw: string): T[] {
  // Try to parse the whole response as JSON first
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    // Try to find a JSON array
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { parsed = JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
    }
    // Try to find any JSON object
    if (!parsed) {
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { return []; }
      } else {
        return [];
      }
    }
  }

  // If it's already an array, return it
  if (Array.isArray(parsed)) return parsed as T[];

  // If it's an object, check if it's a nested structure
  if (typeof parsed === 'object' && parsed !== null) {
    const values = Object.values(parsed);

    // Case 1: { "hook": [{...}, {...}], "transition": [{...}] } — values are arrays of items
    const allArrays = values.every((v) => Array.isArray(v));
    if (allArrays && values.length > 0) {
      return (values as T[][]).flat();
    }

    // Case 2: { "opening": {...}, "argument": {...} } — values are individual items
    const allObjects = values.every((v) => typeof v === 'object' && v !== null && !Array.isArray(v));
    if (allObjects && values.length > 0) {
      return values as T[];
    }

    // Case 3: single item object — check if it has the expected fields
    return [parsed as T];
  }

  return [];
}

type SentenceFragmentType = 'hook' | 'transition' | 'cta' | 'power-line' | 'rhetorical-question' | 'data-opener';
type ParagraphFragmentType = 'opening' | 'argument' | 'emotional-peak' | 'closing' | 'case-study';

interface SentenceFragment {
  id: string;
  type: SentenceFragmentType;
  text: string;
  structure: string;
  source: 'crawled' | 'manual';
  sourceFile: string;
  sourceRecordId: string;
  platform: string;
  tags: string[];
  lastUsedAt?: string;
  useCount: number;
  decayLevel: 'active' | 'dormant' | 'expired';
}

interface ParagraphFragment {
  id: string;
  type: ParagraphFragmentType;
  text: string;
  structure: string;
  source: 'crawled' | 'manual';
  sourceFile: string;
  sourceRecordId: string;
  platform: string;
  tags: string[];
  lastUsedAt?: string;
  useCount: number;
  decayLevel: 'active' | 'dormant' | 'expired';
}

const SENTENCE_EXTRACTION_PROMPT = `你是一个内容拆解专家。从给定文章中提取以下类型的句式碎片（每种 2-4 条）：

1. hook（开头钩子）：用于开头吸引注意力的句式
2. transition（过渡句）：段落之间衔接的句式
3. cta（行动号召）：引导读者行动的句式
4. power-line（金句）：有冲击力的精简句式
5. rhetorical-question（反问）：引发思考的反问句
6. data-opener（数据开头）：以数据开头的句式

请以 JSON 数组格式输出，示例：
[
  {"type": "hook", "text": "你知道吗？90%的职场人都在犯同一个错误。", "structure": "痛点+反问+数据"},
  {"type": "transition", "text": "那么问题来了：...", "structure": "设问过渡"}
]

要求：
- text 必须是原文中的完整句式，不超过 50 字
- structure 描述该句式的叙事结构特征
- 优先提取有高度复用价值的句式`;

const PARAGRAPH_EXTRACTION_PROMPT = `你是一个内容拆解专家。从给定文章中提取以下类型的段落碎片（每种 1-2 条）：

1. opening（开头段落）：建立场景/痛点的开头段落模式
2. argument（论证段落）：逻辑严密的论证段落结构
3. emotional-peak（情绪高潮）：引发强烈情绪共鸣的段落
4. closing（结尾段落）：总结号召的结尾段落模式
5. case-study（案例段落）：以故事/案例为主体的段落

请以 JSON 数组格式输出，示例：
[
  {"type": "opening", "text": "凌晨三点，CBD的写字楼依然灯火通明...", "structure": "场景+痛点+代入感"},
  {"type": "closing", "text": "如果你也想...现在就是最好的时机。", "structure": "问题+方案+行动号召"}
]

要求：
- text 为原文中的完整段落，不超过 300 字
- structure 描述该段落的叙事结构特征
- 优先提取有高度复用价值的段落`;

export async function extractSentenceFragments(
  article: CompetitorArticle,
  content: string
): Promise<SentenceFragment[]> {
  console.log(chalk.cyan(`提取句式碎片: ${article.title}`));

  const prompt = `${SENTENCE_EXTRACTION_PROMPT}\n\n# 文章平台: ${article.platform}\n# 文章标签: ${article.tags.join('、')}\n\n# 文章内容\n${content.slice(0, 8000)}`;

  const raw = await callWithFallback([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 4096, jsonMode: true, model: 'heavy' });

  const items = parseJsonItems<{ type: SentenceFragmentType; text: string; structure: string }>(raw);
  if (items.length === 0) return [];

  return items
    .filter((item) => item.type && item.text && item.structure)
    .map(item => ({
      id: randomUUID(),
      type: item.type,
      text: item.text,
      structure: item.structure,
      source: article.source as 'crawled' | 'manual',
      sourceFile: article.url,
      sourceRecordId: article.id,
      platform: article.platform,
      tags: article.tags,
      useCount: 0,
      decayLevel: 'active' as const,
    }));
}

export async function extractParagraphFragments(
  article: CompetitorArticle,
  content: string
): Promise<ParagraphFragment[]> {
  console.log(chalk.cyan(`提取段落碎片: ${article.title}`));

  const prompt = `${PARAGRAPH_EXTRACTION_PROMPT}\n\n# 文章内容\n${content.slice(0, 8000)}`;

  const raw = await callWithFallback([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 4096, jsonMode: true, model: 'heavy' });

  const items = parseJsonItems<{ type: ParagraphFragmentType; text: string; structure: string }>(raw);
  if (items.length === 0) return [];

  return items
    .filter((item) => item.type && item.text && item.structure)
    .map(item => ({
      id: randomUUID(),
      type: item.type,
      text: item.text,
      structure: item.structure,
      source: article.source as 'crawled' | 'manual',
      sourceFile: article.url,
      sourceRecordId: article.id,
      platform: article.platform,
      tags: article.tags,
      useCount: 0,
      decayLevel: 'active' as const,
    }));
}
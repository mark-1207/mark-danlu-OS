import { randomUUID } from 'crypto';
import chalk from 'chalk';
import type { CompetitorArticle } from './types.js';

const KIMI_API_KEY = process.env.KIMI_API_KEY ?? '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? 'https://yunwu.ai/v1';

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

async function callKimi(prompt: string): Promise<string> {
  if (!KIMI_API_KEY) throw new Error('KIMI_API_KEY 未设置');

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`Kimi API 失败: ${response.status}`);
  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
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
- 优先提取有高度复用价值的句式
- 文章平台：{platform}
- 文章标签：{tags}`;

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

  const prompt = SENTENCE_EXTRACTION_PROMPT
    .replace('{platform}', article.platform)
    .replace('{tags}', article.tags.join('、'));

  const raw = await callKimi(`${prompt}\n\n# 文章内容\n${content.slice(0, 8000)}`);

  const jsonMatch = raw.match(/\[[\s\S]*?\]\]/);
  if (!jsonMatch) return [];

  try {
    const items = JSON.parse(jsonMatch[0]) as { type: SentenceFragmentType; text: string; structure: string }[];
    return items.map(item => ({
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
  } catch {
    return [];
  }
}

export async function extractParagraphFragments(
  article: CompetitorArticle,
  content: string
): Promise<ParagraphFragment[]> {
  console.log(chalk.cyan(`提取段落碎片: ${article.title}`));

  const prompt = PARAGRAPH_EXTRACTION_PROMPT;

  const raw = await callKimi(`${prompt}\n\n# 文章内容\n${content.slice(0, 8000)}`);

  const jsonMatch = raw.match(/\[[\s\S]*?\]\]/);
  if (!jsonMatch) return [];

  try {
    const items = JSON.parse(jsonMatch[0]) as { type: ParagraphFragmentType; text: string; structure: string }[];
    return items.map(item => ({
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
  } catch {
    return [];
  }
}

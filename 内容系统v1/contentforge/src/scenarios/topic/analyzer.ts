// src/scenarios/topic/analyzer.ts
import chalk from 'chalk';
import type { CompetitorArticle, TopicAnalysisResult } from './types.js';

const KIMI_API_KEY = process.env.KIMI_API_KEY ?? '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? 'https://yunwu.ai/v1';

async function callKimi(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!KIMI_API_KEY) throw new Error('KIMI_API_KEY 未设置');

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API 失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

const ANALYSIS_PROMPT = `你是一个资深内容分析师，擅长拆解爆款文章的结构和元素。
给定一篇文章，请提取以下信息并以 JSON 格式输出：

{
  "summary": "核心观点/主题概括（50字内）",
  "viralStructure": "爆款叙事结构描述（如：痛点引入→案例→方法论→号召行动）",
  "topicAngle": "切入角度（如：从职场人效率痛点切入）",
  "tags": ["标签1", "标签2", "标签3"]
}

要求：
- summary 精确概括文章解决的核心问题
- viralStructure 描述叙事节奏和段落逻辑
- topicAngle 指出差异化视角
- tags 提取3-5个主题标签`;

export async function analyzeArticle(article: CompetitorArticle, content: string): Promise<TopicAnalysisResult> {
  console.log(chalk.cyan(`AI 分析中: ${article.title}`));

  const userPrompt = `# 文章标题\n${article.title}\n\n# 文章平台\n${article.platform}\n\n# 文章内容\n${content.slice(0, 8000)}`;

  const rawOutput = await callKimi(ANALYSIS_PROMPT, userPrompt);

  // 提取 JSON
  const jsonMatch = rawOutput.match(/\{[\s\S]*?"summary"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`AI 输出无法解析为 JSON: ${rawOutput.slice(0, 200)}`);
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as TopicAnalysisResult;
    return result;
  } catch {
    throw new Error(`JSON 解析失败: ${jsonMatch[0].slice(0, 200)}`);
  }
}

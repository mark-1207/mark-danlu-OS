// src/scenarios/topic/analyzer.ts
import chalk from 'chalk';
import { callWithFallback } from '../../utils/llm-call.js';
import type { CompetitorArticle, TopicAnalysisResult } from './types.js';

export async function analyzeArticle(article: CompetitorArticle, content: string): Promise<TopicAnalysisResult> {
  console.log(chalk.cyan(`AI 分析中: ${article.title}`));

  const userPrompt = `你是一个资深内容分析师，擅长拆解爆款文章的结构和元素。
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
- tags 提取3-5个主题标签

# 文章标题
${article.title}

# 文章平台
${article.platform}

# 文章内容
${content.slice(0, 8000)}`;

  const rawOutput = await callWithFallback(
    [{ role: 'user', content: userPrompt }],
    { temperature: 0.3, maxTokens: 2048, jsonMode: true }
  );

  // Extract JSON
  const jsonMatch = rawOutput.match(/\{[\s\S]*?"summary"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`AI 输出无法解析为 JSON: ${rawOutput.slice(0, 200)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]) as TopicAnalysisResult;
  } catch {
    throw new Error(`JSON 解析失败: ${jsonMatch[0].slice(0, 200)}`);
  }
}
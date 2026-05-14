import { llmFactory } from '../../llm/factory.js';
import { getCachedConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import { readFeishuRecords, updateFeishuRecordStatus } from './feishu-sync.js';
import type { FeishuRecord, TopicAnalysisResult } from './types.js';

/**
 * Use LLM to analyze a competitor article and extract viral insights.
 */
async function analyzeArticle(title: string, content: string, platform: string): Promise<TopicAnalysisResult> {
  const config = getCachedConfig();
  const provider = llmFactory.get(config.defaultProvider);
  const model = config.providers[config.defaultProvider].defaultModel;

  const systemPrompt = `你是一位内容分析专家，擅长拆解爆款文章的底层结构。

分析任务：
1. 爆款结构：拆解文章的叙事结构（如"冲突开场→数据佐证→故事展开→认知反转→行动号召"）
2. 选题角度：这篇文章的切入角度是什么？为什么这个角度能火？
3. 标签：提取 3-5 个关键词标签
4. 内容摘要：一句话概括核心观点

输出 JSON：
{
  "summary": "一句话核心观点",
  "viralStructure": "叙事结构拆解",
  "topicAngle": "选题角度分析",
  "tags": ["标签1", "标签2", "标签3"]
}

只输出 JSON，不要其他内容。`;

  const userPrompt = `平台：${platform}
标题：${title}

文章内容：
${content.slice(0, 6000)}`;

  const response = await provider.chat({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2000,
    jsonMode: true,
  });

  return JSON.parse(response.content) as TopicAnalysisResult;
}

/**
 * Run AI analysis on all pending feishu records.
 * Reads pending records, analyzes each one, updates feishu with results.
 */
export async function runFeishuAnalysis(): Promise<{
  total: number;
  analyzed: number;
  skipped: number;
  errors: number;
}> {
  const records = await readFeishuRecords();
  const pending = records.filter((r) => r.fields.状态 === 'pending');

  logger.info(`[feishu-analyze] ${records.length} total, ${pending.length} pending`);

  let analyzed = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of pending) {
    const title = record.fields.原文标题;
    const content = record.fields.原文;
    const platform = record.fields.平台;

    if (!content || content.trim().length < 200) {
      logger.warn(`[feishu-analyze] skipping "${title}" — content too short or missing`);
      skipped++;
      continue;
    }

    try {
      logger.info(`[feishu-analyze] analyzing: "${title}"`);
      const result = await analyzeArticle(title, content, platform);

      await updateFeishuRecordStatus(record.record_id, 'analyzed', {
        '爆款结构': result.viralStructure,
        '选题角度': result.topicAngle,
        '标签': result.tags,
        '内容摘要': result.summary,
      });

      logger.info(`[feishu-analyze] ✅ "${title}" — tags: ${result.tags.join(', ')}`);
      analyzed++;
    } catch (err) {
      logger.error(`[feishu-analyze] ❌ "${title}": ${String(err)}`);
      errors++;
    }
  }

  return { total: records.length, analyzed, skipped, errors };
}

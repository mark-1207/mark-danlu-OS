import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { TopicAnalysisSchema, type TopicAnalysis } from '../types.js';
import { buildPreferencePrompt } from '../../learning/creative-preferences.js';

const InputSchema = z.object({
  keyword: z.string(),
  userContext: z.string().optional(),
  excludeDirections: z.array(z.string()).optional(),
});

export class TopicAnalysisStep extends PipelineStep<z.infer<typeof InputSchema>, TopicAnalysis> {
  config = {
    name: 'topic-analysis',
    description: 'Deep analysis of keyword/topic into sub-topics, pain points, trends',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = TopicAnalysisSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    input: z.infer<typeof InputSchema>,
    context: PipelineContext,
  ): Promise<TopicAnalysis> {
    const template = await promptLoader.load('create', 'topic-analysis');

    // 尝试读取竞品洞察（缓存优先，数据驱动过期）
    let competitorInsights: import('../types.js').CompetitorInsight | undefined;
    try {
      const { readCache, isCacheExpired, fetchCompetitiveRecords, formatRecordsForPrompt } = await import('../../topic/competitor-cache.js');
      const cached = await readCache(input.keyword);
      if (cached) {
        const expired = await isCacheExpired(input.keyword, cached.cachedAt);
        if (!expired) {
          competitorInsights = cached.insights;
        }
      }
      if (!competitorInsights) {
        const records = await fetchCompetitiveRecords();
        if (records.length > 0) {
          const formatted = formatRecordsForPrompt(records);
          // 通过 LLM 聚合（与主题分析同一次调用，但 prompt 分别发送）
          const aggregationPrompt = `你是一位资深内容策划专家。请根据以下竞品数据，提取：
1. 已覆盖角度（每个角度附上来源标题和平台）
2. 空白机会角度（为什么这个机会存在）
3. 差异化整体建议（一句话）

竞品数据：
${formatted}

输出格式（严格JSON）：
{
  "coveredAngles": [{"angle": "string", "sourceTitle": "string", "platform": "string"}],
  "opportunityAngles": [{"angle": "string", "whyOpportunity": "string"}],
  "warning": "string"
}`;

          const result = await this.callLLMJson<import('../types.js').CompetitorInsight>([
            { role: 'user', content: aggregationPrompt },
          ]);
          competitorInsights = result;

          // 写入缓存（静默失败不阻断）
          const { writeCache } = await import('../../topic/competitor-cache.js');
          writeCache(input.keyword, result, records.length);
        }
      }
    } catch (err) {
      // 竞品读取失败：警告提示，跳过，流程继续
      console.warn('⚠️ 竞品洞察生成失败，跳过注入。', err);
    }

    const systemPrompt = promptLoader.render(template.system, {
      keyword: input.keyword,
    });

    const userPrompt = promptLoader.render(template.user, {
      keyword: input.keyword,
      userContext: input.userContext ?? '',
      excludeDirections: input.excludeDirections?.join(', ') ?? '',
      competitorInsights: competitorInsights
        ? {
            coveredAngles: competitorInsights.coveredAngles,
            opportunityAngles: competitorInsights.opportunityAngles,
            warning: competitorInsights.warning,
          }
        : undefined,
    }) + '\n\n' + buildPreferencePrompt('wechat');

    const result = await this.callLLMJson<TopicAnalysis>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // 注入竞品洞察到输出（即使为 undefined 也写入，Schema 支持 optional）
    return { ...result, competitorInsights };
  }
}

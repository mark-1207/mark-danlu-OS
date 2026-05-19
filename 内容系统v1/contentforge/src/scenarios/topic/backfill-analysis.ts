/**
 * Backfill narrativeStructure + emotionalTone + contentAngle for existing
 * analyzed/stored records that lack these fields.
 *
 * Usage: node dist/index.js learn --backfill-analysis
 * (registered in learn.ts as --backfill-analysis option)
 */
import { readFeishuRecords, updateFeishuRecordStatus } from './feishu-sync.js';
import { llmFactory } from '../../llm/factory.js';
import { loadConfig, getCachedConfig, setCachedConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';

interface ExtendedResult {
  narrativeStructure: '故事型' | '清单型' | '对比型' | '分析型' | '混合型' | '';
  emotionalTone: '励志' | '冷静' | '温暖' | '犀利' | '幽默' | '';
  contentAngle: string;
}

async function analyzeExtendedFields(
  title: string,
  content: string,
  platform: string,
  existingAnalysis: string,
): Promise<ExtendedResult> {
  const config = getCachedConfig();
  const provider = llmFactory.get(config.defaultProvider);
  const model = config.providers[config.defaultProvider].defaultModel;

  const prompt = `你是一位内容分析专家，擅长判断文章的叙事模式和情感调性。

已知该文章已分析的爆款结构：${existingAnalysis}

请基于文章内容，判断以下三个字段（只输出 JSON，不要其他内容）：
{
  "narrativeStructure": "故事型" | "清单型" | "对比型" | "分析型" | "混合型",
  "emotionalTone": "励志" | "冷静" | "温暖" | "犀利" | "幽默",
  "contentAngle": "一句话描述核心切入角度（不超过20字）"
}

文章内容：
${content.slice(0, 4000)}`;

  const response = await provider.chat({
    model,
    messages: [
      { role: 'system', content: '你是一个严格的内容分类专家，只输出 JSON，不要有任何其他文字。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 512,
    jsonMode: true,
  });

  const parsed = JSON.parse(response.content);
  return {
    narrativeStructure: parsed.narrativeStructure ?? '',
    emotionalTone: parsed.emotionalTone ?? '',
    contentAngle: parsed.contentAngle ?? '',
  };
}

export async function backfillCompetitorAnalysis(): Promise<{
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const config = await loadConfig();
  setCachedConfig(config);
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const records = await readFeishuRecords();
  const analyzed = records.filter(
    r => (r.fields.状态 === 'analyzed' || r.fields.状态 === 'stored')
      && !r.fields.叙事结构,
  );

  logger.info(`[backfill] ${records.length} total, ${analyzed.length} need backfill`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of analyzed) {
    const title = record.fields.原文标题;
    const content = record.fields.原文 ?? '';
    const platform = record.fields.平台;
    const existingAnalysis = record.fields.爆款结构 ?? '';

    if (!content || content.trim().length < 200) {
      skipped++;
      continue;
    }

    try {
      logger.info(`[backfill] processing: "${title}"`);
      const result = await analyzeExtendedFields(title, content, platform, existingAnalysis);

      await updateFeishuRecordStatus(record.record_id, record.fields.状态 as 'analyzed' | 'stored', {
        '叙事结构': result.narrativeStructure,
        '情感调性': result.emotionalTone,
        '内容角度': result.contentAngle,
      });

      updated++;
      logger.info(`[backfill] ✅ "${title}" → ${result.narrativeStructure} / ${result.emotionalTone}`);
    } catch (err) {
      errors++;
      logger.error(`[backfill] ❌ "${title}": ${String(err)}`);
    }
  }

  return { total: records.length, updated, skipped, errors };
}
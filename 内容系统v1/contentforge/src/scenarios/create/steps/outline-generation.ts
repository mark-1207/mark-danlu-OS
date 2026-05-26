import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { getCachedConfig } from '../../../config/loader.js';
import { getObsidianReader } from '../../../io/obsidian/reader.js';
import { logger } from '../../../utils/logger.js';
import { buildPreferencePrompt } from '../../learning/creative-preferences.js';
import {
  PlatformAssignmentsSchema,
  TopicCardSchema,
  WechatOutlineSchema,
  XiaohongshuOutlineSchema,
  DouyinOutlineSchema,
  type PlatformAssignments,
  type TopicAnalysis,
  type WechatOutline,
  type XiaohongshuOutline,
  type DouyinOutline,
} from '../types.js';

const WechatInputSchema = z.object({ topicCard: TopicCardSchema.optional() });
const XiaohongshuInputSchema = z.object({ topicCard: TopicCardSchema.optional() });
const DouyinInputSchema = z.object({ topicCard: TopicCardSchema.optional() });

// ── Obsidian material loader for outline ───────────────────────────────

async function loadObsidianMaterialsForOutline(context: PipelineContext): Promise<string> {
  const config = getCachedConfig();
  const obsidianConfig = config.obsidian;
  if (!obsidianConfig?.vaultPath) return '';

  try {
    const reader = getObsidianReader(obsidianConfig.vaultPath, obsidianConfig.readDirs);
    await reader.load();

    const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');
    const keywords: string[] = [];
    if (topicAnalysis?.keyword) keywords.push(topicAnalysis.keyword);
    if (topicAnalysis?.subTopics) {
      for (const st of topicAnalysis.subTopics.slice(0, 3)) keywords.push(st.name);
    }

    if (keywords.length === 0) return '';

    const embCfg = obsidianConfig.embeddingSearch;
    let materials;
    if (embCfg?.enabled) {
      // Build query text from topic analysis for embedding-based search
      const queryText = [topicAnalysis.keyword, ...topicAnalysis.subTopics.map((s: any) => s.name)].join(' ');
      materials = await reader.semanticSearch(
        keywords,
        queryText,
        { minQuality: 6 },
        embCfg.topK ?? 8,
        embCfg.semanticWeight ?? 0.5,
      );
    } else {
      materials = reader.search(keywords, { minQuality: 6, limit: 8 });
    }

    if (materials.length === 0) return '';

    logger.info(`[outline-generation] loaded ${materials.length} Obsidian materials for knowledge transfer`);
    return reader.formatForPrompt(materials);
  } catch (err) {
    logger.warn('[outline-generation] failed to load Obsidian materials:', String(err));
    return '';
  }
}

// ── Wechat ──────────────────────────────────────────────────────────

export class OutlineWechatStep extends PipelineStep<z.infer<typeof WechatInputSchema>, WechatOutline> {
  config = { name: 'outline-wechat', description: 'Generate wechat article outline', retries: 1 };

  inputSchema = WechatInputSchema;
  outputSchema = WechatOutlineSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof WechatInputSchema>, context: PipelineContext): Promise<WechatOutline> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    if (!assignments) throw new Error('topic-assignment not found in context');
    const confirmedTitle = context.get<string>('confirmed-title-wechat');
    const title = confirmedTitle ?? assignments.wechat.titleDrafts[0];
    const topicCard = { ...assignments.wechat, title };

    const materials = await loadObsidianMaterialsForOutline(context);

    const template = await promptLoader.load('create', 'outline', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const prefPrompt = buildPreferencePrompt('wechat');
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(topicCard, null, 2),
      materials,
      cognitiveTension: topicCard.cognitiveTension,
      structureType: topicCard.structureType,
      progressionMode: topicCard.progressionMode,
    }) + prefPrompt;

    return this.callLLMJson<WechatOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

// ── Xiaohongshu ─────────────────────────────────────────────────────

export class OutlineXiaohongshuStep extends PipelineStep<z.infer<typeof XiaohongshuInputSchema>, XiaohongshuOutline> {
  config = { name: 'outline-xiaohongshu', description: 'Generate xiaohongshu note outline', retries: 1 };

  inputSchema = XiaohongshuInputSchema;
  outputSchema = XiaohongshuOutlineSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof XiaohongshuInputSchema>, context: PipelineContext): Promise<XiaohongshuOutline> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    if (!assignments) throw new Error('topic-assignment not found in context');
    const confirmedTitle = context.get<string>('confirmed-title-xiaohongshu');
    const title = confirmedTitle ?? assignments.xiaohongshu.titleDrafts[0];
    const topicCard = { ...assignments.xiaohongshu, title };
    const template = await promptLoader.load('create', 'outline', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const prefPrompt = buildPreferencePrompt('xiaohongshu');
    const userPrompt = promptLoader.render(template.user, { topicCard: JSON.stringify(topicCard, null, 2) }) + prefPrompt;

    return this.callLLMJson<XiaohongshuOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

// ── Douyin ──────────────────────────────────────────────────────────

export class OutlineDouyinStep extends PipelineStep<z.infer<typeof DouyinInputSchema>, DouyinOutline> {
  config = { name: 'outline-douyin', description: 'Generate douyin script outline', retries: 1 };

  inputSchema = DouyinInputSchema;
  outputSchema = DouyinOutlineSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof DouyinInputSchema>, context: PipelineContext): Promise<DouyinOutline> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    if (!assignments) throw new Error('topic-assignment not found in context');
    const confirmedTitle = context.get<string>('confirmed-title-douyin');
    const title = confirmedTitle ?? assignments.douyin.titleDrafts[0];
    const topicCard = { ...assignments.douyin, title };
    const template = await promptLoader.load('create', 'outline', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const prefPrompt = buildPreferencePrompt('douyin');
    const userPrompt = promptLoader.render(template.user, { topicCard: JSON.stringify(topicCard, null, 2) }) + prefPrompt;

    return this.callLLMJson<DouyinOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

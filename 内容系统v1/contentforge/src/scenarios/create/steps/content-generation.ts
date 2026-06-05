import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { getCachedConfig } from '../../../config/loader.js';
import { getObsidianReader } from '../../../io/obsidian/reader.js';
import { logger } from '../../../utils/logger.js';
import {
  PlatformAssignmentsSchema,
  WechatOutlineSchema,
  XiaohongshuOutlineSchema,
  DouyinOutlineSchema,
  type PlatformAssignments,
  type WechatOutline,
  type XiaohongshuOutline,
  type DouyinOutline,
  type TopicAnalysis,
  type MaterialSearchOutput,
} from '../types.js';

// ── Material search (obsidian channel) loader ──────────────────────────

function loadMaterialSearchMaterials(context: PipelineContext, platform: 'wechat' | 'xiaohongshu' | 'douyin'): string {
  const output = context.get<MaterialSearchOutput>('material-search');
  if (!output) return '';
  const materials = output[platform] ?? [];
  if (materials.length === 0) return '';
  return materials
    .filter((m) => m.source?.startsWith('obsidian:'))
    .map((m) => `[${m.type}] ${m.content}`)
    .join('\n');
}

// ── Obsidian material loader ────────────────────────────────────────────

async function loadObsidianMaterials(context: PipelineContext): Promise<string> {
  const config = getCachedConfig();
  const obsidianConfig = config.obsidian;
  if (!obsidianConfig?.vaultPath) return '';

  try {
    const reader = getObsidianReader(obsidianConfig.vaultPath, obsidianConfig.readDirs);
    await reader.load();

    // Extract keywords from topic analysis
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
      const queryText = [topicAnalysis!.keyword, ...topicAnalysis!.subTopics.map((s: any) => s.name)].join(' ');
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

    logger.info(`[content-generation] injected ${materials.length} Obsidian materials`);
    return reader.formatForPrompt(materials);
  } catch (err) {
    logger.warn('[content-generation] failed to load Obsidian materials:', String(err));
    return '';
  }
}

const ContentInputSchema = z.object({
  topicCard: z.unknown().optional(),
  outline: z.unknown().optional(),
  materials: z.string().optional(),
});

type ContentInput = z.infer<typeof ContentInputSchema>;

// ── Wechat ──────────────────────────────────────────────────────────

export class ContentWechatStep extends PipelineStep<ContentInput, string> {
  config = { name: 'content-wechat', description: 'Generate wechat article content', retries: 1 };

  inputSchema = ContentInputSchema;
  // Raw markdown output — no JSON schema validation
  outputSchema = z.string();

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: ContentInput, context: PipelineContext): Promise<string> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const outline = context.get<WechatOutline>('confirmed-outline-wechat')
      ?? context.get<WechatOutline>('outline-wechat');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline');
    const template = await promptLoader.load('create', 'content', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const obsidianMaterials = await loadObsidianMaterials(context);
    const storeMaterials = loadMaterialSearchMaterials(context, 'wechat');
    const seedMaterial = context.get<string>('outline-seed-material-wechat') ?? '';
    const allMaterials = [seedMaterial, input.materials, obsidianMaterials, storeMaterials].filter(Boolean).join('\n\n');
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.wechat, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: allMaterials,
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return content;
  }
}

// ── Xiaohongshu ─────────────────────────────────────────────────────

export class ContentXiaohongshuStep extends PipelineStep<ContentInput, string> {
  config = { name: 'content-xiaohongshu', description: 'Generate xiaohongshu note content', retries: 1 };

  inputSchema = ContentInputSchema;
  outputSchema = z.string();

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: ContentInput, context: PipelineContext): Promise<string> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const outline = context.get<XiaohongshuOutline>('confirmed-outline-xiaohongshu')
      ?? context.get<XiaohongshuOutline>('outline-xiaohongshu');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline');
    const template = await promptLoader.load('create', 'content', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const obsidianMaterials = await loadObsidianMaterials(context);
    const storeMaterials = loadMaterialSearchMaterials(context, 'xiaohongshu');
    const seedMaterial = context.get<string>('outline-seed-material-xiaohongshu') ?? '';
    const allMaterials = [seedMaterial, input.materials, obsidianMaterials, storeMaterials].filter(Boolean).join('\n\n');
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.xiaohongshu, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: allMaterials,
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return content;
  }
}

// ── Douyin ──────────────────────────────────────────────────────────

export class ContentDouyinStep extends PipelineStep<ContentInput, string> {
  config = { name: 'content-douyin', description: 'Generate douyin script content', retries: 1 };

  inputSchema = ContentInputSchema;
  outputSchema = z.string();

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: ContentInput, context: PipelineContext): Promise<string> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const outline = context.get<DouyinOutline>('confirmed-outline-douyin')
      ?? context.get<DouyinOutline>('outline-douyin');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline');
    const template = await promptLoader.load('create', 'content', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const obsidianMaterials = await loadObsidianMaterials(context);
    const storeMaterials = loadMaterialSearchMaterials(context, 'douyin');
    const seedMaterial = context.get<string>('outline-seed-material-douyin') ?? '';
    const allMaterials = [seedMaterial, input.materials, obsidianMaterials, storeMaterials].filter(Boolean).join('\n\n');
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.douyin, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: allMaterials,
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return content;
  }
}

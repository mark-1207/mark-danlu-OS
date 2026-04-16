import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import {
  PlatformAssignmentsSchema,
  WechatOutlineSchema,
  XiaohongshuOutlineSchema,
  DouyinOutlineSchema,
  type PlatformAssignments,
  type WechatOutline,
  type XiaohongshuOutline,
  type DouyinOutline,
} from '../types.js';

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
    const outline = context.get<WechatOutline>('outline-wechat');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline-wechat');
    const template = await promptLoader.load('create', 'content', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.wechat, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: input.materials ?? '',
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
    const outline = context.get<XiaohongshuOutline>('outline-xiaohongshu');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline-xiaohongshu');
    const template = await promptLoader.load('create', 'content', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.xiaohongshu, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: input.materials ?? '',
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
    const outline = context.get<DouyinOutline>('outline-douyin');
    if (!assignments || !outline) throw new Error('Missing context: topic-assignment or outline-douyin');
    const template = await promptLoader.load('create', 'content', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      topicCard: JSON.stringify(assignments.douyin, null, 2),
      outline: JSON.stringify(outline, null, 2),
      materials: input.materials ?? '',
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return content;
  }
}

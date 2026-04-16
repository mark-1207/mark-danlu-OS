import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import {
  PlatformAssignmentsSchema,
  TopicCardSchema,
  WechatOutlineSchema,
  XiaohongshuOutlineSchema,
  DouyinOutlineSchema,
  type PlatformAssignments,
  type WechatOutline,
  type XiaohongshuOutline,
  type DouyinOutline,
} from '../types.js';

const WechatInputSchema = z.object({ topicCard: TopicCardSchema.optional() });
const XiaohongshuInputSchema = z.object({ topicCard: TopicCardSchema.optional() });
const DouyinInputSchema = z.object({ topicCard: TopicCardSchema.optional() });

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
    const template = await promptLoader.load('create', 'outline', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, { topicCard: JSON.stringify(assignments.wechat, null, 2) });

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
    const template = await promptLoader.load('create', 'outline', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, { topicCard: JSON.stringify(assignments.xiaohongshu, null, 2) });

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
    const template = await promptLoader.load('create', 'outline', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, { topicCard: JSON.stringify(assignments.douyin, null, 2) });

    return this.callLLMJson<DouyinOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

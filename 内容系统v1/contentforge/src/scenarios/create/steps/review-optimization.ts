import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { PlatformAssignmentsSchema, ReviewResultSchema, type PlatformAssignments, type ReviewResult } from '../types.js';

const ReviewInputSchema = z.object({
  titleDrafts: z.array(z.string()).optional(),
  content: z.string().optional(),
  topicCard: z.unknown().optional(),
});

const ReviewOutputSchema = ReviewResultSchema;

// ── Wechat ──────────────────────────────────────────────────────────

export class ReviewWechatStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-wechat', description: 'Review and optimize wechat article', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-wechat');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-wechat');
    const template = await promptLoader.load('create', 'review', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.wechat, null, 2),
    });

    return this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

// ── Xiaohongshu ─────────────────────────────────────────────────────

export class ReviewXiaohongshuStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-xiaohongshu', description: 'Review and optimize xiaohongshu note', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-xiaohongshu');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-xiaohongshu');
    const template = await promptLoader.load('create', 'review', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.xiaohongshu, null, 2),
    });

    return this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

// ── Douyin ──────────────────────────────────────────────────────────

export class ReviewDouyinStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-douyin', description: 'Review and optimize douyin script', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-douyin');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-douyin');
    const template = await promptLoader.load('create', 'review', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.douyin, null, 2),
    });

    return this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

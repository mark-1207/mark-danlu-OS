import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { ShortReviewSchema, type ShortReview, type ShortContent } from '../types.js';

const InputSchema = z.object({});

export class ShortReviewStep extends PipelineStep<z.infer<typeof InputSchema>, ShortReview> {
  config = {
    name: 'short-review',
    description: 'Evaluate short-form content on 5 dimensions with style detection',
    retries: 1,
    temperature: 0.5,
  };

  inputSchema = InputSchema;
  outputSchema = ShortReviewSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    _input: z.infer<typeof InputSchema>,
    context: PipelineContext,
  ): Promise<ShortReview> {
    const shortContent = context.get<ShortContent>('short-content');
    if (!shortContent) {
      throw new Error('short-review: context missing short-content');
    }

    const template = await promptLoader.load('create', 'short-review');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      title: shortContent.title,
      content: shortContent.content,
      wordCount: shortContent.wordCount,
    });

    return this.callLLMJson<ShortReview>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

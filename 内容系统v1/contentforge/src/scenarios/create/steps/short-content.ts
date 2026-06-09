import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { ShortContentSchema, type ShortContent, type ShortAngle } from '../types.js';

const InputSchema = z.object({});

export class ShortContentStep extends PipelineStep<z.infer<typeof InputSchema>, ShortContent> {
  config = {
    name: 'short-content',
    description: 'Write 200-500 char short-form content based on selected angle',
    retries: 1,
    temperature: 0.8,
  };

  inputSchema = InputSchema;
  outputSchema = ShortContentSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    _input: z.infer<typeof InputSchema>,
    context: PipelineContext,
  ): Promise<ShortContent> {
    const shortAngle = context.get<ShortAngle>('short-angle');
    if (!shortAngle) {
      throw new Error('short-content: context missing short-angle');
    }

    const template = await promptLoader.load('create', 'short-content');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      angle: shortAngle.angle,
      hookStrategy: shortAngle.hookStrategy,
      emotionalCore: shortAngle.emotionalCore,
      targetAudience: shortAngle.targetAudience,
    });

    return this.callLLMJson<ShortContent>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

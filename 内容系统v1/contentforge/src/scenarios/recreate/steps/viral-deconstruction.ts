import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { ViralGenomeSchema, type ViralGenome } from '../types.js';

const InputSchema = z.object({
  originalArticle: z.string(),
});

export class ViralDeconstructionStep extends PipelineStep<z.infer<typeof InputSchema>, ViralGenome> {
  config = {
    name: 'viral-deconstruction',
    description: 'Deconstruct viral article into viral genome',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = ViralGenomeSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, _context: PipelineContext): Promise<ViralGenome> {
    const template = await promptLoader.load('recreate', 'viral-deconstruction');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      originalArticle: input.originalArticle,
    });

    return this.callLLMJson<ViralGenome>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

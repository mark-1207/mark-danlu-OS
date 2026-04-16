import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { DifferentiationOutputSchema, type ViralGenome } from '../types.js';

const InputSchema = z.object({
  _unused: z.string().optional(),
});

export class DifferentiationStep extends PipelineStep<z.infer<typeof InputSchema>, z.infer<typeof DifferentiationOutputSchema>> {
  config = {
    name: 'viral-differentiation',
    description: 'Generate differentiation directions for recreation',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = DifferentiationOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(_input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<z.infer<typeof DifferentiationOutputSchema>> {
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');
    if (!viralGenome) throw new Error('viral-deconstruction not found in context');

    const directionMode = (context.get('_direction') as string | undefined) ?? 'auto';
    const isInteractive = directionMode === 'interactive';

    const template = await promptLoader.load('recreate', 'viral-differentiation');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      viralGenome: JSON.stringify(viralGenome, null, 2),
      mode: 'auto',
      interactive: isInteractive,
    });

    const result = await this.callLLMJson<z.infer<typeof DifferentiationOutputSchema>>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // In interactive mode, return all directions but do NOT auto-select.
    // The CLI will prompt the user to select and update selectedDirection in context.
    if (isInteractive) {
      return {
        directions: result.directions,
        selectedDirection: null,
        selectionReason: 'User will select interactively',
      };
    }

    return result;
  }
}

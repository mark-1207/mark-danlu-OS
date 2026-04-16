import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import {
  ViralGenomeSchema,
  DifferentiationDirectionSchema,
  NewOutlineSchema,
  type ViralGenome,
  type DifferentiationOutput,
  type NewOutline,
} from '../types.js';

const InputSchema = z.object({
  viralGenome: ViralGenomeSchema.optional(),
  selectedDirection: DifferentiationDirectionSchema.optional(),
});

export class NewOutlineStep extends PipelineStep<z.infer<typeof InputSchema>, NewOutline> {
  config = {
    name: 'new-outline',
    description: 'Generate new outline based on viral genome structure and differentiation direction',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = NewOutlineSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<NewOutline> {
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');
    const diffOutput = context.get<DifferentiationOutput>('viral-differentiation');
    if (!viralGenome || !diffOutput) throw new Error('Missing context: viral-deconstruction or viral-differentiation');
    const selectedDirection = diffOutput.selectedDirection;
    if (!selectedDirection) throw new Error('No differentiation direction selected');

    const template = await promptLoader.load('recreate', 'new-outline');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      narrativeStructure: JSON.stringify(viralGenome.narrativeStructure, null, 2),
      emotionCurve: JSON.stringify(viralGenome.emotionCurve, null, 2),
      selectedDirection: JSON.stringify(selectedDirection, null, 2),
    });

    return this.callLLMJson<NewOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

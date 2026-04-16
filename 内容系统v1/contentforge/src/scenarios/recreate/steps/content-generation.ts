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
  newOutline: NewOutlineSchema.optional(),
  selectedDirection: DifferentiationDirectionSchema.optional(),
});

export class RecreationContentStep extends PipelineStep<z.infer<typeof InputSchema>, string> {
  config = {
    name: 'recreation-content',
    description: 'Generate recreated article — no original text in context',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = z.string();

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<string> {
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');
    const diffOutput = context.get<DifferentiationOutput>('viral-differentiation');
    const newOutline = context.get<NewOutline>('new-outline');
    if (!viralGenome || !diffOutput || !newOutline) throw new Error('Missing context: viral-deconstruction, viral-differentiation, or new-outline');
    const selectedDirection = diffOutput.selectedDirection;
    if (!selectedDirection) throw new Error('No differentiation direction selected');

    const template = await promptLoader.load('recreate', 'recreation-content');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      narrativeStructure: JSON.stringify(viralGenome.narrativeStructure, null, 2),
      emotionCurve: JSON.stringify(viralGenome.emotionCurve, null, 2),
      newOutline: JSON.stringify(newOutline, null, 2),
      selectedDirection: JSON.stringify(selectedDirection, null, 2),
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return content;
  }
}

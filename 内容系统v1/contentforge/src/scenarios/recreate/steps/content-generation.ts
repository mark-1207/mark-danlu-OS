import { z } from 'zod';
import path from 'path';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { getCachedConfig } from '../../../config/loader.js';
import { getFragmentLoader } from '../../../fragment-library/fragment-loader.js';
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

    // Load relevant fragments for prompt injection
    let fragmentSection = '';
    try {
      const config = getCachedConfig();
      const outputDir = config.output?.dir ?? './output';
      const corpusDir = path.join(path.resolve(outputDir), 'corpus');
      const loader = getFragmentLoader(corpusDir);
      const sentences = loader.getSentenceFragments(undefined, 'universal', 5);
      const paragraphs = loader.getParagraphFragments(undefined, 'universal', 3);
      if (sentences.length > 0 || paragraphs.length > 0) {
        fragmentSection = '\n\n' + loader.formatForPrompt(sentences, paragraphs);
      }
    } catch {
      // Fragments not available yet — skip
    }

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      narrativeStructure: JSON.stringify(viralGenome.narrativeStructure, null, 2),
      emotionCurve: JSON.stringify(viralGenome.emotionCurve, null, 2),
      newOutline: JSON.stringify(newOutline, null, 2),
      selectedDirection: JSON.stringify(selectedDirection, null, 2),
      forbiddenExpressions: JSON.stringify(viralGenome.forbiddenExpressions ?? [], null, 2),
    });

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + fragmentSection },
    ]);

    return content;
  }
}

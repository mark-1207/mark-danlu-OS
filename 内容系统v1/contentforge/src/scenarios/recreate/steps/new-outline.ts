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

/**
 * Extract keywords from ViralGenome for fragment relevance scoring.
 * Collects terms from narrative structure, emotional arcs, and forbidden expressions.
 */
function extractKeywords(genome: ViralGenome): string[] {
  const kw = new Set<string>();

  // From narrative structure: argumentative paths + pain points
  for (const s of genome.narrativeStructure) {
    // Split on common delimiters and add meaningful tokens
    const pathTerms = s.argumentativePath.split(/[，、，。！？\s]+/).filter((t: string) => t.length > 1);
    pathTerms.forEach((t: string) => kw.add(t));

    if (s.painPoint) {
      s.painPoint.split(/[，、，。！？\s]+/).filter((t: string) => t.length > 1).forEach((t: string) => kw.add(t));
    }
    if (s.whyItWorks) {
      s.whyItWorks.split(/[，、，。！？\s]+/).filter((t: string) => t.length > 1).forEach((t: string) => kw.add(t));
    }
  }

  // From emotion curve: emotion labels
  for (const e of genome.emotionCurve) {
    if (e.emotion) kw.add(e.emotion);
  }

  // From forbidden expressions: extract meaningful terms
  for (const fe of genome.forbiddenExpressions) {
    // Take only meaningful terms (skip short stopwords)
    fe.split(/[，、，。！？\s]+/).filter((t: string) => t.length > 1).forEach((t: string) => kw.add(t));
  }

  return Array.from(kw);
}

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

    // Load relevant style fragments for outline guidance, ranked by keyword relevance
    let fragmentSection = '';
    try {
      const config = getCachedConfig();
      const outputDir = config.output?.dir ?? './output';
      const corpusDir = path.join(path.resolve(outputDir), 'corpus');
      const loader = getFragmentLoader(corpusDir);

      // Extract keywords from viralGenome for relevance scoring
      const keywords = extractKeywords(viralGenome);

      const sentences = loader.getSentenceFragments(
        ['hook', 'transition', 'cta', 'power-line', 'rhetorical-question', 'data-opener'],
        'universal',
        5,
        keywords,
      );
      const paragraphs = loader.getParagraphFragments(
        ['opening', 'argument', 'emotional-peak', 'closing', 'case-study'],
        'universal',
        3,
        keywords,
      );
      if (sentences.length > 0 || paragraphs.length > 0) {
        fragmentSection = loader.formatForPrompt(sentences, paragraphs);
        // Track which fragments were selected for decay counting
        loader.markUsed([...sentences, ...paragraphs].map(f => ({ id: f.id })));
      }
    } catch {
      // Fragments not available yet — skip
    }

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      narrativeStructure: JSON.stringify(viralGenome.narrativeStructure, null, 2),
      emotionCurve: JSON.stringify(viralGenome.emotionCurve, null, 2),
      selectedDirection: JSON.stringify(selectedDirection, null, 2),
      forbiddenExpressions: JSON.stringify(viralGenome.forbiddenExpressions ?? [], null, 2),
      fragments: fragmentSection,
    });

    return this.callLLMJson<NewOutline>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

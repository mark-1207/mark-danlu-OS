import { z } from 'zod';
import path from 'path';
import { PipelineStep, type StepResult } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { getCachedConfig } from '../../../config/loader.js';
import { getFragmentLoader } from '../../../fragment-library/fragment-loader.js';
import { computeEmbedding, cosineSimilarity } from '../../../utils/embedding.js';
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

/**
 * Filter fragments by cosine similarity against original elements.
 * Uses Promise.all for parallel embedding computation.
 * Fails open — keeps fragment if embedding computation fails.
 */
async function filterFragmentsBySimilarity<T>(
  fragments: T[],
  getText: (f: T) => string,
  originalElements: { embedding: number[] }[],
  threshold = 0.80
): Promise<T[]> {
  if (originalElements.length === 0) return fragments;

  const results = await Promise.all(
    fragments.map(async (f) => {
      try {
        const emb = await computeEmbedding({ text: getText(f) });
        const keep = !originalElements.some(
          (el) => cosineSimilarity(emb.embedding, el.embedding) > threshold
        );
        return { fragment: f, keep };
      } catch {
        return { fragment: f, keep: true };
      }
    })
  );

  return results.filter((r) => r.keep).map((r) => r.fragment);
}

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

  /**
   * Override execute to bypass safeJsonParse — this step returns raw text, not JSON.
   * The base class callLLMJson would call safeJsonParse which fails on plain text,
   * causing a wasted retry and then returning {content} instead of the string.
   */
  async execute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<StepResult<string>> {
    const validatedInput = this.inputSchema.parse(input);
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.doExecute(validatedInput, context);
        const validatedOutput = this.outputSchema.parse(result);
        const durationMs = Date.now() - startTime;
        const tokenUsage = this.lastTokenUsage;
        return { success: true, data: validatedOutput, tokenUsage, durationMs };
      } catch (error) {
        if (attempt < this.config.retries) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // Should not reach here if retries handle all cases; fallback
    const durationMs = Date.now() - startTime;
    return { success: false, error: 'Step failed after retries', durationMs };
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<string> {
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');
    const diffOutput = context.get<DifferentiationOutput>('viral-differentiation');
    const newOutline = context.get<NewOutline>('new-outline');
    const styleInject = context.get<{ systemPrompt: string; constraints: string[] }>('style-inject');
    if (!viralGenome || !diffOutput || !newOutline) throw new Error('Missing context: viral-deconstruction, viral-differentiation, or new-outline');
    const selectedDirection = diffOutput.selectedDirection;
    if (!selectedDirection) throw new Error('No differentiation direction selected');

    // 原文要素 embedding（用于碎片过滤）
    const originalElements: { type: string; id: string; text: string; embedding: number[] }[] = [];

    // 收集 caseStudies embedding
    if (viralGenome?.caseStudies) {
      for (const cs of viralGenome.caseStudies) {
        if (cs.embedding && cs.embedding.length > 0) {
          originalElements.push({ type: 'caseStudy', id: cs.id, text: cs.protagonist + ': ' + cs.story, embedding: cs.embedding });
        }
      }
    }

    // 收集 keyDataPoints embedding
    if (viralGenome?.keyDataPoints) {
      for (const dp of viralGenome.keyDataPoints) {
        if (dp.embedding && dp.embedding.length > 0) {
          originalElements.push({ type: 'keyDataPoint', id: dp.id, text: dp.data + ' (' + dp.field + ')', embedding: dp.embedding });
        }
      }
    }

    // 收集 goldQuotes embedding
    if (viralGenome?.goldQuotes) {
      for (const gq of viralGenome.goldQuotes) {
        if (gq.embedding && gq.embedding.length > 0) {
          originalElements.push({ type: 'goldQuote', id: gq.id, text: gq.text, embedding: gq.embedding });
        }
      }
    }

    const template = await promptLoader.load('recreate', 'recreation-content');

    // Load relevant fragments for prompt injection
    let fragmentSection = '';
    try {
      const config = getCachedConfig();
      const outputDir = config.output?.dir ?? './output';
      const corpusDir = path.join(path.resolve(outputDir), 'corpus');
      const loader = getFragmentLoader(corpusDir);
      const sentences = loader.getSentenceFragments(undefined, 'universal', 8);
      const paragraphs = loader.getParagraphFragments(undefined, 'universal', 3);

      // 过滤与原文相似的碎片（embedding > 0.80）
      const filteredSentences = await filterFragmentsBySimilarity(
        sentences,
        (s) => s.text,
        originalElements
      );

      const filteredParagraphs = await filterFragmentsBySimilarity(
        paragraphs,
        (p) => p.content.slice(0, 500),
        originalElements
      );

      if (filteredSentences.length > 0 || filteredParagraphs.length > 0) {
        fragmentSection = '\n\n' + loader.formatForPrompt(filteredSentences, filteredParagraphs);
      }
    } catch {
      // Fragments not available yet — skip
    }

    const systemPrompt = promptLoader.render(template.system, {});
    // Inject writer style if available
    let finalSystemPrompt = systemPrompt;
    if (styleInject) {
      finalSystemPrompt += '\n\n【写作风格】\n' + styleInject.systemPrompt;
      if (styleInject.constraints.length > 0) {
        finalSystemPrompt += '\n\n【风格约束】\n' + styleInject.constraints.join('\n');
      }
    }
    const userPrompt = promptLoader.render(template.user, {
      narrativeStructure: JSON.stringify(viralGenome.narrativeStructure, null, 2),
      emotionCurve: JSON.stringify(viralGenome.emotionCurve, null, 2),
      newOutline: JSON.stringify(newOutline, null, 2),
      selectedDirection: JSON.stringify(selectedDirection, null, 2),
      forbiddenExpressions: JSON.stringify(viralGenome.forbiddenExpressions ?? [], null, 2),
    });

    const { content } = await this.callLLM([
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: userPrompt + fragmentSection },
    ]);

    return content;
  }
}

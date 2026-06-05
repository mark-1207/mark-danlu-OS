/**
 * Opinion-refine step: validates, falsifies, and refines the user's opinion.
 * Flow: opinion text → HKR质检 + 证伪 + 锤炼论点 + 推荐标题
 * Output: RefinedOpinion
 */
import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { safeJsonParse } from '../../../utils/json-parser.js';
import type { RefinedOpinion, HKRScore } from '../types.js';
import { validateRefinedOpinion } from '../types.js';

const InputSchema = z.object({
  opinion: z.string().min(1),
});

const OutputSchema = z.object({
  type: z.enum(['comparison', 'causal', 'judgment']),
  refinedThesis: z.string().min(1),
  evidence: z.array(z.string()),
  counterArguments: z.array(z.string()),
  boundaries: z.string(),
  whyNow: z.string(),
  hkrScore: z.object({
    h: z.number().min(0).max(100),
    k: z.number().min(0).max(100),
    r: z.number().min(0).max(100),
  }),
  hkrFeedback: z.object({
    h: z.string().optional(),
    k: z.string().optional(),
    r: z.string().optional(),
  }).optional(),
  recommendedTitles: z.array(z.string()),
}).passthrough(); // preserve originalOpinion and other extra fields
// Note: originalOpinion is added from input, not from LLM response

export interface OpinionRefineResult {
  success: boolean;
  data?: RefinedOpinion;
  error?: string;
}

export class OpinionRefineStep extends PipelineStep<z.infer<typeof InputSchema>, RefinedOpinion> {
  config = {
    name: 'opinion-refine',
    description: 'Refine and falsify user opinion with HKR quality check',
    retries: 1,
    temperature: 0.7,
    maxTokens: 2000,
  };

  inputSchema = InputSchema;
  outputSchema = OutputSchema as unknown as z.ZodType<RefinedOpinion>;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    input: z.infer<typeof InputSchema>,
    _context: PipelineContext,
  ): Promise<RefinedOpinion> {
    const template = await promptLoader.load('opinion', 'opinion-refine');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = template.user
      .replace('{{opinion}}', input.opinion);

    const { content } = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const parsed = safeJsonParse(content);
    if (!parsed) {
      throw new Error(`opinion-refine: failed to parse LLM response: ${content.slice(0, 100)}`);
    }

    // LLM response doesn't include originalOpinion — add from input
    const result = OutputSchema.parse(parsed);

    return {
      originalOpinion: input.opinion,
      refinedThesis: result.refinedThesis,
      type: result.type,
      evidence: result.evidence,
      counterArguments: result.counterArguments,
      boundaries: result.boundaries,
      whyNow: result.whyNow,
      hkrScore: result.hkrScore,
      recommendedTitles: result.recommendedTitles,
    };
  }
}

/**
 * Convenience wrapper: run opinion-refine without PipelineStep overhead.
 * Used by opinion CLI command directly.
 */
export async function refineOpinion(
  opinion: string,
  provider: LLMProvider,
  defaultModel: string,
): Promise<OpinionRefineResult> {
  try {
    const step = new OpinionRefineStep(provider, defaultModel);
    const context = new PipelineContext('opinion', process.cwd(), `opinion_${Date.now()}`);
    const result = await step.execute({ opinion }, context);
    return { success: true, data: result.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

import { Pipeline } from '../../core/pipeline.js';
import { llmFactory } from '../../llm/factory.js';
import type { Config } from '../../config/schema.js';
import {
  ViralDeconstructionStep,
  DifferentiationStep,
  NewOutlineStep,
  RecreationContentStep,
  DualReviewStep,
  LocalRewriteStep,
} from './steps/index.js';

/**
 * Build and return a configured Recreate Pipeline (Scenario B).
 *
 * Key constraint: original article text is NEVER passed to steps 3 and 4.
 * Only ViralGenome (structure + emotionCurve) is passed, never the full text.
 *
 * @param config - Configuration object
 * @param direction - 'auto' uses LLM-selected direction; 'interactive' outputs all directions for user selection
 */
export function buildRecreatePipeline(config: Config, direction: 'auto' | 'interactive' = 'auto'): Pipeline {
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }

  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;

  const viralDeconstruction = new ViralDeconstructionStep(provider, defaultModel);
  const differentiation = new DifferentiationStep(provider, defaultModel);
  const newOutline = new NewOutlineStep(provider, defaultModel);
  const recreationContent = new RecreationContentStep(provider, defaultModel);
  const dualReview = new DualReviewStep(provider, defaultModel);
  const localRewrite = new LocalRewriteStep(provider, defaultModel);

  const baseSteps = [
    viralDeconstruction,
    differentiation,
    newOutline,
    recreationContent,
    dualReview,
  ];

  // localRewrite is inserted AFTER dualReview via resumeFrom when needsLocalRewrite=true.
  // The CLI/resume handler checks dualReview's output and triggers resume if needed.
  const allSteps = [
    viralDeconstruction,
    differentiation,
    newOutline,
    recreationContent,
    dualReview,
    // localRewrite is conditionally inserted — see runWithLocalRewrite
    localRewrite,
  ];

  return new Pipeline({
    name: 'recreate',
    description: 'Recreate a viral article with differentiation + optional element-level optimization',
    steps: allSteps,
  });
}

/**
 * Returns the index of localRewrite step in the pipeline (last step).
 * Used by CLI to determine resume position.
 */
export function getLocalRewriteResumePoint(): string {
  return 'local-rewrite';
}

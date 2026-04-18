import { Pipeline } from '../../core/pipeline.js';
import { llmFactory } from '../../llm/factory.js';
import type { Config } from '../../config/schema.js';
import { PipelineStep } from '../../core/step.js';
import {
  ViralDeconstructionStep,
  DifferentiationStep,
  NewOutlineStep,
  RecreationContentStep,
  DualReviewStep,
  LocalRewriteStep,
  PlatformAdaptationStep,
} from './steps/index.js';

/**
 * Build and return a configured Recreate Pipeline (Scenario B).
 *
 * Key constraint: original article text is NEVER passed to steps 3 and 4.
 * Only ViralGenome (structure + emotionCurve) is passed, never the full text.
 *
 * @param config - Configuration object
 * @param direction - 'auto' uses LLM-selected direction; 'interactive' outputs all directions for user selection
 * @param platforms - Target platforms for adaptation (if empty, no adaptation step is added)
 */
export function buildRecreatePipeline(
  config: Config,
  direction: 'auto' | 'interactive' = 'auto',
  platforms: string[] = [],
): Pipeline {
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

  const allSteps: PipelineStep[] = [
    viralDeconstruction,
    differentiation,
    newOutline,
    recreationContent,
    dualReview,
    localRewrite,
  ];

  // platform-adaptation is added last if platforms are specified
  if (platforms.length > 0) {
    const platformAdaptation = new PlatformAdaptationStep(provider, defaultModel);
    allSteps.push(platformAdaptation);
  }

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

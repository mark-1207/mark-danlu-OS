import { Pipeline } from '../../core/pipeline.js';
import { llmFactory } from '../../llm/factory.js';
import type { Config } from '../../config/schema.js';
import {
  TopicAnalysisStep,
  TopicAssignmentStep,
  OutlineWechatStep,
  OutlineXiaohongshuStep,
  OutlineDouyinStep,
  ContentWechatStep,
  ContentXiaohongshuStep,
  ContentDouyinStep,
  ReviewWechatStep,
  ReviewXiaohongshuStep,
  ReviewDouyinStep,
  MaterialSearchStep,
  ShortAngleSelectionStep,
  ShortContentStep,
  ShortReviewStep,
} from './steps/index.js';

const ALL_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;
type Platform = typeof ALL_PLATFORMS[number];

const PLATFORM_STEP_NAMES = {
  outline: { wechat: 'outline-wechat', xiaohongshu: 'outline-xiaohongshu', douyin: 'outline-douyin' },
  content: { wechat: 'content-wechat', xiaohongshu: 'content-xiaohongshu', douyin: 'content-douyin' },
  review: { wechat: 'review-wechat', xiaohongshu: 'review-xiaohongshu', douyin: 'review-douyin' },
};

export type PlatformSelection = Platform[];

/**
 * Build and return a configured Create Pipeline (Scenario A).
 *
 * @param config - Configuration object
 * @param platforms - Array of platforms to generate for. Defaults to all three.
 *   Example: ['wechat'] or ['wechat', 'douyin']
 */
export function buildCreatePipeline(config: Config, platforms?: PlatformSelection): Pipeline {
  // Get the default provider
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }

  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;

  // Default to all platforms
  const selected: PlatformSelection = platforms?.length ? platforms : [...ALL_PLATFORMS];

  // Shared steps — always run
  const topicAnalysis = new TopicAnalysisStep(provider, defaultModel);
  const topicAssignment = new TopicAssignmentStep(provider, defaultModel);
  const materialSearch = new MaterialSearchStep(provider, defaultModel);

  // Platform-specific steps — only for selected platforms
  const outlineSteps = selected
    .map((p) => {
      if (p === 'wechat') return new OutlineWechatStep(provider, defaultModel);
      if (p === 'xiaohongshu') return new OutlineXiaohongshuStep(provider, defaultModel);
      if (p === 'douyin') return new OutlineDouyinStep(provider, defaultModel);
      return null;
    })
    .filter(Boolean) as (OutlineWechatStep | OutlineXiaohongshuStep | OutlineDouyinStep)[];

  const contentSteps = selected
    .map((p) => {
      if (p === 'wechat') return new ContentWechatStep(provider, defaultModel);
      if (p === 'xiaohongshu') return new ContentXiaohongshuStep(provider, defaultModel);
      if (p === 'douyin') return new ContentDouyinStep(provider, defaultModel);
      return null;
    })
    .filter(Boolean) as (ContentWechatStep | ContentXiaohongshuStep | ContentDouyinStep)[];

  const reviewSteps = selected
    .map((p) => {
      if (p === 'wechat') return new ReviewWechatStep(provider, defaultModel);
      if (p === 'xiaohongshu') return new ReviewXiaohongshuStep(provider, defaultModel);
      if (p === 'douyin') return new ReviewDouyinStep(provider, defaultModel);
      return null;
    })
    .filter(Boolean) as (ReviewWechatStep | ReviewXiaohongshuStep | ReviewDouyinStep)[];

  const allSteps = [
    topicAnalysis,
    topicAssignment,
    ...outlineSteps,
    materialSearch,
    ...contentSteps,
    ...reviewSteps,
  ];

  // Build parallel groups for non-empty groups
  const outlineNames = outlineSteps.map((s) => s.config.name);
  const contentNames = contentSteps.map((s) => s.config.name);
  const reviewNames = reviewSteps.map((s) => s.config.name);

  const parallelGroups = [
    { stepNames: outlineNames, concurrency: 3 },
    { stepNames: ['material-search'], concurrency: 1 },
    { stepNames: contentNames, concurrency: 3 },
    { stepNames: reviewNames, concurrency: 3 },
  ].filter((g) => g.stepNames.length > 0);

  return new Pipeline({
    name: 'create',
    description: 'Generate multi-platform content from a keyword',
    steps: allSteps,
    parallelGroups,
  });
}

/**
 * Build and return a Short Pipeline (--short sub-mode).
 * 4 sequential steps, no parallel groups:
 *   topic-analysis → short-angle-selection → short-content → short-review
 *
 * Skips: topic-assignment, outline, material-search, per-platform content/review.
 */
export function buildShortPipeline(config: Config): Pipeline {
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }

  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;

  const topicAnalysis = new TopicAnalysisStep(provider, defaultModel);
  const shortAngle = new ShortAngleSelectionStep(provider, defaultModel);
  const shortContent = new ShortContentStep(provider, defaultModel);
  const shortReview = new ShortReviewStep(provider, defaultModel);

  return new Pipeline({
    name: 'short',
    description: 'Generate 200-500 char short-form content (--short sub-mode)',
    steps: [topicAnalysis, shortAngle, shortContent, shortReview],
    parallelGroups: [],
  });
}

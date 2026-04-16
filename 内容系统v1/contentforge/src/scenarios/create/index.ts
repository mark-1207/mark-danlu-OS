import { Pipeline } from '../../core/pipeline.js';
import { llmFactory, type ProviderType } from '../../llm/factory.js';
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
} from './steps/index.js';

/**
 * Build and return a configured Create Pipeline (Scenario A).
 *
 * Usage:
 *   const pipeline = buildCreatePipeline(config);
 *   const { context } = await pipeline.run({ keyword: 'AI' }, context);
 */
export function buildCreatePipeline(config: Config): Pipeline {
  // Get the default provider
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }

  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;

  // Instantiate steps
  const topicAnalysis = new TopicAnalysisStep(provider, defaultModel);
  const topicAssignment = new TopicAssignmentStep(provider, defaultModel);

  const outlineWechat = new OutlineWechatStep(provider, defaultModel);
  const outlineXiaohongshu = new OutlineXiaohongshuStep(provider, defaultModel);
  const outlineDouyin = new OutlineDouyinStep(provider, defaultModel);

  // Step 4 — material search (P1, optional/placeholder)
  const materialSearch = new MaterialSearchStep(provider, defaultModel);

  const contentWechat = new ContentWechatStep(provider, defaultModel);
  const contentXiaohongshu = new ContentXiaohongshuStep(provider, defaultModel);
  const contentDouyin = new ContentDouyinStep(provider, defaultModel);

  const reviewWechat = new ReviewWechatStep(provider, defaultModel);
  const reviewXiaohongshu = new ReviewXiaohongshuStep(provider, defaultModel);
  const reviewDouyin = new ReviewDouyinStep(provider, defaultModel);

  return new Pipeline({
    name: 'create',
    description: 'Generate multi-platform content from a keyword',
    steps: [
      topicAnalysis,
      topicAssignment,
      outlineWechat,
      outlineXiaohongshu,
      outlineDouyin,
      materialSearch,
      contentWechat,
      contentXiaohongshu,
      contentDouyin,
      reviewWechat,
      reviewXiaohongshu,
      reviewDouyin,
    ],
    parallelGroups: [
      { stepNames: ['outline-wechat', 'outline-xiaohongshu', 'outline-douyin'], concurrency: 3 },
      { stepNames: ['material-search'], concurrency: 1 },
      { stepNames: ['content-wechat', 'content-xiaohongshu', 'content-douyin'], concurrency: 3 },
      { stepNames: ['review-wechat', 'review-xiaohongshu', 'review-douyin'], concurrency: 3 },
    ],
  });
}

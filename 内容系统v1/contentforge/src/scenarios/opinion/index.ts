/**
 * Opinion scenario entry point.
 * Handles opinion/thought-based content generation:
 *   Input: an opinion/idea/thought
 *   Flow:  opinion-refine (HKR质检+证伪+推荐标题)
 *       → opinion-review (用户确认论点+选标题+注入案例)
 *       →汇入现有 pipeline(topic-assignment → outline → content → review)
 */
import { logger } from '../../utils/logger.js';
import { PipelineContext } from '../../core/context.js';
import { loadConfig } from '../../config/loader.js';
import { LLMProviderFactory } from '../../llm/factory.js';
import { OpinionRefineStep } from './steps/opinion-refine.js';
import { confirmOpinion } from './ui/opinion-review.js';
import type { ConfirmedOpinion } from './types.js';
import { validateRefinedOpinion, validateConfirmedOpinion } from './types.js';
import chalk from 'chalk';

export interface RunOpinionOptions {
  platforms?: string[];
  interactive?: boolean;
  phase?: 'full' | 'refine' | 'review' | 'content' | 'review-only';
  runId?: string;
}

export async function runOpinion(
  opinion: string,
  options: RunOpinionOptions = {},
): Promise<void> {
  // ── Phase: content (resume from confirmed-opinion.json) ──────────
  if (options.phase === 'content') {
    if (!options.runId) {
      throw new Error('opinion --phase content requires --run-id');
    }
    const { resumeOpinionContent } = await import('./run-opinion-content.js');
    await resumeOpinionContent(options.runId);
    return;
  }

  const runId = `opinion_${Date.now()}`;
  const config = await loadConfig();
  const llmFactory = new LLMProviderFactory({});
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = config.providers[config.defaultProvider]?.defaultModel ?? 'mimo-v2-flash';
  const context = new PipelineContext('opinion', `${process.cwd()}/output/${runId}`, runId);
  const platform = options.platforms?.[0] ?? 'wechat';

  // ── Step 1: opinion-refine ────────────────────────────────────────
  logger.info(`[opinion] refining: "${opinion}"`);
  const step = new OpinionRefineStep(provider, defaultModel);
  const refineResult = await step.execute({ opinion }, context);

  if (!refineResult.success) {
    throw new Error(`opinion-refine failed: ${refineResult.error ?? 'unknown'}`);
  }
  let refined = validateRefinedOpinion(refineResult.data);
  context.set('refined-opinion', refined);

  // ── Step 2: opinion-review (user interaction, with regeneration loop) ──
  let confirmed: ConfirmedOpinion | null = null;
  let regenerate = false;

  do {
    const reviewResult = await confirmOpinion(refined, platform);
    confirmed = validateConfirmedOpinion(reviewResult.confirmed);
    if (reviewResult.regenerate) {
      // Re-run opinion-refine with same opinion
      logger.info('[opinion] regenerating opinion-refine...');
      const retryResult = await step.execute({ opinion }, context);
      if (!retryResult.success) throw new Error(`opinion-refine retry failed: ${retryResult.error}`);
      const newRefined = validateRefinedOpinion(retryResult.data);
      context.set('refined-opinion', newRefined);
      refined = newRefined;
    }
  } while (!confirmed);

  context.set('confirmed-opinion', confirmed);
  if (confirmed.seedMaterial) {
    context.set(`outline-seed-material-${platform}`, confirmed.seedMaterial);
  }

  // ── Step 3: build topic-analysis compatible artifact ───────────────
  // opinion文章不需要多角度发散，直接用精炼后的论点作为keyword
  context.set('topic-analysis', {
    keyword: confirmed.refinedThesis,
    subTopics: [], // 观点文单点深挖，不需要多角度
    // 兼容字段
    painPoints: [],
    trendingAngles: [],
    controversies: [],
    targetDemographics: [],
  });

  // 已有标题，直接注入 confirmed-title
  context.set(`confirmed-title-${platform}`, confirmed.confirmedTitle);
  context.set(`confirmed-outline-${platform}`, {
    title: confirmed.confirmedTitle,
    caseDirection: '',
    structureType: '递进式',
    seedMaterial: confirmed.personalCase || '',
  });

  await context.persist();

  logger.info(`[opinion] confirmed title: "${confirmed.confirmedTitle}"`);
  logger.info(`[opinion] context persisted, runId=${runId}`);
  logger.info('[opinion] ready to continue from topic-assignment. Run with --phase content --run-id', runId);
  console.log(chalk.green(`\n✅ 观点已确认，标题: ${confirmed.confirmedTitle}\n`));
  console.log(chalk.dim(`继续生成内容: node dist/index.js opinion --phase content --run-id ${runId}\n`));
}

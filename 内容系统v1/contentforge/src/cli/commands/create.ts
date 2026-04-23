import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { buildCreatePipeline, type PlatformSelection } from '../../scenarios/create/index.js';
import type {
  ReviewResult,
  TopicAnalysis,
  TopicAnalysisReview,
  TopicAssignmentConfirmed,
  PlatformSelectionConfirmed,
} from '../../scenarios/create/types.js';
import { PipelineContext } from '../../core/context.js';
import { setupRunLogger } from '../../utils/logger.js';
import { logger } from '../../utils/logger.js';
import { ProgressDisplay } from '../ui/progress.js';
import { estimateCost } from '../../utils/token-counter.js';
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
import { sanitizeFilename } from '../../utils/sanitize.js';
import {
  reviewTopicAnalysis,
  reviewTopicAssignment,
  type TopicAssignmentDisplay,
} from '../ui/topic-review.js';
import {
  TopicAnalysisStep,
  TopicAssignmentStep,
  OutlineWechatStep,
  OutlineXiaohongshuStep,
  OutlineDouyinStep,
  MaterialSearchStep,
  ContentWechatStep,
  ContentXiaohongshuStep,
  ContentDouyinStep,
  ReviewWechatStep,
  ReviewXiaohongshuStep,
  ReviewDouyinStep,
} from '../../scenarios/create/steps/index.js';

const VALID_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

// ─── Helper: buildTopicAnalysisReview ─────────────────────────────────────────

function buildTopicAnalysisReview(ta: TopicAnalysis): TopicAnalysisReview {
  const subTopics = ta.subTopics.map((s, i) => ({
    index: i,
    name: s.name,
    description: s.description,
    heatLevel: s.heatLevel,
    decision: s.heatLevel === 'low' ? ('confirmed' as const) : ('pending' as const),
  }));
  const controversies = ta.controversies.map((c, i) => ({
    index: i,
    topic: c.topic,
    sideA: c.sideA,
    sideB: c.sideB,
    decision: 'pending' as const,
  }));
  const trendingAngles = ta.trendingAngles.map((a, i) => ({
    index: i,
    angle: a.angle,
    whyTrending: a.whyTrending,
    suitablePlatforms: a.suitablePlatforms,
    decision: 'pending' as const,
  }));
  const painPoints = ta.painPoints.map((p, i) => ({ index: i, ...p, decision: 'confirmed' as const }));
  const targetDemographics = ta.targetDemographics.map((d, i) => ({ index: i, ...d, decision: 'confirmed' as const }));
  return { keyword: ta.keyword, subTopics, painPoints, trendingAngles, controversies, targetDemographics };
}

// ─── Main run function ─────────────────────────────────────────────────────────

export async function runCreate(
  keyword: string,
  options: { platforms?: string; context?: string; interactive?: boolean },
): Promise<void> {
  // Parse and validate platforms
  let selectedPlatforms: PlatformSelection | undefined;
  if (options.platforms) {
    const raw = options.platforms.split(',').map((p) => p.trim().toLowerCase());
    const invalid = raw.filter((p) => !VALID_PLATFORMS.includes(p as typeof VALID_PLATFORMS[number]));
    if (invalid.length) {
      console.error(chalk.red(`错误: 无效平台 ${invalid.join(', ')}，有效值: ${VALID_PLATFORMS.join(', ')}`));
      process.exit(1);
    }
    selectedPlatforms = raw as PlatformSelection;
  }

  // Load config
  const config = await loadConfig();
  setCachedConfig(config);

  // Register providers
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const outputDir = config.output?.dir ?? './output';
  const runId = `create_${Date.now()}`;
  const runDir = path.resolve(outputDir, runId);

  await fs.mkdir(runDir, { recursive: true });
  await setupRunLogger(runDir);

  // Acquire run lock to prevent concurrent resume conflicts
  await acquireRunLock(runId, outputDir);

  const context = new PipelineContext('create', runDir, runId);

  const platformList = selectedPlatforms
    ? selectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(' / ')
    : '全部';

  console.log(chalk.bold('\n🔨 ContentForge — 原创生成\n'));
  console.log(`关键词: ${keyword}`);
  console.log(`平台: ${platformList}\n`);

  // Auto-detect TTY: if not explicitly disabled and stdin is a TTY, enable interactive
  const isInteractive = options.interactive !== false && process.stdin.isTTY;

  // Get provider and model for direct step execution
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;

  if (isInteractive) {
    // ─── Interactive flow ───────────────────────────────────────────────────────

    try {
      const progress = new ProgressDisplay();

      // ── Step 1: Topic Analysis → TUI ──────────────────────────────────────────
      progress.startStep('topic-analysis', '主题深挖');
      const topicStep = new TopicAnalysisStep(provider, defaultModel);
      const ctx1 = new PipelineContext('create', runDir, runId + '_ta');
      const taResult = await topicStep.execute({ keyword, userContext: options.context }, ctx1);
      if (!taResult.success) {
        throw new Error(`Topic analysis failed: ${taResult.error ?? 'unknown'}`);
      }
      let topicAnalysisResult = taResult.data! as TopicAnalysis;

      // Build review data and show TUI Step 1
      let reviewData = buildTopicAnalysisReview(topicAnalysisResult);
      let currentExcludeDirections: string[] = [];
      const { selectedIndices, excludeDirections, extraDirections } = await reviewTopicAnalysis(reviewData, async (group) => {
        // Re-run topic-analysis with excludeDirections
        progress.startStep('topic-analysis-rewrite', '重新分析');
        currentExcludeDirections = [...currentExcludeDirections, ...extraDirections];
        const ctx2 = new PipelineContext('create', runDir, runId + '_ta2');
        const newResult = await topicStep.execute(
          { keyword, userContext: options.context, excludeDirections: currentExcludeDirections },
          ctx2,
        );
        if (!newResult.success) {
          throw new Error(`Topic analysis rewrite failed: ${newResult.error ?? 'unknown'}`);
        }
        progress.completeStep('topic-analysis-rewrite', newResult.durationMs, '');
        return buildTopicAnalysisReview(newResult.data! as TopicAnalysis);
      });
      progress.completeStep('topic-analysis', taResult.durationMs, `tokens: +${taResult.tokenUsage.output}`);

      // Rebuild topicAnalysisResult from reviewData subTopics (which reflect any rewrite)
      topicAnalysisResult = {
        keyword: reviewData.keyword,
        subTopics: reviewData.subTopics.map((s) => ({
          name: s.name,
          description: s.description,
          heatLevel: s.heatLevel,
        })),
        painPoints: topicAnalysisResult.painPoints,
        trendingAngles: topicAnalysisResult.trendingAngles,
        controversies: topicAnalysisResult.controversies,
        targetDemographics: topicAnalysisResult.targetDemographics,
      };

      // Store confirmed topic analysis in context
      context.set('topic-analysis', topicAnalysisResult);
      context.set('topic-analysis-confirmed', {
        topicAnalysis: topicAnalysisResult,
        excludeDirections,
        extraDirections,
      });

      // ── Step 2: Topic Assignment → TUI ────────────────────────────────────────
      progress.startStep('topic-assignment', '话题分配');
      const taStep = new TopicAssignmentStep(provider, defaultModel);
      const taAssignResult = await taStep.execute({}, context);
      if (!taAssignResult.success) {
        throw new Error(`Topic assignment failed: ${taAssignResult.error ?? 'unknown'}`);
      }
      const platformAssignmentsResult = taAssignResult.data! as import('../../scenarios/create/types.js').PlatformAssignments;

      // Build display data for TUI Step 2
      const displayData: TopicAssignmentDisplay = {
        wechat: {
          angle: platformAssignmentsResult.wechat.angle,
          titles: platformAssignmentsResult.wechat.titleDrafts,
          selectedIndex: 0,
        },
        xiaohongshu: {
          angle: platformAssignmentsResult.xiaohongshu.angle,
          titles: platformAssignmentsResult.xiaohongshu.titleDrafts,
          selectedIndex: 0,
        },
        douyin: {
          angle: platformAssignmentsResult.douyin.angle,
          titles: platformAssignmentsResult.douyin.titleDrafts,
          selectedIndex: 0,
        },
      };
      const selections = await reviewTopicAssignment(displayData);
      progress.completeStep('topic-assignment', taAssignResult.durationMs, `tokens: +${taAssignResult.tokenUsage.output}`);

      // Store confirmed topic assignment in context
      context.set('topic-assignment', platformAssignmentsResult);
      context.set('topic-assignment-confirmed', {
        topicAssignment: platformAssignmentsResult,
        selections,
      });

      // Write confirmed title per platform so outline steps can read it
      const allPlatforms = selectedPlatforms ?? (['wechat', 'xiaohongshu', 'douyin'] as const);
      for (const platform of allPlatforms) {
        const sel = selections[platform as keyof typeof selections];
        if (sel) {
          context.set(`confirmed-title-${platform}`, sel.title);
          if (sel.angleOverride) {
            context.set(`angle-override-${platform}`, sel.angleOverride);
          }
        }
      }
      await context.persist();

      // ── Remaining steps: run outline → material-search → content → review ─────
      // The context already has topic-analysis, topic-analysis-confirmed,
      // topic-assignment, topic-assignment-confirmed, and confirmed-title-* set.

      const platformsToRun = allPlatforms;

      // Step 3: Outlines (parallel)
      progress.startStep('outline-wechat', '大纲-公众号');
      progress.startStep('outline-xiaohongshu', '大纲-小红书');
      progress.startStep('outline-douyin', '大纲-抖音');

      const outlineSteps = platformsToRun.map((p) => {
        if (p === 'wechat') return new OutlineWechatStep(provider, defaultModel);
        if (p === 'xiaohongshu') return new OutlineXiaohongshuStep(provider, defaultModel);
        if (p === 'douyin') return new OutlineDouyinStep(provider, defaultModel);
        return null;
      }).filter(Boolean) as (OutlineWechatStep | OutlineXiaohongshuStep | OutlineDouyinStep)[];

      const outlineResults = await Promise.all(outlineSteps.map((step) => step.execute({}, context)));
      for (let i = 0; i < outlineSteps.length; i++) {
        const r = outlineResults[i];
        context.setStepResult(outlineSteps[i].config.name, r);
        if (r.success && r.data !== undefined) {
          context.set(outlineSteps[i].config.name, r.data);
        }
        if (r.success) {
          progress.completeStep(outlineSteps[i].config.name, r.durationMs, '');
        } else {
          progress.failStep(outlineSteps[i].config.name, r.error ?? 'unknown');
        }
      }

      // Step 4: Material Search
      progress.startStep('material-search', '素材搜索');
      const matStep = new MaterialSearchStep(provider, defaultModel);
      const matResult = await matStep.execute({}, context);
      context.setStepResult('material-search', matResult);
      if (matResult.success && matResult.data !== undefined) {
        context.set('material-search', matResult.data);
      }
      if (matResult.success) {
        progress.completeStep('material-search', matResult.durationMs, '');
      } else {
        progress.failStep('material-search', matResult.error ?? 'unknown');
      }

      // Step 5: Content Generation (parallel)
      progress.startStep('content-wechat', '内容-公众号');
      progress.startStep('content-xiaohongshu', '内容-小红书');
      progress.startStep('content-douyin', '内容-抖音');

      const contentSteps = platformsToRun.map((p) => {
        if (p === 'wechat') return new ContentWechatStep(provider, defaultModel);
        if (p === 'xiaohongshu') return new ContentXiaohongshuStep(provider, defaultModel);
        if (p === 'douyin') return new ContentDouyinStep(provider, defaultModel);
        return null;
      }).filter(Boolean) as (ContentWechatStep | ContentXiaohongshuStep | ContentDouyinStep)[];

      const contentResults = await Promise.all(contentSteps.map((step) => step.execute({}, context)));
      for (let i = 0; i < contentSteps.length; i++) {
        const r = contentResults[i];
        context.setStepResult(contentSteps[i].config.name, r);
        if (r.success && r.data !== undefined) {
          context.set(contentSteps[i].config.name, r.data);
        }
        if (r.success) {
          progress.completeStep(contentSteps[i].config.name, r.durationMs, '');
        } else {
          progress.failStep(contentSteps[i].config.name, r.error ?? 'unknown');
        }
      }

      // Step 6: Review (parallel)
      progress.startStep('review-wechat', '审核-公众号');
      progress.startStep('review-xiaohongshu', '审核-小红书');
      progress.startStep('review-douyin', '审核-抖音');

      const reviewSteps = platformsToRun.map((p) => {
        if (p === 'wechat') return new ReviewWechatStep(provider, defaultModel);
        if (p === 'xiaohongshu') return new ReviewXiaohongshuStep(provider, defaultModel);
        if (p === 'douyin') return new ReviewDouyinStep(provider, defaultModel);
        return null;
      }).filter(Boolean) as (ReviewWechatStep | ReviewXiaohongshuStep | ReviewDouyinStep)[];

      const reviewResults = await Promise.all(reviewSteps.map((step) => step.execute({}, context)));
      for (let i = 0; i < reviewSteps.length; i++) {
        const r = reviewResults[i];
        context.setStepResult(reviewSteps[i].config.name, r);
        if (r.success && r.data !== undefined) {
          context.set(reviewSteps[i].config.name, r.data);
        }
        if (r.success) {
          progress.completeStep(reviewSteps[i].config.name, r.durationMs, '');
        } else {
          progress.failStep(reviewSteps[i].config.name, r.error ?? 'unknown');
        }
      }
      // Persist final context (after all steps succeeded)
      await context.persist();

      // Write output files
      for (const platform of platformsToRun) {
        const reviewResult = context.get<ReviewResult>(`review-${platform}`);
        if (!reviewResult) continue;
        const { recommendedTitle, revisedContent } = reviewResult;
        const safeTitle = sanitizeFilename(recommendedTitle);
        const ext = platform === 'xiaohongshu' ? 'xhs.md' : `${platform}.md`;
        await fs.writeFile(path.join(runDir, `${safeTitle}.${ext}`), revisedContent, 'utf-8');
      }

      // Summarize
      const tokenUsage = context.getTotalTokenUsage();
      const cost = estimateCost(tokenUsage.input, tokenUsage.output);
      console.log(chalk.bold('\n✅ 生成完成\n'));
      console.log(`输出目录: ${runDir}`);
      console.log(`总 token: input=${tokenUsage.input} output=${tokenUsage.output}`);
      console.log(`预估成本: $${cost.toFixed(4)}\n`);
      const files = await fs.readdir(runDir);
      console.log('生成文件:');
      for (const file of files) {
        if (file !== 'run.log') {
          console.log(`  - ${file}`);
        }
      }
    } finally {
      await releaseRunLock(runId, outputDir);
    }
  } else {
    // ─── Non-interactive flow: run full pipeline ──────────────────────────────
    const pipeline = buildCreatePipeline(config, selectedPlatforms);
    const progress = new ProgressDisplay();

    pipeline.onStepComplete((stepName, result) => {
      if (result.success) {
        progress.completeStep(stepName, result.durationMs, `tokens: +${result.tokenUsage.output}`);
      } else {
        progress.failStep(stepName, result.error ?? 'unknown error');
      }
    });

    const input = { keyword, userContext: options.context };
    progress.startStep('topic-analysis', '主题深挖');

    let finalContext: PipelineContext;
    try {
      const result = await pipeline.run(input, context);
      finalContext = result.context;
    } finally {
      await releaseRunLock(runId, outputDir);
    }

    // Write output files
    const platformNames = selectedPlatforms ?? (['wechat', 'xiaohongshu', 'douyin'] as const);
    for (const platform of platformNames) {
      const reviewResult = finalContext.get<ReviewResult>(`review-${platform}`);
      if (!reviewResult) continue;
      const { recommendedTitle, revisedContent } = reviewResult;
      const safeTitle = sanitizeFilename(recommendedTitle);
      const ext = platform === 'xiaohongshu' ? 'xhs.md' : `${platform}.md`;
      await fs.writeFile(path.join(runDir, `${safeTitle}.${ext}`), revisedContent, 'utf-8');
    }

    // Summarize
    const tokenUsage = finalContext.getTotalTokenUsage();
    const cost = estimateCost(tokenUsage.input, tokenUsage.output);
    console.log(chalk.bold('\n✅ 生成完成\n'));
    console.log(`输出目录: ${runDir}`);
    console.log(`总 token: input=${tokenUsage.input} output=${tokenUsage.output}`);
    console.log(`预估成本: $${cost.toFixed(4)}\n`);
    const files = await fs.readdir(runDir);
    console.log('生成文件:');
    for (const file of files) {
      if (file !== 'run.log') {
        console.log(`  - ${file}`);
      }
    }
  }
}

// ─── Command registration ───────────────────────────────────────────────────────

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('从关键词生成原创内容')
    .requiredOption('-k, --keyword <text>', '关键词或主题')
    .option('-p, --platforms <list>', `平台列表 (逗号分隔，可选: wechat,xiaohongshu,douyin，默认全部)`)
    .option('-c, --context <text>', '用户补充说明')
    .option('--no-interactive', '跳过选题确认，直接全自动生成')
    .action(async (opts) => {
      try {
        // interactive defaults to true unless --no-interactive is passed
        const interactive = opts.interactive !== false;
        await runCreate(opts.keyword, {
          platforms: opts.platforms,
          context: opts.context,
          interactive,
        });
      } catch (error) {
        logger.error('create command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}
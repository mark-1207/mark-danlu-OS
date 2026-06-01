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
import { askPostGen } from '../../scenarios/revision/cli/post-gen-prompt.js';
import { RevisionPipeline } from '../../scenarios/revision/index.js';
import { getObsidianWriter } from '../../io/obsidian/writer.js';

const VALID_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

// ─── Cleanup: keep only final outputs ─────────────────────────────────────────

/**
 * Remove intermediate pipeline artifacts, keeping only:
 * - Final .md content files
 * - run-meta.json (required for resume)
 * - run.log (useful for debugging)
 */
export async function cleanupIntermediateFiles(runDir: string): Promise<void> {
  const KEEP = new Set(['run-meta.json', 'run.log']);
  const files = await fs.readdir(runDir);
  await Promise.all(
    files
      .filter((f) => {
        if (KEEP.has(f)) return false;
        if (f.endsWith('.md')) return false;
        if (f.startsWith('confirmed-outline-')) return false;
        if (f.startsWith('outline-seed-material-')) return false;
        return true;
      })
      .map((f) => fs.unlink(path.join(runDir, f))),
  );
}

/**
 * Write generated articles back to Obsidian vault (if configured).
 */
async function writeArticlesToObsidian(
  context: PipelineContext,
  platforms: string[],
): Promise<void> {
  const { getCachedConfig } = await import('../../config/loader.js');
  const config = getCachedConfig();
  const obsidianConfig = config.obsidian;
  if (!obsidianConfig?.vaultPath) return;

  const writer = getObsidianWriter(obsidianConfig.vaultPath, obsidianConfig.writeDir);
  const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');

  for (const platform of platforms) {
    const reviewResult = context.get<ReviewResult>(`review-${platform}`);
    if (!reviewResult) continue;

    try {
      const filePath = await writer.writeArticle({
        title: reviewResult.recommendedTitle,
        content: reviewResult.revisedContent,
        platform,
        topics: topicAnalysis?.subTopics?.map((s) => s.name) ?? [],
        keyword: topicAnalysis?.keyword,
      });
      logger.info(`[create] article synced to Obsidian: ${filePath}`);
    } catch (err) {
      logger.warn(`[create] failed to write ${platform} article to Obsidian:`, String(err));
    }
  }
}

// ─── Phase: outline-only generation ────────────────────────────────────────────

interface OutlinePhaseParams {
  keyword: string;
  userContext: string | undefined;
  allPlatforms: readonly string[];
  provider: any;
  defaultModel: string;
  context: PipelineContext;
  runId: string;
  runDir: string;
  outputDir: string;
}

async function generateOutlinePhase(params: OutlinePhaseParams): Promise<void> {
  const { keyword, userContext, allPlatforms, provider, defaultModel, context, runId, runDir, outputDir } = params;
  const progress = new ProgressDisplay();

  // Step 1: Topic Analysis
  progress.startStep('topic-analysis', '主题深挖');
  const topicStep = new TopicAnalysisStep(provider, defaultModel);
  const taResult = await topicStep.execute({ keyword, userContext }, context);
  if (!taResult.success) throw new Error(`Topic analysis failed: ${taResult.error}`);
  context.set('topic-analysis', taResult.data);
  context.setStepResult('topic-analysis', taResult);
  progress.completeStep('topic-analysis', taResult.durationMs, `tokens: +${taResult.tokenUsage.output}`);

  // Step 2: Topic Assignment
  progress.startStep('topic-assignment', '话题分配');
  const taStep = new TopicAssignmentStep(provider, defaultModel);
  const taAssignResult = await taStep.execute({}, context);
  if (!taAssignResult.success) throw new Error(`Topic assignment failed: ${taAssignResult.error}`);
  context.set('topic-assignment', taAssignResult.data);
  context.setStepResult('topic-assignment', taAssignResult);
  progress.completeStep('topic-assignment', taAssignResult.durationMs, `tokens: +${taAssignResult.tokenUsage.output}`);

  // Step 3: Outlines (parallel per platform)
  const outlineStepMap: Record<string, any> = {
    wechat: OutlineWechatStep,
    xiaohongshu: OutlineXiaohongshuStep,
    douyin: OutlineDouyinStep,
  };
  for (const p of allPlatforms) {
    progress.startStep(`outline-${p}`, `大纲-${PLATFORM_LABELS[p] ?? p}`);
  }
  const outlineResults = await Promise.all(
    allPlatforms.map(async (p) => {
      const StepClass = outlineStepMap[p];
      if (!StepClass) return { platform: p, result: null };
      const step = new StepClass(provider, defaultModel);
      const result = await step.execute({}, context);
      context.setStepResult(`outline-${p}`, result);
      if (result.success && result.data !== undefined) {
        context.set(`outline-${p}`, result.data);
      }
      return { platform: p, result };
    }),
  );
  for (const { platform: p, result } of outlineResults) {
    if (result && result.success) {
      progress.completeStep(`outline-${p}`, result.durationMs, '');
    } else if (result) {
      progress.failStep(`outline-${p}`, result.error ?? 'unknown');
    }
  }

  // Persist everything to disk
  await context.persist();

  // Print structured outline summary for Claude Code to parse
  printOutlineSummary(context, runId, [...allPlatforms], keyword);

  await releaseRunLock(runId, outputDir);
  console.log(chalk.dim(`\n[phase=outline] runId=${runId} — outline ready, awaiting confirmation`));
}

function printOutlineSummary(
  context: PipelineContext,
  runId: string,
  platforms: string[],
  keyword: string,
): void {
  // Layer 1: Topic Analysis
  const topicAnalysis = context.get<any>('topic-analysis');
  const subTopics = (topicAnalysis?.subTopics ?? []).map((s: any) => ({
    name: s.name,
    description: s.description,
    heatLevel: s.heatLevel,
  }));
  const painPoints = (topicAnalysis?.painPoints ?? []).map((p: any) => ({
    description: p.description ?? p,
    severity: p.severity ?? p.intensity,
  }));
  const trendingAngles = (topicAnalysis?.trendingAngles ?? []).map((a: any) => ({
    angle: a.angle ?? a,
    competitiveLandscape: a.competitiveLandscape ?? a.heat,
  }));
  const controversies = (topicAnalysis?.controversies ?? []).map((c: any) => ({
    description: c.description ?? c,
  }));

  // Layer 2: Topic Assignment (per platform)
  const assignments = context.get<any>('topic-assignment');
  const platformCards: Record<string, any> = {};
  for (const platform of platforms) {
    const card = assignments?.[platform];
    if (card) {
      platformCards[platform] = {
        angle: card.angle,
        titleDrafts: card.titleDrafts ?? [],
        keyPoints: card.keyPoints ?? [],
      };
    }
  }

  // Layer 3: Outlines (per platform)
  const outlineData: Record<string, any> = {};
  for (const platform of platforms) {
    const outline = context.get<any>(`outline-${platform}`);
    const data: any = { ...platformCards[platform] };
    if (platform === 'wechat' && outline?.sections) {
      data.sections = outline.sections.map((s: any) => ({
        title: s.title,
        purpose: s.purpose,
        caseSlot: s.caseSlot,
      }));
    }
    if (platform === 'xiaohongshu' && outline?.tips) {
      data.tips = outline.tips.map((t: any) => ({ title: t.title, description: t.description }));
    }
    if (platform === 'douyin' && outline?.hook3s) {
      data.hook = outline.hook3s.script?.slice(0, 80);
      data.corePoint = outline.corePoint?.statement;
    }
    outlineData[platform] = data;
  }

  console.log(chalk.bold('\n=== OUTLINE_SUMMARY_START ==='));
  console.log(JSON.stringify({
    runId,
    phase: 'outline',
    keyword,
    platforms,
    topicAnalysis: { subTopics, painPoints, trendingAngles, controversies },
    platformCards,
    outlines: outlineData,
  }));
  console.log(chalk.bold('=== OUTLINE_SUMMARY_END ==='));
}

// ─── Phase: material-gap (material search + gap analysis) ─────────────────────

async function materialGapPhase(params: OutlinePhaseParams): Promise<void> {
  const { allPlatforms, provider, defaultModel, context, runId, runDir, outputDir } = params;
  const progress = new ProgressDisplay();

  // Run material-search for each platform
  for (const p of allPlatforms) {
    progress.startStep(`material-search-${p}`, `素材搜索-${PLATFORM_LABELS[p] ?? p}`);
  }
  const searchStep = new MaterialSearchStep(provider, defaultModel);
  const searchResult = await searchStep.execute({}, context);
  context.setStepResult('material-search', searchResult);
  if (searchResult.success && searchResult.data !== undefined) {
    context.set('material-search', searchResult.data);
  }
  for (const p of allPlatforms) {
    progress.completeStep(`material-search-${p}`, searchResult.durationMs, '');
  }

  await context.persist();

  // Output gap analysis JSON
  const materials = context.get<any>('material-search');
  const userMaterials: Record<string, string> = {};
  for (const p of allPlatforms) {
    const um = context.get<string>(`user-materials-${p}`);
    if (um) userMaterials[p] = um;
  }
  console.log(chalk.bold('\n=== MATERIAL_GAP_START ==='));
  console.log(JSON.stringify({
    runId,
    phase: 'material-gap',
    foundMaterials: materials ?? {},
    userMaterials,
    nextPhase: 'content-draft',
  }));
  console.log(chalk.bold('=== MATERIAL_GAP_END ==='));

  await releaseRunLock(runId, outputDir);
  console.log(chalk.dim(`\n[phase=material-gap] runId=${runId} — materials ready, awaiting confirmation`));
}

// ─── Phase: content-draft (generate content per platform) ─────────────────────

async function contentDraftPhase(
  keyword: string,
  runId: string,
  outputDir: string,
  options: { keepArtifacts?: boolean },
): Promise<void> {
  const runDir = path.resolve(outputDir, runId);
  const context = await PipelineContext.restore(runId, outputDir);

  const config = await loadConfig();
  setCachedConfig(config);
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  await setupRunLogger(runDir);
  await acquireRunLock(runId, outputDir);

  const meta = JSON.parse(await fs.readFile(path.join(runDir, 'run-meta.json'), 'utf-8'));
  const allPlatforms: string[] = meta.completedSteps
    .filter((s: string) => s.startsWith('outline-'))
    .map((s: string) => s.replace('outline-', ''));
  const providerConfig = config.providers[config.defaultProvider];
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;
  const pipeline = buildCreatePipeline(config, allPlatforms as PlatformSelection);
  const progress = new ProgressDisplay();

  // Run content generation for each platform
  const contentStepMap: Record<string, any> = {
    wechat: ContentWechatStep,
    xiaohongshu: ContentXiaohongshuStep,
    douyin: ContentDouyinStep,
  };

  for (const p of allPlatforms) {
    progress.startStep(`content-${p}`, `内容生成-${PLATFORM_LABELS[p] ?? p}`);
    // Run content step directly (read confirmed-outline from context)
    const StepClass = contentStepMap[p];
    if (!StepClass) continue;
    const step = new StepClass(provider, defaultModel);
    const r = await step.execute({}, context);
    context.setStepResult(`content-${p}`, r);
    if (r.success && r.data !== undefined) {
      context.set(`content-${p}`, r.data);
    }
    progress.completeStep(`content-${p}`, r.durationMs, `tokens: +${r.tokenUsage.output}`);
  }

  await context.persist();

  // Output content drafts as JSON
  const drafts: Record<string, any> = {};
  for (const p of allPlatforms) {
    const content = context.get<string>(`content-${p}`);
    drafts[p] = { content };
  }
  console.log(chalk.bold('\n=== CONTENT_DRAFT_START ==='));
  console.log(JSON.stringify({ runId, phase: 'content-draft', drafts, nextPhase: 'review' }));
  console.log(chalk.bold('=== CONTENT_DRAFT_END ==='));

  await releaseRunLock(runId, outputDir);
  console.log(chalk.dim(`\n[phase=content-draft] runId=${runId} — drafts ready, awaiting confirmation`));
}

// ─── Phase: content (resume from outline) ──────────────────────────────────────

async function resumeFromOutline(
  keyword: string,
  runId: string,
  outputDir: string,
  options: { keepArtifacts?: boolean },
): Promise<void> {
  const runDir = path.resolve(outputDir, runId);

  // Restore saved context (all artifacts including non-step keys)
  const context = await PipelineContext.restore(runId, outputDir);

  // Persist restored context so confirmed-outline-* and outline-seed-material-*
  // artifacts survive cleanup at the end of the run
  await context.persist();

  // Re-load config and providers
  const config = await loadConfig();
  setCachedConfig(config);
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  await setupRunLogger(runDir);
  await acquireRunLock(runId, outputDir);

  const meta = JSON.parse(await fs.readFile(path.join(runDir, 'run-meta.json'), 'utf-8'));
  const allPlatforms: string[] = meta.completedSteps
    .filter((s: string) => s.startsWith('outline-'))
    .map((s: string) => s.replace('outline-', ''));

  const platformList = allPlatforms.map((p: string) => PLATFORM_LABELS[p] ?? p).join(' / ');
  console.log(chalk.bold('\n🔨 ContentForge — 原创生成（续）\n'));
  console.log(`关键词: ${keyword}`);
  console.log(`平台: ${platformList}`);
  console.log(`Run: ${runId}\n`);

  // Build pipeline and resume from material-search
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) throw new Error(`Provider '${config.defaultProvider}' not found`);
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;
  const pipeline = buildCreatePipeline(config, allPlatforms as PlatformSelection);

  const progress = new ProgressDisplay();
  pipeline.onStepComplete((stepName, result) => {
    if (result.success) {
      progress.completeStep(stepName, result.durationMs, `tokens: +${result.tokenUsage.output}`);
    } else {
      progress.failStep(stepName, result.error ?? 'unknown error');
    }
  });

  // Determine resume starting point based on phase
  const res = options as any;
  let startIndex = 0;
  if (res.phase === 'content-draft' as any) startIndex = 1; // skip material-search
  if (res.phase === 'review' as any) startIndex = 2;       // skip to review only

  // Resume each remaining group: material-search → content-* → review-*
  // resumeFrom only runs a single parallel group, so we chain them
  const allGroups = [
    'material-search',   // search materials
    'content-wechat',    // generate content (parallel per platform)
    'review-wechat',     // review content (parallel per platform)
  ];
  const remainingGroups = allGroups.slice(startIndex);
  let finalContext = context;
  for (const resumeStep of remainingGroups) {
    const result = await pipeline.resumeFrom(resumeStep, finalContext);
    finalContext = result.context;
    if (!result.success) {
      console.error(chalk.red(`\n❌ 管道在 ${resumeStep} 执行失败\n`));
      await releaseRunLock(runId, outputDir);
      return;
    }
  }

  // Write output files
  for (const platform of allPlatforms) {
    const reviewResult = finalContext.get<ReviewResult>(`review-${platform}`);
    if (!reviewResult) continue;
    const { recommendedTitle, revisedContent } = reviewResult;
    const safeTitle = sanitizeFilename(recommendedTitle);
    const ext = platform === 'xiaohongshu' ? 'xhs.md' : `${platform}.md`;
    await fs.writeFile(path.join(runDir, `${safeTitle}.${ext}`), revisedContent, 'utf-8');
  }

  // Cleanup
  if (!options.keepArtifacts) {
    await cleanupIntermediateFiles(runDir);
  }

  // Sync to Obsidian
  await writeArticlesToObsidian(finalContext, [...allPlatforms]);

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
    console.log(`  - ${file}`);
  }

  await releaseRunLock(runId, outputDir);
}

// ─── Helper: buildTopicAnalysisReview ─────────────────────────────────────────

function buildTopicAnalysisReview(ta: TopicAnalysis): TopicAnalysisReview {
  // All subTopics default to pending — user decides everything (no pre-confirmed)
  const subTopics = ta.subTopics.map((s, i) => ({
    index: i,
    name: s.name,
    description: s.description,
    heatLevel: s.heatLevel,
    decision: 'pending' as const,
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
  options: {
    platforms?: string;
    context?: string;
    interactive?: boolean;
    keepArtifacts?: boolean;
    phase?: 'full' | 'outline' | 'material-gap' | 'content-draft' | 'content' | 'review';
    runId?: string;
  },
): Promise<void> {
  // Load config first (needed for all phases)
  const config = await loadConfig();
  setCachedConfig(config);

  // Register providers
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const outputDir = config.output?.dir ?? './output';

  // ─── Phase: resume modes (need runId) ──────────────────────────────────────
  if (options.phase === 'content' || options.phase === 'review') {
    if (!options.runId) throw new Error(`--run-id is required for phase=${options.phase}`);
    await resumeFromOutline(keyword, options.runId, outputDir, options);
    return;
  }
  if (options.phase === 'content-draft') {
    if (!options.runId) throw new Error('--run-id is required for phase=content-draft');
    await contentDraftPhase(keyword, options.runId, outputDir, options);
    return;
  }

  // ─── Phase: outline (or full) — shared preamble ──────────────────────────────

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

  // Style TUI — select style before content generation (skip for outline phase)
  if (options.phase !== 'outline') {
    const { styleTUI } = await import('../../scenarios/style/cli/style-tui.js');
    const stylesDir = path.join(outputDir, 'styles');
    const corpusDir = path.join(outputDir, 'corpus');
    const styleResult = await styleTUI({ stylesDir, corpusDir });
    if (styleResult.injectResult) {
      context.set('style-inject', styleResult.injectResult);
    }
  }

  // Get provider and model for direct step execution
  const providerConfig = config.providers[config.defaultProvider];
  if (!providerConfig) {
    throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
  }
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = providerConfig.defaultModel;
  const allPlatforms = selectedPlatforms ?? (['wechat', 'xiaohongshu', 'douyin'] as const);

  // ─── Phase: outline only ──────────────────────────────────────────────────
  if (options.phase === 'outline') {
    await generateOutlinePhase({ keyword, userContext: options.context, allPlatforms, provider, defaultModel, context, runId, runDir, outputDir });
    return;
  }

  // ─── Phase: material-gap (resume from outline, run material-search) ─────────
  if (options.phase === 'material-gap') {
    if (!options.runId) throw new Error('--run-id is required for phase=material-gap');
    const runDir2 = path.resolve(outputDir, options.runId);
    const ctx2 = await PipelineContext.restore(options.runId, outputDir);
    await setupRunLogger(runDir2);
    await acquireRunLock(options.runId, outputDir);
    await materialGapPhase({ keyword, userContext: options.context, allPlatforms, provider, defaultModel, context: ctx2, runId: options.runId, runDir: runDir2, outputDir });
    return;
  }

  // Auto-detect TTY: if not explicitly disabled and stdin is a TTY, enable interactive
  // Explicit interactive:true overrides TTY requirement (for skill command in non-TTY mode)
  const isInteractive = options.interactive === true || (options.interactive !== false && process.stdin.isTTY);

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

      // ── Node A: Outline Confirmation TUI ────────────────────────────────
      // After outlines generated, confirm before going to material-search / content
      const outlineConfirmResult = await (async () => {
        const { confirmOutlines } = await import('../../cli/ui/outline-review.js');
        const outlines = {
          wechat: context.get('outline-wechat') as any,
          xiaohongshu: context.get('outline-xiaohongshu') as any,
          douyin: context.get('outline-douyin') as any,
        };
        if (!outlines.wechat && !outlines.xiaohongshu && !outlines.douyin) {
          logger.warn('[create] no outlines found for confirmation');
          return null;
        }
        // onRegenerate: re-run one platform's outline step
        const onRegenerate = async (platform: string) => {
          let step: any;
          if (platform === 'wechat') step = new OutlineWechatStep(provider, defaultModel);
          else if (platform === 'xiaohongshu') step = new OutlineXiaohongshuStep(provider, defaultModel);
          else if (platform === 'douyin') step = new OutlineDouyinStep(provider, defaultModel);
          else return null;
          const r = await step.execute({}, context);
          if (r.success && r.data) context.set(`outline-${platform}`, r.data);
          return r.data;
        };
        const confirmed = await confirmOutlines(
          outlines, onRegenerate, platformsToRun,
          topicAnalysisResult?.keyword ?? '',
          topicAnalysisResult?.subTopics?.[0]?.name ?? '',
        );
        // Write confirmed values back to context
        for (const [platform, confirmedData] of Object.entries(confirmed)) {
          if (confirmedData) {
            context.set(`confirmed-outline-${platform}`, confirmedData);
            if (confirmedData.seedMaterial) {
              context.set(`outline-seed-material-${platform}`, confirmedData.seedMaterial);
            }
          }
        }
        return confirmed;
      })();
      void outlineConfirmResult; // used via context side-effects above

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

      // ── Node C: Content Draft Confirmation ────────────────────────────
      const contentConfirmResult = await (async () => {
        const { confirmContent } = await import('../../cli/ui/outline-review.js');
        // Show confirmation for each platform that was generated
        for (const platform of platformsToRun) {
          const content = context.get<string>(`content-${platform}`);
          if (!content) continue;
          const mode = platform === 'wechat' ? 'paragraph' : 'simple';
          const result = await confirmContent(content, mode as 'simple' | 'paragraph');
          if (result.action === 'ok') {
            // proceed normally
          } else if (result.action === 'mark' && result.markedParagraphs) {
            // Store marked paragraphs for revision pipeline
            context.set(`content-marked-${platform}`, result.markedParagraphs);
            context.set(`content-confirm-${platform}`, result);
          } else if (result.action === 'rewrite') {
            context.set(`content-confirm-${platform}`, result);
          }
        }
        return null;
      })();
      void contentConfirmResult;

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

      // Cleanup: keep only final .md files and run-meta.json (skip if --keep-artifacts)
      if (!options.keepArtifacts) {
        await cleanupIntermediateFiles(runDir);
      }

      // Sync articles to Obsidian (if configured)
      await writeArticlesToObsidian(context, platformsToRun);

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
        console.log(`  - ${file}`);
      }

      // Ask post-gen and handle revision
      const decision = await askPostGen();
      if (decision === 'abort') {
        console.log(chalk.yellow('\n已退出\n'));
        return;
      }
      if (decision === 'revise') {
        console.log(chalk.cyan('\n↺ 进入修订流程...\n'));
        const revisionPipeline = new RevisionPipeline({
          parentRunId: runId,
          provider,
          defaultModel,
          outputDir: outputDir,
        });
        await revisionPipeline.run();
      }
      // decision === 'save' → content already saved + cleaned up above; fall through to exit
      if (decision === 'save') {
        console.log(chalk.green('\n✓ 已保存\n'));
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

    // Cleanup: keep only final .md files and run-meta.json (skip if --keep-artifacts)
    if (!options.keepArtifacts) {
      await cleanupIntermediateFiles(runDir);
    }

    // Sync articles to Obsidian (if configured)
    await writeArticlesToObsidian(finalContext, [...platformNames]);

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
      console.log(`  - ${file}`);
    }

    // Ask post-gen and handle revision (interactive only to avoid hanging CI)
    if (isInteractive) {
      const decision = await askPostGen();
      if (decision === 'abort') {
        console.log(chalk.yellow('\n已退出\n'));
        return;
      }
      if (decision === 'revise') {
        console.log(chalk.cyan('\n↺ 进入修订流程...\n'));
        const revisionPipeline = new RevisionPipeline({
          parentRunId: runId,
          provider,
          defaultModel,
          outputDir: outputDir,
        });
        await revisionPipeline.run();
      }
      // decision === 'save' → content already saved + cleaned up above; fall through to exit
      if (decision === 'save') {
        console.log(chalk.green('\n✓ 已保存\n'));
      }
    }
  }
}

// ─── Command registration ───────────────────────────────────────────────────────

export function registerCreateCommand(program: Command): void {
  // 重建素材向量索引（顶层命令，避免 commander requiredOption 继承问题）
  program
    .command('build-material-index')
    .description('扫描 corpus/ 下所有 .md 文件，建立 embedding 索引')
    .action(async () => {
      const { ObsidianMaterialStore } = await import('../../scenarios/create/steps/obsidian-material-store.js');
      const store = new ObsidianMaterialStore();
      const count = await store.buildIndex();
      console.log(chalk.green(`✅ 已索引 ${count} 个素材文件`));
      console.log(chalk.gray(`   索引文件: output/corpus/material-embeddings.json`));
    });

  program
    .command('create')
    .description('从关键词生成原创内容')
    .requiredOption('-k, --keyword <text>', '关键词或主题')
    .option('-p, --platforms <list>', `平台列表 (逗号分隔，可选: wechat,xiaohongshu,douyin，默认全部)`)
    .option('-c, --context <text>', '用户补充说明')
    .option('--no-interactive', '跳过选题确认，直接全自动生成')
    .option('--keep-artifacts', '保留中间产物（用于调试 CCOS 输出）')
    .action(async (opts) => {
      try {
        const interactive = opts.interactive !== false;
        await runCreate(opts.keyword, {
          platforms: opts.platforms,
          context: opts.context,
          interactive,
          keepArtifacts: opts.keepArtifacts,
        });
      } catch (error) {
        logger.error('create command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}
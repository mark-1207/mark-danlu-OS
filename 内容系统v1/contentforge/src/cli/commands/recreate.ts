import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { buildRecreatePipeline } from '../../scenarios/recreate/index.js';
import { PipelineContext } from '../../core/context.js';
import { setupRunLogger } from '../../utils/logger.js';
import { logger } from '../../utils/logger.js';
import { validateAndCleanInput } from '../../utils/input-validator.js';
import { ProgressDisplay } from '../ui/progress.js';
import { interactiveSelect } from '../ui/prompts.js';
import { estimateCost } from '../../utils/token-counter.js';
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
import { sanitizeFilename } from '../../utils/sanitize.js';
import type { DifferentiationOutput, DifferentiationDirection, DualReviewResult } from '../../scenarios/recreate/types.js';
import { askPostGen } from '../../scenarios/revision/cli/post-gen-prompt.js';
import { RevisionPipeline } from '../../scenarios/revision/index.js';

export async function runRecreate(
  inputPath: string,
  direction: 'auto' | 'interactive',
  platforms: string[] = [],
): Promise<void> {
  // Load config
  const config = await loadConfig();
  setCachedConfig(config);

  // Register providers
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const pipeline = buildRecreatePipeline(config, direction, platforms);

  const outputDir = config.output?.dir ?? './output';
  const runId = `recreate_${Date.now()}`;
  const runDir = path.resolve(outputDir, runId);

  await fs.mkdir(runDir, { recursive: true });
  await setupRunLogger(runDir);

  // Acquire run lock to prevent concurrent resume conflicts
  await acquireRunLock(runId, outputDir);

  // Read and validate original article
  const rawFile = await fs.readFile(path.resolve(inputPath));
  const validation = await validateAndCleanInput(
    rawFile,
    path.basename(inputPath),
    config.inputValidation ?? {},
  );

  if (validation.errors.length > 0) {
    console.error(chalk.red('\n错误: 输入验证失败\n'));
    for (const error of validation.errors) {
      console.error(chalk.red(`  - ${error}`));
    }
    if (validation.detectedIssues.wasHtml) {
      console.error(chalk.yellow('  (检测到 HTML 内容，已尝试自动清理）'));
    }
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    for (const warning of validation.warnings) {
      console.warn(chalk.yellow(`\n警告: ${warning}`));
    }
  }

  const originalArticle = validation.cleaned;
  const articleTitle = originalArticle.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);

  const context = new PipelineContext('recreate', runDir, runId);
  context.set('_originalArticle', originalArticle);
  context.set('_direction', direction);
  const progress = new ProgressDisplay();

  console.log(chalk.bold('\n🔄 ContentForge — 爆款二创\n'));
  console.log(`原文: ${articleTitle}`);
  console.log(`方向选择: ${direction}\n`);

  // Style TUI — select style before content generation
  const { styleTUI } = await import('../../scenarios/style/cli/style-tui.js');
  const stylesDir = path.join(outputDir, 'styles');
  const corpusDir = path.join(outputDir, 'corpus');
  const styleResult = await styleTUI({ stylesDir, corpusDir });
  if (styleResult.injectResult) {
    context.set('style-inject', styleResult.injectResult);
  }

  const input = { originalArticle };

  // In interactive mode, pause after differentiation step to let user pick a direction
  let pendingInteractiveSelection: DifferentiationOutput | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingError: any = null;

  pipeline.onStepComplete(async (stepName, result) => {
    if (!result.success) {
      progress.failStep(stepName, result.error ?? 'unknown error');
      return;
    }

    progress.completeStep(stepName, result.durationMs, `tokens: +${result.tokenUsage.output}`);

    // Save viral-genome snapshot after viral-deconstruction completes
    if (stepName === 'viral-deconstruction' && result.data) {
      await fs.writeFile(
        path.join(runDir, 'viral-genome-snapshot.json'),
        JSON.stringify(result.data, null, 2),
        'utf-8',
      );
    }

    // Interactive mode: after differentiation, pause for user selection
    if (stepName === 'viral-differentiation' && direction === 'interactive' && result.data) {
      const diffOutput = result.data as DifferentiationOutput;
      pendingInteractiveSelection = diffOutput;

      // Pause — don't let pipeline continue yet
      // The pipeline will be resumed manually after selection
      pendingError = '__PAUSE_FOR_SELECTION__';
      throw new Error('__PAUSE_FOR_SELECTION__');
    }
  });

  let finalContext: PipelineContext;
  try {
    const result = await pipeline.run(input, context);
    finalContext = result.context;
  } catch (error) {
    const errStr = String(error);
    if (pendingError === '__PAUSE_FOR_SELECTION__' || errStr === '__PAUSE_FOR_SELECTION__') {
      // User selection needed
      if (!pendingInteractiveSelection) throw new Error('Differentiation result not found for interactive selection');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const directions = (pendingInteractiveSelection as DifferentiationOutput).directions;
      console.log(chalk.bold('\n📋 请选择二创方向\n'));

      const selected = await interactiveSelect<DifferentiationDirection>(
        '选择一个二创方向（输入数字）:',
        directions.map((d: DifferentiationDirection, i: number) => ({
          label: `${i + 1}. ${d.name} — ${d.newAngle} (综合分: ${d.compositeScore.toFixed(1)})`,
          value: d,
        })),
      );

      // Inject selected direction into context for remaining steps
      const updatedDiffOutput: DifferentiationOutput = {
        directions,
        selectedDirection: selected,
        selectionReason: `User selected: ${selected.name}`,
      };
      context.set('viral-differentiation', updatedDiffOutput);

      // Resume pipeline from new-outline step
      progress.startStep('new-outline');
      const resumeResult = await pipeline.resumeFrom('new-outline', context);
      finalContext = resumeResult.context;

      // Process remaining step callbacks
      for (const step of ['new-outline', 'recreation-content', 'dual-review']) {
        const stepResult = finalContext.getStepResult(step);
        if (stepResult) {
          if (stepResult.success) {
            progress.completeStep(step, stepResult.durationMs, `tokens: +${stepResult.tokenUsage.output}`);
          } else {
            progress.failStep(step, stepResult.error ?? 'unknown error');
          }
        }
      }
    } else {
      throw error;
    }
  } finally {
    await releaseRunLock(runId, outputDir);
  }

  // Check if P1/P2 element-level optimization is needed
  let shouldRunLocalRewrite = finalContext.get<boolean>('needsLocalRewrite') ?? false;
  if (shouldRunLocalRewrite) {
    // Cost cap check before running local-rewrite
    const costControl = config.costControl;
    if (costControl?.maxCostPerRun != null) {
      const tokenUsage = finalContext.getTotalTokenUsage();
      const currentCost = estimateCost(tokenUsage.input, tokenUsage.output);
      if (currentCost > costControl.maxCostPerRun) {
        if (costControl.onExceedAction === 'abort') {
          console.log(chalk.red(`\n⚠️  预估成本 $${currentCost.toFixed(4)} 超过上限 $${costControl.maxCostPerRun}，中止运行\n`));
          throw new Error(`Cost cap exceeded: $${currentCost.toFixed(4)} > $${costControl.maxCostPerRun}`);
        }
        console.log(chalk.yellow(`\n⚠️  预估成本 $${currentCost.toFixed(4)} 超过上限 $${costControl.maxCostPerRun}，跳过元素级优化\n`));
        shouldRunLocalRewrite = false;
      }
    }
  }

  if (shouldRunLocalRewrite) {
    const triggers = finalContext.get<Array<{ element: string; action: string }>>('optimization-triggers') ?? [];
    console.log(chalk.yellow(`\n⚙️  正在进行元素级优化 (${triggers.length} 项)...\n`));

    progress.startStep('local-rewrite');
    const resumeResult = await pipeline.resumeFrom('local-rewrite', context);
    finalContext = resumeResult.context;

    const localRewriteResult = finalContext.getStepResult('local-rewrite');
    if (localRewriteResult?.success) {
      progress.completeStep('local-rewrite', localRewriteResult.durationMs, `tokens: +${localRewriteResult.tokenUsage.output}`);
      console.log(chalk.yellow(`  已优化元素: ${triggers.map(t => t.element).join(', ')}`));
    } else {
      progress.failStep('local-rewrite', localRewriteResult?.error ?? 'unknown error');
    }
  }

  // Write per-platform adapted files if platform-adaptation step ran
  if (platforms.length > 0) {
    const platformResult = finalContext.get<Record<string, { adaptedContent: string; title: string }>>('platform-adaptation');
    if (platformResult) {
      for (const [platform, result] of Object.entries(platformResult)) {
        const ext = platform === 'xiaohongshu' ? 'xhs.md' : `${platform}.md`;
        const platformFileName = sanitizeFilename(result.title);
        await fs.writeFile(path.join(runDir, `${platformFileName}.${ext}`), result.adaptedContent, 'utf-8');
      }
    }
  }

  // Write markdown summary file
  const recreationContent = finalContext.get<string>('recreation-content');
  const recreationTitle = recreationContent
    ? recreationContent.split('\n')[0].replace(/^#+\s*/, '').trim()
    : articleTitle;
  await writeMarkdownSummary(runDir, finalContext, articleTitle, recreationTitle);

  // Auto-save to corpus/original/ for fragment library learning (with version history)
  if (recreationContent) {
    const corpusOriginalDir = path.join(outputDir, 'corpus', 'original');
    await fs.mkdir(corpusOriginalDir, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeTitle = articleTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30);
    const baseName = `recreate_${timestamp}_${safeTitle}`;

    // Shift existing versions: base → _v1, _v1 → _v2, etc.
    const existingFiles = await fs.readdir(corpusOriginalDir);
    const matchingFiles = existingFiles
      .filter(f => f.startsWith(baseName) && f.endsWith('.md'))
      .sort();

    if (matchingFiles.length > 0) {
      // Shift all versions up by 1
      for (const existingFile of matchingFiles.reverse()) {
        const match = existingFile.match(/^(.+)_v(\d+)\.md$/);
        const currentVersion = match ? parseInt(match[2]) : 0;
        const versionedName = `${match ? match[1] : existingFile.replace(/\.md$/, '')}_v${currentVersion + 1}.md`;
        await fs.rename(
          path.join(corpusOriginalDir, existingFile),
          path.join(corpusOriginalDir, versionedName),
        );
      }
    }

    await fs.writeFile(path.join(corpusOriginalDir, `${baseName}.md`), recreationContent, 'utf-8');
  }

  const tokenUsage = finalContext.getTotalTokenUsage();
  const cost = estimateCost(tokenUsage.input, tokenUsage.output);

  console.log(chalk.bold('\n✅ 二创完成\n'));
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

  // Ask post-gen and handle revision (interactive only to avoid hanging CI)
  const isInteractive = process.stdin.isTTY;
  if (isInteractive) {
    const decision = await askPostGen();
    if (decision === 'abort') {
      console.log(chalk.yellow('\n已退出\n'));
      return;
    }
    if (decision === 'revise') {
      console.log(chalk.cyan('\n↺ 进入修订流程...\n'));
      const providerConfig = config.providers[config.defaultProvider];
      if (!providerConfig) {
        throw new Error(`Default provider '${config.defaultProvider}' not found in config`);
      }
      const provider = llmFactory.get(config.defaultProvider);
      const defaultModel = providerConfig.defaultModel;
      const revisionPipeline = new RevisionPipeline({
        parentRunId: runId,
        provider,
        defaultModel,
        outputDir: outputDir,
      });
      await revisionPipeline.run();
    }
    // decision === 'accept' → fall through to exit
  }
}

async function writeMarkdownSummary(
  runDir: string,
  context: PipelineContext,
  originalTitle: string,
  recreationTitle: string,
): Promise<void> {
  const recreationContent = context.get<string>('recreation-content');
  const diffOutput = context.get<DifferentiationOutput>('viral-differentiation');
  const dualReviewResult = context.get<DualReviewResult>('dual-review');
  const localRewriteResult = context.get<{ appliedTriggers: Array<{ element: string; action: string }> }>('local-rewrite');
  const localRewriteSuccess = context.getStepResult('local-rewrite')?.success;

  const direction = diffOutput?.selectedDirection;
  const viralReport = dualReviewResult?.viralPotentialReport;

  // Use the recreation title passed from caller (extracted from content)
  const title = recreationTitle;

  const originalityScore = dualReviewResult?.originalityReport?.overallScore ?? 0;
  const passThreshold = dualReviewResult?.originalityReport?.passThreshold ?? false;

  const scores = viralReport?.scores;
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // Build quality table rows
  const qualityRows: string[] = [];
  if (scores) {
    qualityRows.push(`| 标题吸引力 | ${scores.titleAttraction}/10 |`);
    qualityRows.push(`| 开头留存率 | ${scores.hookRetention}/10 |`);
    qualityRows.push(`| 内容价值感 | ${scores.contentValue}/10 |`);
    qualityRows.push(`| 情绪调动力 | ${scores.emotionalEngagement}/10 |`);
    qualityRows.push(`| 互动引导力 | ${scores.interactionDesign}/10 |`);
  }

  // Build applied optimizations
  let optimizationNote = '';
  if (localRewriteResult?.appliedTriggers?.length) {
    const elements = localRewriteResult.appliedTriggers.map(t => t.element).join('、');
    optimizationNote = `\n\n> 已进行元素级优化：${elements}`;
  }

  const md = `# ${title}

> **二创方向**：${direction?.name ?? '未知'} — ${direction?.newAngle ?? ''}
> **原创性**：${originalityScore}/10 ${passThreshold ? '✅ 通过' : '❌ 未通过'}${optimizationNote}

${scores ? `| 维度 | 评分 |\n|---|---|\n${qualityRows.join('\n')}` : ''}

---

${recreationContent ?? '(无正文)'}

---

## 创作记录

- **原文**：[${originalTitle}]()
- **生成时间**：${timestamp}
- **二创方向**：${direction?.name ?? '未知'} — ${direction?.newAngle ?? ''}
- **差异维度**：${direction ? [direction.perspectiveShift, direction.audienceShift, direction.contentShift].filter(Boolean).join(' / ') : ''}
${localRewriteSuccess && localRewriteResult?.appliedTriggers?.length ? localRewriteResult.appliedTriggers.map(t => `- 优化元素：${t.element}（${t.action}）`).join('\n') : ''}
`;

  await fs.writeFile(path.join(runDir, `${sanitizeFilename(title)}.md`), md, 'utf-8');
}

export function registerRecreateCommand(program: Command): void {
  program
    .command('recreate')
    .description('对爆款文章进行差异化二创')
    .requiredOption('-i, --input <path>', '原文文件路径')
    .option('-d, --direction <mode>', '方向选择模式: auto 或 interactive', 'auto')
    .option('-p, --platforms <list>', '目标平台（逗号分隔）: wechat,xiaohongshu,douyin', (val) =>
      val.split(',').map(p => p.trim()).filter(Boolean),
    )
    .action(async (opts) => {
      try {
        const direction = opts.direction === 'interactive' ? 'interactive' : 'auto';
        const platforms = (opts.platforms ?? []).filter(p =>
          ['wechat', 'xiaohongshu', 'douyin'].includes(p),
        );
        await runRecreate(opts.input, direction, platforms);
      } catch (error) {
        logger.error('recreate command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

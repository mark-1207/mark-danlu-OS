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
import { ProgressDisplay } from '../ui/progress.js';
import { interactiveSelect } from '../ui/prompts.js';
import { estimateCost } from '../../utils/token-counter.js';
import type { DifferentiationOutput, DifferentiationDirection, DualReviewResult } from '../../scenarios/recreate/types.js';

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

  // Read original article
  const originalArticle = await fs.readFile(path.resolve(inputPath), 'utf-8');
  const articleTitle = originalArticle.split('\n')[0].slice(0, 60);

  const context = new PipelineContext('recreate', runDir, runId);
  context.set('_originalArticle', originalArticle);
  context.set('_direction', direction);
  const progress = new ProgressDisplay();

  console.log(chalk.bold('\n🔄 ContentForge — 爆款二创\n'));
  console.log(`原文: ${articleTitle}`);
  console.log(`方向选择: ${direction}\n`);

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
  }

  // Check if P1/P2 element-level optimization is needed
  const needsLocalRewrite = finalContext.get<boolean>('needsLocalRewrite');
  if (needsLocalRewrite) {
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
        await fs.writeFile(path.join(runDir, `recreation.${ext}`), result.adaptedContent, 'utf-8');
      }
    }
  }

  // Write markdown summary file
  await writeMarkdownSummary(runDir, finalContext, articleTitle);

  // Auto-save to corpus/original/ for fragment library learning (with version history)
  const recreationContent = finalContext.get<string>('recreation-content');
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
}

async function writeMarkdownSummary(
  runDir: string,
  context: PipelineContext,
  originalTitle: string,
): Promise<void> {
  const recreationContent = context.get<string>('recreation-content');
  const diffOutput = context.get<DifferentiationOutput>('viral-differentiation');
  const dualReviewResult = context.get<DualReviewResult>('dual-review');
  const localRewriteResult = context.get<{ appliedTriggers: Array<{ element: string; action: string }> }>('local-rewrite');
  const localRewriteSuccess = context.getStepResult('local-rewrite')?.success;

  const direction = diffOutput?.selectedDirection;
  const viralReport = dualReviewResult?.viralPotentialReport;

  // Extract title from first line
  const title = recreationContent
    ? recreationContent.split('\n')[0].replace(/^#+\s*/, '').trim()
    : '无标题';

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

  await fs.writeFile(path.join(runDir, 'recreation.md'), md, 'utf-8');
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

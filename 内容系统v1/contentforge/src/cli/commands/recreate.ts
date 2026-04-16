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
import type { DifferentiationOutput, DifferentiationDirection } from '../../scenarios/recreate/types.js';

export async function runRecreate(
  inputPath: string,
  direction: 'auto' | 'interactive',
): Promise<void> {
  // Load config
  const config = await loadConfig();
  setCachedConfig(config);

  // Register providers
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const pipeline = buildRecreatePipeline(config, direction);

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
    if (pendingError === '__PAUSE_FOR_SELECTION__' || String(error) === '__PAUSE_FOR_SELECTION__') {
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

export function registerRecreateCommand(program: Command): void {
  program
    .command('recreate')
    .description('对爆款文章进行差异化二创')
    .requiredOption('-i, --input <path>', '原文文件路径')
    .option('-d, --direction <mode>', '方向选择模式: auto 或 interactive', 'auto')
    .action(async (opts) => {
      try {
        const direction = opts.direction === 'interactive' ? 'interactive' : 'auto';
        await runRecreate(opts.input, direction);
      } catch (error) {
        logger.error('recreate command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

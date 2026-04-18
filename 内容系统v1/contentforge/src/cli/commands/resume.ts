import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { buildCreatePipeline } from '../../scenarios/create/index.js';
import { buildRecreatePipeline } from '../../scenarios/recreate/index.js';
import { PipelineContext } from '../../core/context.js';
import { setupRunLogger } from '../../utils/logger.js';
import { logger } from '../../utils/logger.js';
import { estimateCost } from '../../utils/token-counter.js';
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';
import type { ViralGenome } from '../../scenarios/recreate/types.js';

export async function runResume(
  runId: string,
  fromStep: string,
  options: { snapshot?: boolean } = {},
): Promise<void> {
  const config = await loadConfig();
  setCachedConfig(config);

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const outputDir = config.output?.dir ?? './output';
  const runDir = path.join(outputDir, runId);

  await setupRunLogger(runDir);

  await acquireRunLock(runId, outputDir);

  let finalContext: PipelineContext;
  try {
    const context = await PipelineContext.restore(runId, outputDir);

    // Detect scenario from runId prefix
    const isRecreate = runId.startsWith('recreate_');

    // Restore direction mode for recreate from context
    const direction = (context.get('_direction') as string | undefined) ?? 'auto';
    const pipeline = isRecreate
      ? buildRecreatePipeline(config, direction as 'auto' | 'interactive')
      : buildCreatePipeline(config);

    // Snapshot resume: load snapshot and inject into context, skip to content-generation
    if (options.snapshot) {
      const snapshotPath = path.join(runDir, 'viral-genome-snapshot.json');
      let snapshotData: ViralGenome;
      try {
        const content = await fs.readFile(snapshotPath, 'utf-8');
        snapshotData = JSON.parse(content) as ViralGenome;
      } catch {
        console.error(chalk.red(`错误: 找不到快照文件 ${snapshotPath}`));
        process.exit(1);
      }

      // Load existing artifacts that are already completed
      const diffOutput = context.get('viral-differentiation');
      const originalArticle = context.get<string>('_originalArticle');

      // Inject snapshot and required artifacts into context
      context.set('viral-deconstruction', snapshotData);
      if (diffOutput) context.set('viral-differentiation', diffOutput);
      if (originalArticle) context.set('_originalArticle', originalArticle);

      // Mark viral-deconstruction and viral-differentiation as already completed in context
      // so resumeFrom skips them
      const vdResult = context.getStepResult('viral-deconstruction');
      const vdDiffResult = context.getStepResult('viral-differentiation');
      if (!vdResult) context.setStepResult('viral-deconstruction', { success: true, data: snapshotData, tokenUsage: { input: 0, output: 0 }, durationMs: 0 });
      if (!vdDiffResult && diffOutput) context.setStepResult('viral-differentiation', { success: true, data: diffOutput, tokenUsage: { input: 0, output: 0 }, durationMs: 0 });

      console.log(chalk.bold(`\n▶ Snapshot resume: ${runId} (genome loaded, skipping to content generation)\n`));
      const result = await pipeline.resumeFrom('recreation-content', context);
      finalContext = result.context;
    } else {
      console.log(chalk.bold(`\n▶ Resume: ${runId} from step "${fromStep}" (direction: ${direction})\n`));
      const result = await pipeline.resumeFrom(fromStep, context);
      finalContext = result.context;
    }
  } finally {
    await releaseRunLock(runId, outputDir);
  }

  const tokenUsage = finalContext.getTotalTokenUsage();
  const cost = estimateCost(tokenUsage.input, tokenUsage.output);
  console.log(chalk.green('\n✅ Resume 完成\n'));
  console.log(`预估成本: $${cost.toFixed(4)}\n`);
}

export async function listRuns(): Promise<void> {
  const config = await loadConfig();
  const outputDir = config.output?.dir ?? './output';

  try {
    const entries = await fs.readdir(outputDir);
    const runs = entries.filter((e) => e.startsWith('create_') || e.startsWith('recreate_')).sort().reverse();

    if (runs.length === 0) {
      console.log('没有找到任何运行记录');
      return;
    }

    console.log(chalk.bold('\n📋 最近运行记录\n'));
    for (const runId of runs.slice(0, 10)) {
      const runPath = path.join(outputDir, runId);
      const files = await fs.readdir(runPath);
      const hasMeta = files.includes('run-meta.json');
      const stepCount = files.filter((f) => f.endsWith('.json') && f !== 'run-meta.json').length;
      console.log(`  ${runId}  [${stepCount} artifacts]${hasMeta ? '' : ' (运行中)'}`);
    }
    console.log('');
  } catch {
    console.log(chalk.red('错误: 无法读取输出目录'));
  }
}

export async function listSteps(runId: string): Promise<void> {
  const config = await loadConfig();
  const outputDir = config.output?.dir ?? './output';
  const runDir = path.join(outputDir, runId);
  const metaPath = path.join(runDir, 'run-meta.json');

  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const meta = JSON.parse(content);
    const completedSteps: string[] = meta.completedSteps ?? [];

    console.log(chalk.bold(`\n📋 Steps for run: ${runId}\n`));
    if (completedSteps.length === 0) {
      console.log('  (无已完成步骤)\n');
    } else {
      console.log('已完成:');
      for (const step of completedSteps) {
        console.log(`  ✅ ${step}`);
      }
    }

    // Show all possible resume points
    const allPossibleSteps = [
      'topic-analysis', 'topic-assignment',
      'outline-wechat', 'outline-xiaohongshu', 'outline-douyin',
      'material-search',
      'content-wechat', 'content-xiaohongshu', 'content-douyin',
      'review-wechat', 'review-xiaohongshu', 'review-douyin',
    ];
    const nextSteps = allPossibleSteps.filter((s) => !completedSteps.includes(s));
    if (nextSteps.length > 0) {
      console.log('\n可恢复位置:');
      for (const s of nextSteps.slice(0, 5)) {
        console.log(`  ▶ ${s}`);
      }
    }
    console.log('');
  } catch {
    console.log(chalk.red(`错误: 无法读取 run ${runId} 的上下文`));
  }
}

export function registerResumeCommand(program: Command): void {
  const resumeCmd = program
    .command('resume')
    .description('列出运行记录 / 从断点恢复执行');

  // resume list — list recent runs
  resumeCmd
    .command('list')
    .description('列出最近的运行记录')
    .action(async () => {
      try {
        await listRuns();
      } catch (error) {
        logger.error('list runs failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });

  // resume <run-id> — show steps for a run
  resumeCmd
    .command('steps <runId>')
    .description('显示指定运行的已完成步骤')
    .action(async (runId: string) => {
      try {
        await listSteps(runId);
      } catch (error) {
        logger.error('list steps failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });

  // resume <run-id> --from-step <step> — resume from step
  resumeCmd
    .argument('<runId>', '运行 ID')
    .option('--from-step <name>', '从哪个步骤恢复')
    .option('-s, --step <name>', '从哪个步骤恢复 (简写)')
    .option('--snapshot', '从 viral-genome 快照恢复，跳过前3步，直接从内容生成继续')
    .action(async (runId: string, opts) => {
      try {
        if (opts.snapshot) {
          await runResume(runId, 'recreation-content', { snapshot: true });
          return;
        }
        const fromStep = opts.step ?? opts.fromStep;
        if (!fromStep) {
          console.error(chalk.red('错误: 需要 --from-step 参数，或使用 --snapshot 从快照恢复'));
          console.log('用法: resume <run-id> --from-step <step-name>');
          console.log('      resume <run-id> --snapshot  — 从快照恢复，跳过已完成的步骤');
          console.log('      resume steps <run-id>  — 查看某次运行的状态');
          console.log('      resume list           — 列出所有运行记录');
          process.exit(1);
        }
        await runResume(runId, fromStep);
      } catch (error) {
        logger.error('resume command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

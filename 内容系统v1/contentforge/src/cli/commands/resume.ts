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

export async function runResume(runId: string, fromStep: string): Promise<void> {
  const config = await loadConfig();
  setCachedConfig(config);

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const outputDir = config.output?.dir ?? './output';
  const runDir = path.join(outputDir, runId);

  await setupRunLogger(runDir);
  const context = await PipelineContext.restore(runId, runDir);

  // Detect scenario from runId prefix
  const isRecreate = runId.startsWith('recreate_');

  // Restore direction mode for recreate from context
  const direction = (context.get('_direction') as string | undefined) ?? 'auto';
  const pipeline = isRecreate
    ? buildRecreatePipeline(config, direction as 'auto' | 'interactive')
    : buildCreatePipeline(config);

  console.log(chalk.bold(`\n▶ Resume: ${runId} from step "${fromStep}" (direction: ${direction})\n`));

  const { context: finalContext } = await pipeline.resumeFrom(fromStep, context);

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
    .action(async (runId: string, opts) => {
      try {
        const fromStep = opts.step ?? opts.fromStep;
        if (!fromStep) {
          console.error(chalk.red('错误: 需要 --from-step 参数'));
          console.log('用法: resume <run-id> --from-step <step-name>');
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

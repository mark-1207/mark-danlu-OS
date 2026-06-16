import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { buildCreatePipeline } from '../../scenarios/create/index.js';
import { buildRecreatePipeline } from '../../scenarios/recreate/index.js';
import { Runner } from '../../core/runner.js';
import { logger } from '../../utils/logger.js';
import { estimateCost } from '../../utils/token-counter.js';

export async function runBatch(
  inputPath: string,
  scenario: 'create' | 'recreate',
  direction: 'auto' | 'interactive' = 'auto',
): Promise<void> {
  const config = await loadConfig();
  setCachedConfig(config);

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const content = await fs.readFile(inputPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());

  console.log(chalk.bold(`\n📦 Batch: ${scenario} (direction: ${direction})\n`));
  console.log(`共 ${lines.length} 个任务\n`);

  const batchSize = config.concurrency?.batchSize ?? 5;
  const runner = new Runner({
    outputDir: config.output?.dir ?? './output',
    maxParallel: config.concurrency?.maxParallel ?? 3,
    batchSize,
  });

  const pipeline = scenario === 'create'
    ? buildCreatePipeline(config)
    : buildRecreatePipeline(config, direction);

  const tasks = lines.map((line) => {
    if (scenario === 'create') {
      return { pipeline, input: { keyword: line } };
    } else {
      const filePath = path.resolve(line);
      return { pipeline, input: { input: filePath } };
    }
  });

  let completed = 0;
  let totalCost = 0;

  const results = await runner.runBatch(tasks, (i, total, runId, error) => {
    completed++;
    if (error) {
      console.log(`[${completed}/${total}] ${runId} FAILED`);
    } else {
      console.log(`[${completed}/${total}] ${runId} done`);
    }
  });

  // Calculate total cost
  for (const ctx of results) {
    const usage = ctx.getTotalTokenUsage();
    totalCost += estimateCost(usage.input, usage.output);
  }

  console.log(chalk.green(`\n✅ Batch 完成\n`));
  console.log(`预估总成本: $${totalCost.toFixed(4)}\n`);
}

export function registerBatchCommand(program: Command): void {
  program
    .command('batch')
    .description('批量执行 (P1)')
    .requiredOption('-i, --input <path>', '关键词列表文件路径')
    .option('-s, --scenario <type>', '场景: create 或 recreate', 'create')
    .option('-d, --direction <mode>', '方向: auto 或 interactive', 'auto')
    .action(async (opts) => {
      try {
        await runBatch(opts.input, opts.scenario, opts.direction);
      } catch (error) {
        logger.error('batch command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

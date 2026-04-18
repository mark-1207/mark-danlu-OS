import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { buildCreatePipeline, type PlatformSelection } from '../../scenarios/create/index.js';
import { PipelineContext } from '../../core/context.js';
import { setupRunLogger } from '../../utils/logger.js';
import { logger } from '../../utils/logger.js';
import { ProgressDisplay } from '../ui/progress.js';
import { estimateCost } from '../../utils/token-counter.js';
import { acquireRunLock, releaseRunLock } from '../../utils/run-lock.js';

const VALID_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

export async function runCreate(keyword: string, options: { platforms?: string; context?: string }): Promise<void> {
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

  const pipeline = buildCreatePipeline(config, selectedPlatforms);

  const outputDir = config.output?.dir ?? './output';
  const runId = `create_${Date.now()}`;
  const runDir = path.resolve(outputDir, runId);

  await fs.mkdir(runDir, { recursive: true });
  await setupRunLogger(runDir);

  // Acquire run lock to prevent concurrent resume conflicts
  await acquireRunLock(runId, outputDir);

  const context = new PipelineContext('create', runDir, runId);
  const progress = new ProgressDisplay();

  const platformList = selectedPlatforms
    ? selectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(' / ')
    : '全部';

  console.log(chalk.bold('\n🔨 ContentForge — 原创生成\n'));
  console.log(`关键词: ${keyword}`);
  console.log(`平台: ${platformList}\n`);

  // Register step callbacks
  pipeline.onStepComplete((stepName, result) => {
    if (result.success) {
      progress.completeStep(stepName, result.durationMs, `tokens: +${result.tokenUsage.output}`);
    } else {
      progress.failStep(stepName, result.error ?? 'unknown error');
    }
  });

  const input = {
    keyword,
    userContext: options.context,
  };

  progress.startStep('topic-analysis', '主题深挖');
  let finalContext: PipelineContext;
  try {
    const result = await pipeline.run(input, context);
    finalContext = result.context;
  } finally {
    await releaseRunLock(runId, outputDir);
  }

  // Summarize results
  const tokenUsage = finalContext.getTotalTokenUsage();
  const cost = estimateCost(tokenUsage.input, tokenUsage.output);

  console.log(chalk.bold('\n✅ 生成完成\n'));
  console.log(`输出目录: ${runDir}`);
  console.log(`总 token: input=${tokenUsage.input} output=${tokenUsage.output}`);
  console.log(`预估成本: $${cost.toFixed(4)}\n`);

  // List output files
  const files = await fs.readdir(runDir);
  console.log('生成文件:');
  for (const file of files) {
    if (file !== 'run.log') {
      console.log(`  - ${file}`);
    }
  }
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('从关键词生成原创内容')
    .requiredOption('-k, --keyword <text>', '关键词或主题')
    .option('-p, --platforms <list>', `平台列表 (逗号分隔，可选: wechat,xiaohongshu,douyin，默认全部)`)
    .option('-c, --context <text>', '用户补充说明')
    .action(async (opts) => {
      try {
        await runCreate(opts.keyword, { platforms: opts.platforms, context: opts.context });
      } catch (error) {
        logger.error('create command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

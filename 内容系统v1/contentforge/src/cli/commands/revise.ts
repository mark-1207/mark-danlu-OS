import { type Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { RevisionPipeline } from '../../scenarios/revision/index.js';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';

export function registerReviseCommand(program: Command) {
  program
    .command('revise <runId>')
    .description('修订指定 runId 的生成结果')
    .option('--list', '列出所有版本')
    .option('--revert <version>', '回退到指定版本')
    .action(async (runId: string, opts) => {
      const config = await loadConfig();
      setCachedConfig(config);

      // Register providers
      for (const [name, providerConfig] of Object.entries(config.providers)) {
        llmFactory.register(name, providerConfig);
      }

      const provider = llmFactory.get(config.defaultProvider);
      const defaultModel = config.providers[config.defaultProvider]?.defaultModel ?? 'claude-sonnet-4-20250514';
      const outputDir = config.output?.dir ?? './output';

      if (opts.list) {
        await listVersions(runId, outputDir);
        return;
      }

      if (opts.revert) {
        await revertVersion(runId, opts.revert, outputDir);
        return;
      }

      // Run revision pipeline
      console.log(chalk.cyan(`\n→ 开始修订 ${runId}\n`));

      const pipeline = new RevisionPipeline({
        parentRunId: runId,
        provider,
        defaultModel,
        outputDir,
      });

      const result = await pipeline.run();

      if (result.success) {
        console.log(chalk.green(`\n✓ 修订完成，runId: ${result.runId}\n`));
      } else {
        console.log(chalk.yellow('\n修订已取消\n'));
        process.exit(0);
      }
    });
}

async function listVersions(runId: string, outputDir: string): Promise<void> {
  const manifestPath = path.join(outputDir, runId, 'revisions', 'manifest.json');

  let manifest;
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch {
    console.log(chalk.yellow(`未找到修订历史: ${runId}/revisions/manifest.json`));
    return;
  }

  console.log(chalk.bold(`\n修订历史 — ${runId}\n`));
  console.log(`父 RunId: ${manifest.parentRunId}`);
  console.log(`当前版本: ${manifest.currentVersion}`);
  console.log('\n版本列表:');
  for (const version of manifest.versions) {
    const marker = version.version === manifest.currentVersion ? ' ← 当前' : '';
    console.log(`  ${chalk.green(version.version)}  ${new Date(version.timestamp).toLocaleString('zh-CN')}${marker}`);
    console.log(`    指令: ${version.userInstruction}`);
    console.log(`    改动: ${version.appliedTriggers.map((t: { element: string }) => t.element).join(', ')}`);
  }
  console.log('');
}

async function revertVersion(runId: string, version: string, outputDir: string): Promise<void> {
  const versionPath = path.join(outputDir, runId, 'revisions', `${version}.md`);

  let content: string;
  try {
    content = await fs.readFile(versionPath, 'utf-8');
  } catch {
    console.log(chalk.red(`版本不存在: ${version}`));
    return;
  }

  // For now, just display the content — full revert would copy it back to the run's current content
  console.log(chalk.bold(`\n版本 ${version} 内容:\n`));
  console.log(chalk.dim('─'.repeat(60)));
  console.log(content);
  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.yellow('\n注意: revert 只是展示内容，完整 revert 功能待后续实现\n'));
}

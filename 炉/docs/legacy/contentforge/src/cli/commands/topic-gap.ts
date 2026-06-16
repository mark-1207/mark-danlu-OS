import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeTopicGap } from '../../scenarios/topic-gap/index.js';

export function registerTopicGapCommand(program: Command): void {
  program
    .command('topic-gap')
    .description('选题缺口分析：平台覆盖、素材空白、高频主题')
    .action(async () => {
      try {
        await analyzeTopicGap();
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 分析失败: ${String(err)}\n`));
      }
    });
}
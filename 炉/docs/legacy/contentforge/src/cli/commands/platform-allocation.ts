import { Command } from 'commander';
import chalk from 'chalk';
import { analyzePlatformAllocation } from '../../scenarios/platform-allocation/index.js';

export function registerPlatformAllocationCommand(program: Command): void {
  program
    .command('platform-allocation')
    .description('平台配比建议：基于产出数据推荐平台分布')
    .action(async () => {
      try {
        await analyzePlatformAllocation();
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 分析失败: ${String(err)}\n`));
      }
    });
}
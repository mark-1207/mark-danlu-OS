import { Command } from 'commander';
import chalk from 'chalk';
import { runCreate } from './create.js';
import { logger } from '../../utils/logger.js';

/**
 * Backward-compat alias: `contentforge opinion -k "..."` → runCreate({ opinion: true })
 *
 * After the create+opinion mode merge (mode-merge Step 4), opinion is now a sub-mode
 * of create. This alias keeps existing scripts / muscle-memory working.
 */
export function registerOpinionCommand(program: Command): void {
  program
    .command('opinion')
    .description('【向后兼容别名】从观点出发生成内容（同 `contentforge create -k "..." --opinion`）')
    .requiredOption('-k, --keyword <text>', '观点或主题，例如：远程办公才是未来')
    .option('-p, --platforms <list>', '平台列表 (逗号分隔，可选: wechat,xiaohongshu,douyin，默认全部)')
    .option('-c, --context <text>', '用户补充说明')
    .option('--no-interactive', '跳过选题确认，直接全自动生成')
    .option('--keep-artifacts', '保留中间产物')
    .action(async (opts) => {
      try {
        const interactive = opts.interactive !== false;
        await runCreate(opts.keyword, {
          platforms: opts.platforms,
          context: opts.context,
          interactive,
          keepArtifacts: opts.keepArtifacts,
          opinion: true,
        });
      } catch (error) {
        logger.error('opinion command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

import { type Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { loadConfig } from '../../config/loader.js';
import { styleTUI, type StyleSelection } from '../../scenarios/style/cli/style-tui.js';

export function registerStyleCommand(program: Command) {
  program
    .command('style')
    .description('风格管理：分析/导入/融合/选择风格')
    .action(async () => {
      const config = await loadConfig();
      const baseDir = path.resolve(config.output?.dir ?? './output');
      const stylesDir = path.join(baseDir, 'styles');
      const corpusDir = path.join(baseDir, 'corpus');

      const result: StyleSelection = await styleTUI({ stylesDir, corpusDir });
      if (!result.profile) {
        console.log(chalk.dim('跳过风格选择'));
        return;
      }
      console.log(chalk.green(`已选择风格: ${result.profile.name}`));
    });
}
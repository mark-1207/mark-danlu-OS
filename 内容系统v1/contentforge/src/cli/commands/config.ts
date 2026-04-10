import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import fs from 'fs/promises';

export async function showConfig(): Promise<void> {
  const config = await loadConfig();
  console.log(chalk.bold('\n⚙️  ContentForge 配置\n'));
  console.log(JSON.stringify(config, null, 2));
}

export async function showConfigFile(filePath?: string): Promise<void> {
  const config = await loadConfig();
  if (filePath) {
    const yaml = await fs.readFile(filePath, 'utf-8');
    console.log(yaml);
  } else {
    console.log(JSON.stringify(config, null, 2));
  }
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('查看 ContentForge 配置')
    .option('-f, --file <path>', '查看指定配置文件内容（yaml/json）')
    .option('-s, --show', '显示当前加载的配置（等同于不传参数）', false)
    .action(async (opts) => {
      try {
        if (opts.file) {
          await showConfigFile(opts.file);
        } else {
          await showConfig();
        }
      } catch (error) {
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { checkCompliance } from '../../scenarios/compliance/checker.js';
import type { ComplianceResult } from '../../scenarios/compliance/types.js';

function printReport(result: ComplianceResult): void {
  console.log(chalk.bold(`\n🔍 合规检查: ${result.fileName}\n`));
  console.log(`平台: ${result.platform}`);

  if (result.issues.length === 0) {
    console.log(chalk.green('\n✅ 合规检查完成 — 无问题\n'));
    return;
  }

  const warnCount = result.issues.filter(i => i.severity === 'warn').length;
  const errorCount = result.issues.filter(i => i.severity === 'error').length;

  if (warnCount > 0) {
    console.log(chalk.yellow(`\n⚠️  检测到 ${warnCount} 个警告\n`));
    result.issues.filter(i => i.severity === 'warn').forEach(issue => {
      const lineInfo = issue.line ? `（第${issue.line}行）` : '';
      console.log(chalk.yellow(`  ⚠️  [${issue.type}] ${issue.message}${lineInfo}`));
    });
  }

  if (errorCount > 0) {
    console.log(chalk.red(`\n❌ 检测到 ${errorCount} 个错误\n`));
    result.issues.filter(i => i.severity === 'error').forEach(issue => {
      const lineInfo = issue.line ? `（第${issue.line}行）` : '';
      console.log(chalk.red(`  ❌ [${issue.type}] ${issue.message}${lineInfo}`));
    });
  }

  console.log(chalk.bold('\n问题汇总：'));
  result.issues.forEach(issue => {
    const sev = issue.severity === 'warn' ? 'warn' : 'error';
    const sevLabel = issue.severity === 'warn' ? chalk.yellow('[warn]') : chalk.red('[error]');
    const wordInfo = issue.matchedWord ? ` "${issue.matchedWord}"` : '';
    console.log(`  ${sevLabel} ${issue.type}: ${issue.message}${wordInfo}`);
  });
}

export async function runComplianceCheck(inputPath: string): Promise<ComplianceResult> {
  const resolvedPath = path.resolve(inputPath);
  const content = await fs.readFile(resolvedPath, 'utf-8');
  const fileName = path.basename(resolvedPath);
  return checkCompliance(content, fileName);
}

export function registerComplianceCommand(program: Command): void {
  program
    .command('compliance')
    .description('检查内容合规性（敏感词、平台违禁词、格式）')
    .requiredOption('-i, --input <path>', '要检查的文件路径')
    .action(async (opts) => {
      try {
        const result = await runComplianceCheck(opts.input);
        printReport(result);
      } catch (error) {
        console.error(chalk.red(`\n错误: ${error}\n`));
        process.exit(1);
      }
    });
}

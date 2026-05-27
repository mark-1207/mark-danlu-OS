import { Command } from 'commander';
import chalk from 'chalk';
import { rebuildIndex, loadIndex, queryIndex, searchIndex, getRecordById } from '../../scenarios/article/index.js';
import type { PlatformFilter } from '../../scenarios/article/types.js';

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

function formatRecord(rec: { runId: string; title: string; platform: string; status: string; startedAt: string; reviewScore: number | null; keyword: string }): string {
  const badge = rec.status === 'completed' ? chalk.green('●') : rec.status === 'failed' ? chalk.red('✗') : chalk.yellow('○');
  const platformLabel = PLATFORM_LABELS[rec.platform] ?? rec.platform;
  const date = new Date(rec.startedAt).toLocaleDateString('zh-CN');
  const score = rec.reviewScore !== null ? ` ${chalk.cyan(`${rec.reviewScore}分`)}` : '';
  return `  ${badge} ${chalk.white(rec.title.slice(0, 50))}\n     ${chalk.gray(platformLabel)} | ${chalk.gray(date)} | ${chalk.gray(rec.runId)}${score}`;
}

function formatLineageTree(record: { runId: string; scenario: string; title: string; platform: string; status: string; completedSteps: string[]; reviewScore: number | null; tokenCost: number; lineage: { siblingRunIds: string[]; parentRunId: string | null } }): string[] {
  const lines: string[] = [];
  const scenarioIcon = record.scenario === 'recreate' ? '🔄' : '📝';
  lines.push(chalk.bold(`\n${scenarioIcon} ${record.title}`));
  lines.push(chalk.gray(`  Run ID: ${record.runId} | 平台: ${PLATFORM_LABELS[record.platform] ?? record.platform} | 状态: ${record.status}`));
  if (record.reviewScore !== null) lines.push(chalk.cyan(`  评分: ${record.reviewScore}/100`));
  lines.push(chalk.gray(`  Token成本: $${record.tokenCost.toFixed(6)} | 步骤: ${record.completedSteps.length}`));
  if (record.lineage.siblingRunIds.length > 0) {
    lines.push(chalk.gray(`  血缘兄弟: ${record.lineage.siblingRunIds.join(', ')}`));
  }
  if (record.lineage.parentRunId) {
    lines.push(chalk.gray(`  来源: ${record.lineage.parentRunId}`));
  }
  return lines;
}

export function registerArticleCommand(program: Command): void {
  const cmd = program
    .command('article')
    .description('内容资产管理：索引、浏览、血缘追踪、搜索');

  cmd
    .command('index')
    .description('扫描 output/ 建立文章索引')
    .option('--rebuild', '强制重建索引')
    .action(async (opts: { rebuild?: boolean }) => {
      console.log(chalk.bold('\n📚 重建文章索引\n'));
      try {
        const index = await rebuildIndex();
        console.log(chalk.green(`\n  ✅ 索引完成`));
        console.log(chalk.gray(`     共 ${index.records.length} 条记录`));
        console.log(chalk.gray(`     最后重建: ${new Date(index.lastRebuiltAt).toLocaleString('zh-CN')}`));
        console.log('');
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 索引失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('list')
    .description('列出文章索引')
    .option('--platform <platform>', '平台: wechat, xiaohongshu, douyin')
    .option('--since <date>', '起始日期 (ISO格式)')
    .option('--limit <number>', '返回数量')
    .action(async (opts: { platform?: string; since?: string; limit?: string }) => {
      try {
        const index = await loadIndex();
        const records = queryIndex(index, {
          platform: opts.platform as PlatformFilter | undefined,
          since: opts.since,
          limit: opts.limit ? parseInt(opts.limit) : undefined,
        });

        if (records.length === 0) {
          console.log(chalk.yellow('\n  索引为空，先运行 article index --rebuild\n'));
          return;
        }

        console.log(chalk.bold(`\n📚 文章索引 (${records.length} 条)\n`));
        for (const rec of records) {
          console.log(formatRecord(rec));
          console.log('');
        }
        console.log(chalk.gray(`  最后重建: ${index.lastRebuiltAt ? new Date(index.lastRebuiltAt).toLocaleString('zh-CN') : '从未'}`));
        console.log('');
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 查询失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('show')
    .description('显示文章详情和血缘链')
    .argument('<runId>', 'Run ID（完整或部分）')
    .action(async (runId: string) => {
      try {
        const index = await loadIndex();
        const record = getRecordById(index, runId);

        if (!record) {
          console.error(chalk.red(`\n  未找到: ${runId}\n`));
          return;
        }

        console.log(...formatLineageTree(record));
        console.log('');
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 查询失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('search')
    .description('搜索文章（标题/关键词/角度）')
    .argument('<keyword>', '搜索关键词')
    .action(async (keyword: string) => {
      try {
        const index = await loadIndex();
        const results = searchIndex(index, keyword);

        if (results.length === 0) {
          console.log(chalk.yellow(`\n  未找到匹配 "${keyword}" 的文章\n`));
          return;
        }

        console.log(chalk.bold(`\n🔍 搜索 "${keyword}" (${results.length} 条)\n`));
        for (const rec of results) {
          console.log(formatRecord(rec));
          console.log('');
        }
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 搜索失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('stats')
    .description('显示产出统计看板')
    .action(async () => {
      try {
        const index = await loadIndex();
        if (index.records.length === 0) {
          console.log(chalk.yellow('\n  索引为空\n'));
          return;
        }

        const byPlatform = { wechat: 0, xiaohongshu: 0, douyin: 0 };
        const byScenario = { create: 0, recreate: 0 };
        const byStatus = { completed: 0, partial: 0, failed: 0 };
        let totalTokenCost = 0;
        let totalReviewScore = 0;
        let scoreCount = 0;

        for (const rec of index.records) {
          byPlatform[rec.platform]++;
          byScenario[rec.scenario]++;
          byStatus[rec.status]++;
          totalTokenCost += rec.tokenCost;
          if (rec.reviewScore !== null) {
            totalReviewScore += rec.reviewScore;
            scoreCount++;
          }
        }

        console.log(chalk.bold('\n📊 内容产出统计\n'));
        console.log(`  总产出: ${chalk.white(index.records.length.toString())} 条`);
        console.log(`  原创: ${byScenario.create} | 二创: ${byScenario.recreate}`);
        console.log(`  完成: ${byStatus.completed} | 部分: ${byStatus.partial} | 失败: ${byStatus.failed}`);
        console.log('');
        console.log(chalk.gray('  平台分布:'));
        for (const [p, count] of Object.entries(byPlatform)) {
          const label = PLATFORM_LABELS[p] ?? p;
          const bar = '●'.repeat(Math.min(count, 20));
          console.log(`    ${label}: ${chalk.cyan(count.toString().padStart(3))} ${chalk.gray(bar)}`);
        }
        console.log('');
        console.log(chalk.gray(`  Token 总成本: $${totalTokenCost.toFixed(4)}`));
        if (scoreCount > 0) {
          console.log(chalk.gray(`  平均评分: ${(totalReviewScore / scoreCount).toFixed(1)} (${scoreCount} 条)`));
        }
        console.log(chalk.gray(`  索引最后重建: ${index.lastRebuiltAt ? new Date(index.lastRebuiltAt).toLocaleString('zh-CN') : '从未'}`));
        console.log('');
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 统计失败: ${String(err)}\n`));
      }
    });
}
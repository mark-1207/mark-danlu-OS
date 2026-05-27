import { Command } from 'commander';
import chalk from 'chalk';
import crypto from 'crypto';
import {
  loadCalendar,
  saveCalendar,
  addEntry,
  getEntryById,
  updateEntryStatus,
  removeEntry,
  getEntriesByMonth,
} from '../../scenarios/content-calendar/index.js';
import { runCreate } from './create.js';

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: '待办',
  planned: '待生成',
  generating: '生成中',
  published: '已发布',
  skipped: '已跳过',
};

function formatEntry(entry: { id: string; topic: string; platform: string; date: string | null; status: string; runId: string | null }): string {
  const statusColor = entry.status === 'published' ? chalk.green : entry.status === 'generating' ? chalk.cyan : chalk.gray;
  const platformLabel = PLATFORM_LABELS[entry.platform] ?? entry.platform;
  const statusLabel = STATUS_LABELS[entry.status] ?? entry.status;
  const dateStr = entry.date ?? '无期限';
  return `  ${statusColor('●')} ${chalk.white(entry.topic)}\n     ${chalk.gray(platformLabel)} | ${chalk.gray(dateStr)} | ${statusColor(statusLabel)} | ID: ${chalk.gray(entry.id.slice(0, 8))}`;
}

export function registerContentCalendarCommand(program: Command): void {
  const cmd = program
    .command('content-calendar')
    .description('内容日历：排期管理、直接触发生成');

  cmd
    .command('list')
    .description('列出日历条目')
    .option('--date <YYYY-MM>', '筛选月份')
    .action(async (opts: { date?: string }) => {
      try {
        const calendar = await loadCalendar();
        const entries = opts.date
          ? getEntriesByMonth(calendar, opts.date)
          : calendar.entries.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

        if (entries.length === 0) {
          console.log(chalk.yellow('\n  日历为空\n'));
          return;
        }

        console.log(chalk.bold(`\n📅 内容日历 (${entries.length} 条)\n`));
        for (const entry of entries) {
          console.log(formatEntry(entry));
          console.log('');
        }
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 查询失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('add')
    .description('添加日历条目')
    .requiredOption('--topic <text>', '选题主题')
    .requiredOption('--platform <platform>', '平台: wechat, xiaohongshu, douyin')
    .option('--date <YYYY-MM-DD>', '计划日期')
    .action(async (opts: { topic: string; platform: string; date?: string }) => {
      try {
        if (!['wechat', 'xiaohongshu', 'douyin'].includes(opts.platform)) {
          console.error(chalk.red('\n  无效平台: wechat/xiaohongshu/douyin\n'));
          return;
        }
        const calendar = await loadCalendar();
        const entry = addEntry(calendar, opts.topic, opts.platform as any, opts.date ?? null);
        await saveCalendar(calendar);
        console.log(chalk.green(`\n  ✅ 已添加: ${entry.topic}`));
        console.log(chalk.gray(`     ID: ${entry.id}`));
        console.log(chalk.gray(`     平台: ${PLATFORM_LABELS[entry.platform]}`));
        if (entry.date) console.log(chalk.gray(`     日期: ${entry.date}`));
        console.log(chalk.gray(`     状态: ${STATUS_LABELS[entry.status]}`));
        console.log('');
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 添加失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('generate')
    .description('从日历条目触发生成')
    .argument('<id>', '条目 ID')
    .action(async (id: string) => {
      try {
        const calendar = await loadCalendar();
        const entry = getEntryById(calendar, id);
        if (!entry) {
          console.error(chalk.red(`\n  未找到 ID: ${id}\n`));
          return;
        }
        if (entry.status === 'published') {
          console.log(chalk.yellow(`\n  ⚠️ 已发布的条目，跳过\n`));
          return;
        }

        // Mark as generating
        updateEntryStatus(calendar, id, 'generating');
        await saveCalendar(calendar);

        console.log(chalk.bold(`\n🚀 开始生成: ${entry.topic}\n`));
        console.log(chalk.gray(`   平台: ${PLATFORM_LABELS[entry.platform]}`));

        // Run create pipeline
        await runCreate(entry.topic, {
          platforms: entry.platform,
          interactive: true,
          phase: 'full',
        });

        // Mark as planned after completion
        updateEntryStatus(calendar, id, 'planned', null);
        await saveCalendar(calendar);
        console.log(chalk.green('\n  ✅ 生成完成\n'));
      } catch (err) {
        // Mark as planned on failure
        const calendar = await loadCalendar();
        updateEntryStatus(calendar, id, 'planned');
        await saveCalendar(calendar);
        console.error(chalk.red(`\n  ❌ 生成失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('mark')
    .description('更新条目状态')
    .argument('<id>', '条目 ID')
    .option('--status <status>', '状态: planned, generating, published, skipped')
    .action(async (id: string, opts: { status?: string }) => {
      try {
        const calendar = await loadCalendar();
        const entry = getEntryById(calendar, id);
        if (!entry) {
          console.error(chalk.red(`\n  未找到 ID: ${id}\n`));
          return;
        }
        if (!opts.status || !['planned', 'generating', 'published', 'skipped'].includes(opts.status)) {
          console.error(chalk.red('\n  无效状态: planned/generating/published/skipped\n'));
          return;
        }
        updateEntryStatus(calendar, id, opts.status as any);
        await saveCalendar(calendar);
        console.log(chalk.green(`\n  ✅ 状态已更新: ${STATUS_LABELS[opts.status]}\n`));
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 更新失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('remove')
    .description('删除日历条目')
    .argument('<id>', '条目 ID')
    .action(async (id: string) => {
      try {
        const calendar = await loadCalendar();
        if (!removeEntry(calendar, id)) {
          console.error(chalk.red(`\n  未找到 ID: ${id}\n`));
          return;
        }
        await saveCalendar(calendar);
        console.log(chalk.green(`\n  ✅ 已删除\n`));
      } catch (err) {
        console.error(chalk.red(`\n  ❌ 删除失败: ${String(err)}\n`));
      }
    });

  cmd
    .command('suggest')
    .description('基于选题缺口推荐排期（需先运行 article index）')
    .action(async () => {
      console.log(chalk.bold('\n💡 选题缺口建议\n'));
      console.log(chalk.gray('  (基于 article index 分析，需要先运行 article index --rebuild)\n'));
      // Placeholder for topic-gap integration
      console.log(chalk.gray('  提示: 运行 topic-gap 查看详细缺口分析\n'));
    });
}
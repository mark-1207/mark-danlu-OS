import { Command } from 'commander';
import chalk from 'chalk';
import crypto from 'crypto';
import { loadPool, savePool, addToPool, updateStatus, getTopicById, getTopicsByStatus } from '../../scenarios/topic-engine/topic-pool.js';
import { fetchAllFeeds, fetchOneFeed, DEFAULT_FEEDS } from '../../scenarios/topic-engine/rss-fetcher.js';
import { browseAndSelectTopics } from '../ui/topic-engine-tui.js';
import { isTerminalInteractive } from '../ui/interactive.js';
import type { TopicItem } from '../../scenarios/topic-engine/types.js';
import { runCreate } from './create.js';

function assignIds(items: TopicItem[]): TopicItem[] {
  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
  }));
}

function printTopic(item: TopicItem): void {
  console.log(chalk.bold(`\n${item.title}\n`));
  console.log(`  ID:      ${chalk.dim(item.id)}`);
  console.log(`  来源:    ${chalk.cyan(item.source)}`);
  console.log(`  时间:    ${chalk.cyan(new Date(item.publishedAt).toLocaleDateString('zh-CN'))}`);
  console.log(`  状态:    ${item.status}`);
  console.log(`  链接:    ${chalk.blue(item.url)}`);
  if (item.summary) {
    console.log(`\n  摘要:    ${item.summary.slice(0, 300)}`);
  }
  console.log('');
}

export async function runTopicEngineFetch(): Promise<void> {
  console.log(chalk.bold('\n📡 抓取热点选题\n'));

  const pool = await loadPool();
  let totalAdded = 0;
  let totalDuplicates = 0;

  for (const feed of DEFAULT_FEEDS.filter((f) => f.enabled)) {
    process.stdout.write(`  ${chalk.cyan(feed.name)} ... `);
    try {
      const items = await fetchOneFeed(feed);
      if (items.length === 0) {
        console.log(chalk.yellow('0 条'));
        continue;
      }
      const withIds = assignIds(items);
      const { added, duplicates } = addToPool(pool, withIds);
      totalAdded += added;
      totalDuplicates += duplicates;
      pool.lastFetchedAt = new Date().toISOString();
      console.log(chalk.green(`${items.length} 条`) + chalk.dim(` (新增${added}, 去重${duplicates})`));
    } catch (err) {
      console.log(chalk.red(`失败: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  await savePool(pool);

  if (totalAdded > 0) {
    console.log(chalk.green(`\n  ✅ 共新增 ${totalAdded} 条${totalDuplicates > 0 ? `，去重 ${totalDuplicates} 条` : ''}\n`));
  } else {
    console.log(chalk.yellow('\n  ⚠️ 未获取到新内容\n'));
  }
}

export async function runTopicEngineList(status?: string): Promise<void> {
  const pool = await loadPool();
  const items = status ? getTopicsByStatus(pool, status as any) : [...pool.topics];

  if (items.length === 0) {
    console.log(chalk.yellow('\n  选题池为空，先运行 topic-engine fetch 抓取\n'));
    return;
  }

  if (isTerminalInteractive()) {
    const selected = await browseAndSelectTopics(items);
    if (selected) {
      console.log(chalk.green(`\n  已选: ${selected.title}\n`));
      // Offer action
      const readline = await import('readline');
      const rl = readline.default.createInterface({ input: process.stdin, escapeCodeTimeout: 50000 });
      rl.question(chalk.cyan('  立即生成文章？(y/n): '), async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          updateStatus(pool, selected.id, 'selected');
          await savePool(pool);
          await runCreateForTopic(selected);
        }
      });
    }
  } else {
    console.log(chalk.bold('\n📋 选题列表\n'));
    for (const item of items) {
      const badge = item.status === 'new' ? chalk.green('●') : chalk.dim('○');
      console.log(`  ${badge} ${chalk.white(item.title)}`);
      console.log(`     ${chalk.dim(item.source)} | ${chalk.dim(new Date(item.publishedAt).toLocaleDateString('zh-CN'))} | ID: ${chalk.dim(item.id)}`);
    }
    console.log(chalk.dim(`\n  共 ${items.length} 条`));
    console.log(chalk.dim('  使用 topic-engine show <id> 查看详情\n'));
  }
}

export async function runTopicEngineShow(id: string): Promise<void> {
  const pool = await loadPool();
  const item = getTopicById(pool, id);
  if (!item) {
    console.error(chalk.red(`\n  未找到 ID 为 ${id} 的选题\n`));
    return;
  }
  printTopic(item);
}

export async function runTopicEngineSelect(id: string, generate?: boolean, platformsArg?: string): Promise<void> {
  const pool = await loadPool();
  const item = getTopicById(pool, id);
  if (!item) {
    console.error(chalk.red(`\n  未找到 ID 为 ${id} 的选题\n`));
    return;
  }

  updateStatus(pool, id, 'selected');
  await savePool(pool);
  console.log(chalk.green(`\n  ✅ 已标记选题: ${item.title}\n`));

  if (generate) {
    await runCreateForTopic(item, platformsArg);
  }
}

export async function runTopicEngineDismiss(id: string): Promise<void> {
  const pool = await loadPool();
  const item = getTopicById(pool, id);
  if (!item) {
    console.error(chalk.red(`\n  未找到 ID 为 ${id} 的选题\n`));
    return;
  }

  updateStatus(pool, id, 'dismissed');
  await savePool(pool);
  console.log(chalk.dim(`\n  ✕ 已弃用: ${item.title}\n`));
}

export async function runTopicEngineFeeds(): Promise<void> {
  console.log(chalk.bold('\n📡 配置的 RSS 源\n'));
  for (const feed of DEFAULT_FEEDS) {
    const status = feed.enabled ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${chalk.cyan(feed.name)}`);
    console.log(`     ${chalk.dim(feed.rssUrl)}`);
  }
  console.log('');
}

async function runCreateForTopic(topic: TopicItem, platformsArg?: string): Promise<void> {
  const platforms = platformsArg || '';
  const keyword = topic.title;

  try {
    await runCreate(keyword, {
      platforms: platforms || undefined,
      context: topic.summary ? `选题背景: ${topic.summary}` : undefined,
      interactive: true,
      phase: 'full',
    });
  } catch (error) {
    console.error(`\n  生成失败: ${error}\n`);
  }
}

export function registerTopicEngineCommand(program: Command): void {
  const cmd = program
    .command('topic-engine')
    .description('选题引擎：RSS 热点发现、选题池管理、一键生成')
    .hook('preAction', () => {
      // Silence logger chatter for subcommands
    });

  cmd
    .command('fetch')
    .description('抓取 RSS 热点，存入选题池')
    .action(async () => {
      await runTopicEngineFetch();
    });

  cmd
    .command('list')
    .description('浏览选题列表')
    .option('--status <status>', '筛选状态: new | selected | generated | dismissed')
    .action(async (opts: { status?: string }) => {
      await runTopicEngineList(opts.status);
    });

  cmd
    .command('show')
    .description('查看选题详情')
    .argument('<id>', '选题 ID')
    .action(async (id: string) => {
      await runTopicEngineShow(id);
    });

  cmd
    .command('select')
    .description('选中一个选题，可选直接生成')
    .argument('<id>', '选题 ID')
    .option('-g, --generate', '选中后立即生成')
    .option('-p, --platforms <platforms>', '目标平台，逗号分隔')
    .action(async (id: string, opts: { generate?: boolean; platforms?: string }) => {
      await runTopicEngineSelect(id, opts.generate, opts.platforms);
    });

  cmd
    .command('dismiss')
    .description('弃用选题')
    .argument('<id>', '选题 ID')
    .action(async (id: string) => {
      await runTopicEngineDismiss(id);
    });

  cmd
    .command('feeds')
    .description('查看配置的 RSS 源')
    .action(async () => {
      await runTopicEngineFeeds();
    });
}

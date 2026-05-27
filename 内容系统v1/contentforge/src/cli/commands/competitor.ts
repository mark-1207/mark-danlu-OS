import { Command } from 'commander';
import chalk from 'chalk';
import { loadSources, saveSources, addSource, removeSource, getSourceById } from '../../scenarios/competitor/sources-store.js';
import { watchSources, scrapeSingleSource } from '../../scenarios/competitor/watcher.js';

export function registerCompetitorCommand(program: Command): void {
  const competitor = program
    .command('competitor')
    .description('竞品账号管理 & 定期扫描');

  // list — 列出配置的账号
  competitor
    .command('list')
    .description('查看所有竞品账号')
    .action(async () => {
      const sources = await loadSources();
      if (sources.sources.length === 0) {
        console.log(chalk.yellow('尚未配置任何竞品账号'));
        console.log(chalk.gray('使用 competitor add --name <name> --url <url> 添加'));
        return;
      }

      console.log(chalk.bold('\n竞品账号列表\n'));
      sources.sources.forEach((s) => {
        const status = s.enabled ? chalk.green('●') : chalk.gray('○');
        const lastFetched = s.lastFetchedAt
          ? chalk.gray(` 上次抓取: ${new Date(s.lastFetchedAt).toLocaleString('zh-CN')}`)
          : chalk.gray(' 从未抓取');
        console.log(`  ${status} ${chalk.cyan(s.name)}`);
        console.log(`    URL: ${s.url}`);
        console.log(`    ID:  ${s.id}${lastFetched}`);
        console.log();
      });

      if (sources.lastWatchedAt) {
        console.log(chalk.gray(`全局扫描时间: ${new Date(sources.lastWatchedAt).toLocaleString('zh-CN')}`));
      }
    });

  // add — 添加竞品账号
  competitor
    .command('add')
    .description('添加竞品账号')
    .requiredOption('-n, --name <name>', '账号名称')
    .requiredOption('-u, --url <url>', 'RSS/Atom Feed URL')
    .option('-t, --type <type>', '类型', 'rss')
    .action(async (opts) => {
      const sources = await loadSources();
      const existing = sources.sources.find((s) => s.name === opts.name || s.url === opts.url);
      if (existing) {
        console.error(chalk.red(`账号已存在: ${existing.name} (${existing.url})`));
        process.exit(1);
      }

      addSource(sources, opts.name, opts.url, opts.type as 'rss');
      await saveSources(sources);
      console.log(chalk.green(`✅ 已添加竞品账号: ${opts.name}`));
      console.log(chalk.gray(`   URL: ${opts.url}`));
    });

  // remove — 删除竞品账号
  competitor
    .command('remove')
    .description('删除竞品账号')
    .argument('<id>', '账号 ID')
    .action(async (id: string) => {
      const sources = await loadSources();
      const removed = removeSource(sources, id);
      if (!removed) {
        console.error(chalk.red(`未找到账号: ${id}`));
        process.exit(1);
      }

      await saveSources(sources);
      console.log(chalk.green(`✅ 已删除账号: ${id}`));
    });

  // watch — 扫描所有 enabled 账号
  competitor
    .command('watch')
    .description('扫描所有已启用的竞品账号，抓取新文章')
    .action(async () => {
      console.log(chalk.bold('\n🔍 开始竞品扫描...\n'));

      const result = await watchSources();

      console.log(chalk.bold('\n📊 扫描结果'));
      console.log(`  总计抓取: ${result.totalScraped} 条`);
      console.log(`  新增:     ${chalk.green(String(result.newCount))} 条`);
      console.log(`  重复:     ${chalk.yellow(String(result.duplicateCount))} 条`);

      if (result.failedSources.length > 0) {
        console.log(chalk.red('\n  失败账号:'));
        for (const f of result.failedSources) {
          console.log(chalk.red(`    ${f.name}: ${f.error}`));
        }
      }

      if (result.newCount > 0) {
        console.log(chalk.green('\n✅ 新文章已缓存至 output/corpus/competitor-articles/'));
      }

      console.log();
    });

  // scrape — 手动触发单账号抓取
  competitor
    .command('scrape')
    .description('手动触发单账号抓取')
    .argument('<id>', '账号 ID')
    .action(async (id: string) => {
      const sources = await loadSources();
      const source = getSourceById(sources, id);
      if (!source) {
        console.error(chalk.red(`未找到账号: ${id}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n🔍 抓取账号: ${source.name}\n`));

      const { newCount, total } = await scrapeSingleSource(id);

      console.log(chalk.bold('\n📊 抓取结果'));
      console.log(`  账号:     ${source.name}`);
      console.log(`  总计抓取: ${total} 条`);
      console.log(`  新增:     ${chalk.green(String(newCount))} 条`);
      console.log();
    });
}
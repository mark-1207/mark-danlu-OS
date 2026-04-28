// src/cli/commands/topic.ts
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { scrapeArticle, buildCompetitorArticle } from '../../scenarios/topic/scraper.js';
import { analyzeArticle } from '../../scenarios/topic/analyzer.js';
import { writeFeishuRecord, updateFeishuRecordStatus, readFeishuRecords } from '../../scenarios/topic/feishu-sync.js';

export function registerTopicCommand(program: Command): void {
  const topic = program
    .command('topic')
    .description('竞品分析与选题工具');

  // 抓取单篇文章
  topic
    .command('scrape')
    .description('抓取单篇文章并分析')
    .requiredOption('-u, --url <url>', '文章 URL')
    .action(async (opts) => {
      try {
        // 1. 抓取
        const scrapeResult = await scrapeArticle(opts.url);
        const article = buildCompetitorArticle(scrapeResult);
        console.log(chalk.green(`抓取成功: ${article.title}`));

        // 2. AI 分析
        const analysis = await analyzeArticle(article, scrapeResult.content);

        // 3. 更新 article
        article.summary = analysis.summary;
        article.viralStructure = analysis.viralStructure;
        article.topicAngle = analysis.topicAngle;
        article.tags = analysis.tags;

        // 4. 写入飞书
        const recordId = await writeFeishuRecord(article);
        console.log(chalk.green(`已写入飞书表格，记录ID: ${recordId}`));

        // 5. 询问是否提取碎片
        const { extractFragments } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'extractFragments',
            message: '是否提取碎片入库？',
            default: false,
          },
        ]);

        if (extractFragments) {
          // Phase 2 实现
          console.log(chalk.yellow('碎片提取功能 Phase 2 实现'));
        }

        console.log(chalk.bold('\n✅ 抓取分析完成\n'));
      } catch (error) {
        console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : error}\n`));
        process.exit(1);
      }
    });

  // 列表命令（查看待分析）
  topic
    .command('list')
    .description('查看飞书表格中的竞品列表')
    .option('--status <status>', '按状态筛选 (pending|analyzed|stored)')
    .action(async (opts) => {
      try {
        const records = await readFeishuRecords();

        let filtered = records;
        if (opts.status) {
          filtered = records.filter(r => r.fields.状态 === opts.status);
        }

        console.log(chalk.bold(`\n竞品列表（共 ${filtered.length} 条）\n`));
        filtered.forEach((r, i) => {
          const f = r.fields;
          console.log(`${i + 1}. ${chalk.cyan(f['原文标题'])} [${f['平台']}] ${f['状态']}`);
          console.log(`   ${f['原始链接']}`);
        });
      } catch (error) {
        console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : error}\n`));
        process.exit(1);
      }
    });
}
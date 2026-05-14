// src/cli/commands/topic.ts
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { scrapeArticle, buildCompetitorArticle } from '../../scenarios/topic/scraper.js';
import { analyzeArticle } from '../../scenarios/topic/analyzer.js';
import { writeFeishuRecord, updateFeishuRecordStatus, readFeishuRecords } from '../../scenarios/topic/feishu-sync.js';

interface ScrapeResult {
  recordId: string;
  title: string;
  platform: string;
  summary: string;
  viralStructure: string;
  topicAngle: string;
  tags: string[];
}

/**
 * Scrape + analyze a single URL and write to Feishu. Returns analysis data.
 */
async function scrapeOne(url: string): Promise<ScrapeResult> {
  const scrapeResult = await scrapeArticle(url);
  const article = buildCompetitorArticle(scrapeResult, url);
  console.log(chalk.green(`抓取成功: ${article.title}`));

  const analysis = await analyzeArticle(article, scrapeResult.content);
  article.summary = analysis.summary;
  article.viralStructure = analysis.viralStructure;
  article.topicAngle = analysis.topicAngle;
  article.tags = analysis.tags;

  const recordId = await writeFeishuRecord(article);
  console.log(chalk.green(`已写入飞书，记录ID: ${recordId}`));

  return {
    recordId,
    title: article.title,
    platform: article.platform,
    summary: analysis.summary,
    viralStructure: analysis.viralStructure,
    topicAngle: analysis.topicAngle,
    tags: analysis.tags,
  };
}

export function registerTopicCommand(program: Command): void {
  const topic = program
    .command('topic')
    .description('竞品分析与选题工具');

  // 抓取文章（支持单条或批量）
  topic
    .command('scrape')
    .description('抓取文章并写入飞书（支持单条 --url 或批量 --file）')
    .option('-u, --url <url>', '单篇文章 URL')
    .option('-f, --file <path>', 'URL 列表文件（每行一个 URL）')
    .option('--no-interactive', '跳过碎片提取确认（批量模式自动跳过）')
    .action(async (opts) => {
      try {
        // Collect URLs
        const urls: string[] = [];
        if (opts.url) {
          urls.push(opts.url);
        }
        if (opts.file) {
          const content = await fs.readFile(opts.file, 'utf-8');
          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
          urls.push(...lines);
        }
        if (urls.length === 0) {
          console.error(chalk.red('错误: 请提供 --url 或 --file 参数'));
          process.exit(1);
        }

        // Batch mode: no interactive prompts, skip-and-continue on errors
        const isBatch = urls.length > 1;
        const interactive = !isBatch && opts.interactive !== false;

        if (isBatch) {
          console.log(chalk.bold(`\n📦 批量抓取: ${urls.length} 个 URL\n`));
        }

        const succeeded: ScrapeResult[] = [];
        const failed: { url: string; error: string }[] = [];

        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          if (isBatch) {
            console.log(chalk.gray(`\n[${i + 1}/${urls.length}] ${url}`));
          }

          try {
            const result = await scrapeOne(url);
            succeeded.push(result);

            // Output analysis data for Claude/PRISM-OS consumption
            console.log(chalk.cyan('\n--- 竞品分析 ---'));
            console.log(`标题: ${result.title}`);
            console.log(`平台: ${result.platform}`);
            console.log(`摘要: ${result.summary}`);
            console.log(`爆款结构: ${result.viralStructure}`);
            console.log(`选题角度: ${result.topicAngle}`);
            console.log(`标签: ${result.tags.join(', ')}`);
            console.log(chalk.cyan('--- end ---\n'));

            // Single-interactive mode: ask about fragment extraction
            if (interactive) {
              const { extractFragments } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'extractFragments',
                  message: '是否提取碎片入库？',
                  default: false,
                },
              ]);

              if (extractFragments) {
                const { extractSentenceFragments, extractParagraphFragments } = await import('../../scenarios/topic/extractor.js');
                const path2 = await import('path');

                const scrapeResult = await scrapeArticle(url);
                const article = buildCompetitorArticle(scrapeResult, url);
                const sentences = await extractSentenceFragments(article, scrapeResult.content);
                const paragraphs = await extractParagraphFragments(article, scrapeResult.content);

                const fragmentLibPath = path2.join(process.cwd(), 'output', 'corpus', 'fragment-library.json');
                await fs.mkdir(path2.dirname(fragmentLibPath), { recursive: true });

                let lib: Record<string, Record<string, unknown>> = { sentences: {}, paragraphs: {} };
                try {
                  lib = JSON.parse(await fs.readFile(fragmentLibPath, 'utf-8'));
                } catch { /* file doesn't exist */ }
                for (const s of sentences) lib.sentences[s.id] = s;
                for (const p of paragraphs) lib.paragraphs[p.id] = p;
                await fs.writeFile(fragmentLibPath, JSON.stringify(lib, null, 2), 'utf-8');
                console.log(chalk.green(`句式碎片 ${sentences.length} 条，段落碎片 ${paragraphs.length} 条`));

                await updateFeishuRecordStatus(result.recordId, 'stored', {
                  '碎片提取时间': new Date().toISOString(),
                });
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (isBatch) {
              console.error(chalk.red(`  失败: ${msg}`));
              failed.push({ url, error: msg });
            } else {
              throw err;
            }
          }
        }

        // Summary
        if (isBatch) {
          console.log(chalk.bold(`\n📊 批量抓取完成`));
          console.log(`  成功: ${chalk.green(String(succeeded.length))}`);
          console.log(`  失败: ${chalk.red(String(failed.length))}`);
          if (failed.length > 0) {
            console.log(chalk.gray('\n失败列表:'));
            for (const f of failed) {
              console.log(chalk.gray(`  ${f.url} — ${f.error}`));
            }
          }
        } else {
          console.log(chalk.bold('\n✅ 抓取分析完成\n'));
        }
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
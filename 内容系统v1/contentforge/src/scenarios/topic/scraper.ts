import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import type { CompetitorArticle, Platform } from './types.js';

interface ScrapeResult {
  title: string;
  content: string;
  platform: Platform;
  url: string;
}

function execAutocli(args: string[]): string {
  try {
    return execSync(`npx autocli ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`autocli 执行失败: ${msg}`);
  }
}

/**
 * 抓取单篇文章
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  console.log(chalk.cyan(`正在抓取: ${url}`));

  const output = execAutocli(['scrape', '--url', url, '--format', 'json']);

  let parsed: { title: string; content: string; platform: Platform };
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`autocli 解析失败，原始输出: ${output.slice(0, 200)}`);
  }

  if (!parsed.title || !parsed.content) {
    throw new Error(`抓取结果缺少 title 或 content: ${output.slice(0, 200)}`);
  }

  return parsed;
}

/**
 * 构建 CompetitorArticle 对象
 */
export function buildCompetitorArticle(
  result: ScrapeResult,
  source: 'crawled' | 'manual' = 'crawled'
): CompetitorArticle {
  return {
    id: randomUUID(),
    title: result.title,
    url: result.url,
    platform: result.platform,
    tags: [],
    source,
    isFavorite: false,
    status: 'pending',
    crawledAt: new Date().toISOString(),
  };
}

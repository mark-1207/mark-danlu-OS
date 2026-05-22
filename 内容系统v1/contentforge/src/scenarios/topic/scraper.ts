import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile, rm } from 'fs/promises';
import chalk from 'chalk';
import type { CompetitorArticle, Platform } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ScrapeResult {
  title: string;
  content: string;
  platform: Platform;
  url: string;
}

function execAutocli(args: string[]): string {
  const autocliExe = join(process.cwd(), 'autocli.exe');
  try {
    return execSync(`"${autocliExe}" ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`autocli 执行失败: ${msg}`);
  }
}

function inferPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes('mp.weixin.qq.com')) return 'wechat';
  if (u.includes('zhihu.com')) return 'zhihu';
  if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
  if (u.includes('xiaohongshu.com')) return 'xiaohongshu';
  return 'wechat';
}

/**
 * 抓取单篇文章 — 优先 autocli，失败时降级到 wechat-article-extractor skill
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  console.log(chalk.cyan(`正在抓取: ${url}`));

  const isWechat = /mp\.weixin\.qq\.com/i.test(url);
  let title: string;
  let content: string;

  if (isWechat) {
    // 优先 autocli weixin download
    try {
      const output = execAutocli(['weixin', 'download', url, '--format', 'json']);
      let parsed: { title: string; path: string; status: string };
      try {
        const arr = JSON.parse(output);
        parsed = Array.isArray(arr) ? arr[0] : arr;
      } catch {
        throw new Error(`weixin download 解析失败: ${output.slice(0, 200)}`);
      }
      if (parsed.status !== 'ok') {
        throw new Error(`weixin download 失败: ${output}`);
      }
      title = parsed.title;
      const mdPath = parsed.path;
      const raw = await readFile(mdPath, 'utf-8');
      content = raw.replace(/^---[\s\S]*?---\n/, '').trim();
      try {
        await rm(dirname(mdPath), { recursive: true, force: true });
      } catch { /* ignore */ }
    } catch (autocliError) {
      // 降级到 wechat-article-extractor skill
      console.log(chalk.yellow(`autocli 失败，降级到 wechat-article-extractor: ${autocliError}`));
      const { extract } = await import(
        'C:\\Users\\admin\\.claude\\skills\\wechat-article-extractor\\scripts\\extract.js'
      );
      const result = await extract(url, { shouldReturnContent: true });
      if (!result.done) {
        throw new Error(`wechat-article-extractor 也失败: code=${result.code} msg=${result.msg}`);
      }
      title = result.data.msg_title;
      // 提取纯文本（去掉HTML标签）
      content = result.data.msg_content.replace(/<[^>]+>/g, '').trim();
    }
  } else {
    try {
      const output = execAutocli(['read', url, '--format', 'json']);
      let parsed: { title: string; byline?: string; content: string };
      try {
        parsed = JSON.parse(output);
      } catch {
        throw new Error(`autocli 解析失败: ${output.slice(0, 200)}`);
      }
      if (!parsed.title || !parsed.content) {
        throw new Error(`抓取结果缺少 title 或 content: ${output.slice(0, 200)}`);
      }
      title = parsed.title;
      content = parsed.content;
    } catch (autocliError) {
      console.log(chalk.yellow(`autocli 失败，降级到通用抓取: ${autocliError}`));
      // 非微信平台暂无降级 skill，直接抛错
      throw autocliError;
    }
  }

  return {
    title,
    content,
    platform: inferPlatform(url),
    url,
  };
}

/**
 * 构建 CompetitorArticle 对象
 */
export function buildCompetitorArticle(
  result: ScrapeResult,
  url: string,
  source: 'crawled' | 'manual' = 'crawled'
): CompetitorArticle {
  return {
    id: randomUUID(),
    title: result.title,
    url,
    platform: result.platform,
    content: result.content,
    tags: [],
    source,
    isFavorite: false,
    status: 'pending',
    crawledAt: new Date().toISOString(),
  };
}
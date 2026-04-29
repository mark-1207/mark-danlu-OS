import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { readFeishuRecords } from './feishu-sync.js';
import type { CompetitorInsight, FeishuRecord } from './types.js';

const CACHE_DIR = path.join(process.cwd(), 'output', 'corpus', 'competitor-insights');

export interface CompetitorCacheEntry {
  keyword: string;
  cachedAt: string;
  insights: CompetitorInsight;
  recordCount: number;
}

/**
 * 缓存 key：keyword 的 MD5
 */
export function cacheKey(keyword: string): string {
  return crypto.createHash('md5').update(keyword).digest('hex');
}

/**
 * 读取缓存文件（如果存在）
 */
export async function readCache(keyword: string): Promise<CompetitorCacheEntry | null> {
  const filePath = path.join(CACHE_DIR, `${cacheKey(keyword)}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as CompetitorCacheEntry;
  } catch {
    return null;
  }
}

/**
 * 写入缓存文件
 */
export async function writeCache(keyword: string, insights: CompetitorInsight, recordCount: number): Promise<void> {
  const entry: CompetitorCacheEntry = {
    keyword,
    cachedAt: new Date().toISOString(),
    insights,
    recordCount,
  };
  const filePath = path.join(CACHE_DIR, `${cacheKey(keyword)}.json`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * 读取飞书竞品数据，过滤 analyzed/stored 状态，优先收藏，取最新10条
 */
export async function fetchCompetitiveRecords(): Promise<FeishuRecord[]> {
  const all = await readFeishuRecords();
  return all
    .filter((r) => r.fields.状态 === 'analyzed' || r.fields.状态 === 'stored')
    .sort((a, b) => {
      if (a.fields.收藏 !== b.fields.收藏) return a.fields.收藏 ? -1 : 1;
      return new Date(b.fields.抓取时间).getTime() - new Date(a.fields.抓取时间).getTime();
    })
    .slice(0, 10);
}

/**
 * 判断缓存是否过期：飞书最新抓取时间 > cachedAt
 */
export async function isCacheExpired(keyword: string, cachedAt: string): Promise<boolean> {
  const all = await readFeishuRecords();
  if (all.length === 0) return false;
  const latestCrawl = all
    .map((r) => new Date(r.fields.抓取时间).getTime())
    .reduce((max, t) => Math.max(max, t), 0);
  return latestCrawl > new Date(cachedAt).getTime();
}

/**
 * 格式化飞书记录为 AI 聚合素材
 */
export function formatRecordsForPrompt(records: FeishuRecord[]): string {
  if (records.length === 0) return '';
  return records
    .map((r) => {
      const f = r.fields;
      const parts: string[] = [];
      if (f.原文标题) parts.push(`标题：${f.原文标题}`);
      if (f.选题角度) parts.push(`角度：${f.选题角度}`);
      if (f.爆款结构) parts.push(`结构：${f.爆款结构}`);
      parts.push(`平台：${f.平台}`);
      if (f.收藏) parts.push('【已收藏】');
      return parts.join(' | ');
    })
    .join('\n');
}
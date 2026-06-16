import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import type { CompetitorSources, ScrapedArticle, WatchResult } from './types.js';
import { scrapeSource } from './scraper.js';
import { loadSources, saveSources, getEnabledSources, updateLastFetched, updateLastWatched } from './sources-store.js';

const SCRAPED_INDEX_PATH = path.join(process.cwd(), 'output', 'corpus', 'competitor-articles', 'scraped-index.json');
const SCRAPED_DIR = path.join(process.cwd(), 'output', 'corpus', 'competitor-articles');

interface ScrapedIndex {
  urls: string[];
}

// Levenshtein from topic-pool.ts
function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = i;
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const val = a[i - 1] === b[j - 1] ? matrix[j - 1] : Math.min(matrix[j - 1] + 1, prev + 1, matrix[j] + 1);
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[bn] = prev;
  }
  return matrix[bn];
}

function titleSimilar(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.length === 0) return 1;
  return 1 - levenshtein(shorter, longer) / longer.length;
}

async function loadScrapedIndex(): Promise<ScrapedIndex> {
  try {
    const content = await fs.readFile(SCRAPED_INDEX_PATH, 'utf-8');
    return JSON.parse(content) as ScrapedIndex;
  } catch {
    return { urls: [] };
  }
}

async function saveScrapedIndex(index: ScrapedIndex): Promise<void> {
  await fs.mkdir(SCRAPED_DIR, { recursive: true });
  await fs.writeFile(SCRAPED_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

function isDuplicate(newArticle: ScrapedArticle, existingUrls: string[], threshold = 0.85): boolean {
  // URL exact match
  if (existingUrls.includes(newArticle.url)) return true;

  // Title similarity check
  for (const url of existingUrls) {
    // Extract title from existing URL reference (stored separately)
    // For now, just use URL match
  }
  return false;
}

export async function watchSources(): Promise<WatchResult> {
  const sources = await loadSources();
  const enabledSources = getEnabledSources(sources);

  if (enabledSources.length === 0) {
    logger.info('[competitor-watch] no enabled sources');
    return { newCount: 0, duplicateCount: 0, failedSources: [], totalScraped: 0 };
  }

  const index = await loadScrapedIndex();
  let newCount = 0;
  let duplicateCount = 0;
  const failedSources: Array<{ id: string; name: string; error: string }> = [];
  let totalScraped = 0;

  const results = await Promise.allSettled(
    enabledSources.map(async (source) => {
      const articles = await scrapeSource(source);
      return { source, articles };
    })
  );

  const newUrls: string[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      const err = result.reason;
      // Extract source info from error message
      failedSources.push({ id: '', name: 'unknown', error: String(err) });
      continue;
    }

    const { source, articles } = result.value;
    totalScraped += articles.length;

    for (const article of articles) {
      const isNew = !index.urls.includes(article.url) &&
        !index.urls.some((u) => {
          // Also check title similarity
          const similarity = titleSimilar(article.title, u);
          return similarity > 0.85;
        });

      if (isNew) {
        // Write article to local cache
        const articleFile = path.join(SCRAPED_DIR, `${Buffer.from(article.url).toString('base64').slice(0, 20)}.json`);
        await fs.writeFile(articleFile, JSON.stringify(article, null, 2), 'utf-8');
        newUrls.push(article.url);
        newCount++;
        logger.info(`[competitor-watch] new article: ${article.title}`);
      } else {
        duplicateCount++;
      }
    }

    // Update last fetched timestamp
    updateLastFetched(sources, source.id);
  }

  // Update index
  index.urls.push(...newUrls);
  await saveScrapedIndex(index);

  // Update last watched timestamp
  updateLastWatched(sources);
  await saveSources(sources);

  return { newCount, duplicateCount, failedSources, totalScraped };
}

export async function scrapeSingleSource(sourceId: string): Promise<{ newCount: number; total: number }> {
  const sources = await loadSources();
  const source = sources.sources.find((s) => s.id === sourceId);
  if (!source) throw new Error(`Source not found: ${sourceId}`);

  const articles = await scrapeSource(source);
  const index = await loadScrapedIndex();

  let newCount = 0;
  for (const article of articles) {
    if (!index.urls.includes(article.url)) {
      const articleFile = path.join(SCRAPED_DIR, `${Buffer.from(article.url).toString('base64').slice(0, 20)}.json`);
      await fs.writeFile(articleFile, JSON.stringify(article, null, 2), 'utf-8');
      index.urls.push(article.url);
      newCount++;
    }
  }

  await saveScrapedIndex(index);
  updateLastFetched(sources, source.id);
  await saveSources(sources);

  return { newCount, total: articles.length };
}
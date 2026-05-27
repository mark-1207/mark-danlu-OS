import type { CompetitorSource, ScrapedArticle } from './types.js';
import { parseRSS, parseAtom } from '../../scenarios/topic-engine/rss-fetcher.js';

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentForge/1.0)' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

function isAtom(xml: string): boolean {
  return /<feed[\s>]/i.test(xml);
}

export async function scrapeSource(source: CompetitorSource): Promise<ScrapedArticle[]> {
  try {
    const xml = await fetchFeed(source.url);
    const now = new Date().toISOString();

    let items: ScrapedArticle[];
    if (isAtom(xml)) {
      items = parseAtom(xml, source.name).map((item) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        snippet: item.summary ?? '',
        source: source.name,
      }));
    } else {
      items = parseRSS(xml, source.name).map((item) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        snippet: item.summary ?? '',
        source: source.name,
      }));
    }

    return items;
  } catch (err) {
    throw new Error(`[${source.name}] scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
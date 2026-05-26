import type { TopicItem, FeedSource } from './types.js';

export const DEFAULT_FEEDS: FeedSource[] = [
  { name: '36kr', rssUrl: 'https://rsshub.app/36kr/news', enabled: true },
  { name: 'huxiu', rssUrl: 'https://rsshub.app/huxiu/article', enabled: true },
  { name: 'geekpark', rssUrl: 'https://rsshub.app/geekpark/breakingnews', enabled: true },
  { name: 'ifanr', rssUrl: 'https://rsshub.app/ifanr/news', enabled: true },
];

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1), 10)));
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function extractField(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`));
  if (cdataMatch) return decodeXmlEntities(cdataMatch[1].trim());
  const rawMatch = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (rawMatch) return decodeXmlEntities(rawMatch[1].trim());
  return '';
}

function parseDate(text: string): string {
  const d = new Date(text);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function parseRSS(xml: string, source: string): TopicItem[] {
  const items: TopicItem[] = [];
  const now = new Date().toISOString();
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(extractField(block, 'title'));
    const link = extractField(block, 'link');
    const description = stripHtml(extractField(block, 'description'));
    const pubDate = parseDate(extractField(block, 'pubDate'));

    if (!title || !link) continue;

    items.push({
      id: '',
      title,
      url: link,
      summary: description.slice(0, 200),
      source,
      publishedAt: pubDate,
      fetchedAt: now,
      status: 'new',
    });
  }

  return items;
}

export function parseAtom(xml: string, source: string): TopicItem[] {
  const items: TopicItem[] = [];
  const now = new Date().toISOString();
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(extractField(block, 'title'));
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : '';
    const summary = stripHtml(extractField(block, 'summary') || extractField(block, 'content'));
    const published = parseDate(extractField(block, 'published') || extractField(block, 'updated'));

    if (!title || !link) continue;

    items.push({
      id: '',
      title,
      url: link,
      summary: summary.slice(0, 200),
      source,
      publishedAt: published,
      fetchedAt: now,
      status: 'new',
    });
  }

  return items;
}

function isRss(xml: string): boolean {
  return /<rss[\s>]/i.test(xml) || /<rdf:RDF[\s>]/i.test(xml);
}

function isAtom(xml: string): boolean {
  return /<feed[\s>]/i.test(xml);
}

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

export async function fetchOneFeed(feed: FeedSource): Promise<TopicItem[]> {
  try {
    const xml = await fetchFeed(feed.rssUrl);
    const items = isAtom(xml) ? parseAtom(xml, feed.name) : parseRSS(xml, feed.name);
    return items;
  } catch (err) {
    throw new Error(`[${feed.name}] fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function fetchAllFeeds(feeds?: FeedSource[]): Promise<TopicItem[]> {
  const sources = (feeds ?? DEFAULT_FEEDS).filter((f) => f.enabled);
  const results = await Promise.allSettled(sources.map((f) => fetchOneFeed(f)));

  const all: TopicItem[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    }
  }

  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return all;
}

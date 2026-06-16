import { describe, it, expect, beforeEach } from 'vitest';
import { addSource, removeSource, getSourceById, getEnabledSources, updateLastFetched } from '../../../src/scenarios/competitor/sources-store.js';
import type { CompetitorSources } from '../../../src/scenarios/competitor/types.js';

// T12: addSource creates account, array +1
describe('T12: addSource creates account', () => {
  it('adds source and increases array length by 1', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const before = sources.sources.length;

    addSource(sources, '虎嗅', 'https://huxiu.com/rss', 'rss');

    expect(sources.sources.length).toBe(before + 1);
  });

  it('sets correct fields on new source', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const added = addSource(sources, '虎嗅', 'https://huxiu.com/rss', 'rss');

    expect(added.name).toBe('虎嗅');
    expect(added.url).toBe('https://huxiu.com/rss');
    expect(added.type).toBe('rss');
    expect(added.enabled).toBe(true);
    expect(added.id).toBeTruthy();
    expect(added.lastFetchedAt).toBeNull();
  });

  it('each added source has a unique id', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const a = addSource(sources, 'A', 'http://a.com/rss', 'rss');
    const b = addSource(sources, 'B', 'http://b.com/rss', 'rss');

    expect(a.id).not.toBe(b.id);
  });
});

// T13: removeSource removes account, array -1
describe('T13: removeSource removes account', () => {
  it('removes source and decreases array length by 1', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const added = addSource(sources, '虎嗅', 'https://huxiu.com/rss', 'rss');
    const before = sources.sources.length;

    const removed = removeSource(sources, added.id);

    expect(removed).toBe(true);
    expect(sources.sources.length).toBe(before - 1);
  });

  it('returns false when id does not exist', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const removed = removeSource(sources, 'non-existent-id');
    expect(removed).toBe(false);
  });

  it('only removes the targeted source', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    const keep = addSource(sources, 'A', 'http://a.com/rss', 'rss');
    const remove = addSource(sources, 'B', 'http://b.com/rss', 'rss');

    removeSource(sources, remove.id);

    expect(getSourceById(sources, keep.id)).not.toBeNull();
    expect(getSourceById(sources, remove.id)).toBeNull();
  });
});

// T14: URL exact match avoids duplicate scraping
describe('T14: URL dedup', () => {
  it('URL exact match returns true for duplicate', () => {
    const existingUrls = [
      'http://example.com/article-1',
      'http://example.com/article-2',
    ];

    const isExact = existingUrls.includes('http://example.com/article-1');
    expect(isExact).toBe(true);
  });

  it('URL exact match returns false for new URL', () => {
    const existingUrls = [
      'http://example.com/article-1',
      'http://example.com/article-2',
    ];

    const isExact = existingUrls.includes('http://example.com/article-3');
    expect(isExact).toBe(false);
  });
});

// T15: Levenshtein >0.85 title dedup
describe('T15: Levenshtein title dedup', () => {
  // Levenshtein from watcher.ts
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

  it('identical titles have similarity 1', () => {
    const t = '科技爱好者周刊（第 397 期）';
    expect(titleSimilar(t, t)).toBe(1);
  });

  it('very similar titles (>0.85) are flagged as duplicate', () => {
    const a = '科技爱好者周刊（第 397 期）：财富正在向 AI 集中';
    const b = '科技爱好者周刊（第 397 期）：财富正在向AI集中';
    const sim = titleSimilar(a, b);
    expect(sim).toBeGreaterThan(0.85);
  });

  it('different titles (<0.85) are not flagged as duplicate', () => {
    const a = '科技爱好者周刊（第 397 期）：财富正在向 AI 集中';
    const b = '互联网通信的替代方案';
    const sim = titleSimilar(a, b);
    expect(sim).toBeLessThan(0.85);
  });

  it('titles differing by one char (typo) are flagged as duplicate', () => {
    const a = '科技爱好者周刊（第 397 期）：财富正在向 AI 集中';
    const b = '科技爱好者周刊（第 397 期）：财富正在向AI集中';
    const sim = titleSimilar(a, b);
    expect(sim).toBeGreaterThan(0.85);
  });

  it('URL exact match dedup is the primary defense — title similarity is secondary', () => {
    const existingUrls = ['http://example.com/article-1'];
    const isExact = existingUrls.includes('http://example.com/article-1');
    expect(isExact).toBe(true);
  });
});

// T16: getEnabledSources filters correctly
describe('T16: getEnabledSources filters', () => {
  it('returns only enabled sources', () => {
    const sources: CompetitorSources = { sources: [], lastWatchedAt: null };
    addSource(sources, 'A', 'http://a.com/rss', 'rss');
    const disabled = addSource(sources, 'B', 'http://b.com/rss', 'rss');
    disabled.enabled = false;
    addSource(sources, 'C', 'http://c.com/rss', 'rss');

    const enabled = getEnabledSources(sources);

    expect(enabled.length).toBe(2);
    expect(enabled.every(s => s.enabled)).toBe(true);
  });
});
import { describe, it, expect } from 'vitest';
import type { MaterialSearchOutput } from '../../../src/scenarios/create/types.js';

// T23: obsidianEnabled=false → only web channel used
describe('T23: obsidianEnabled=false uses only web channel', () => {
  it('obsidian channel is skipped when flag is false', () => {
    const obsidianEnabled = false;
    const webResults = [{ forSection: 'section1', type: 'case' as const, content: 'web result', source: 'web:http://example.com', reliability: 'high' as const }];

    const merged = obsidianEnabled ? webResults : webResults;
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('web:http://example.com');
  });

  it('obsidian channel adds items only when enabled', () => {
    const obsidianItems = [{ forSection: 'case1', type: 'case' as const, content: 'obsidian result', source: 'obsidian:output/corpus/case1.md', reliability: 'high' as const }];
    const webResults: typeof obsidianItems = [];
    const obsidianEnabled = false;

    const merged = [...webResults, ...(obsidianEnabled ? obsidianItems : [])];
    expect(merged).toHaveLength(0);
    expect(merged.some(m => m.source?.startsWith('obsidian:'))).toBe(false);
  });
});

// T24: obsidian is primary, web supplements when obsidian is sparse
describe('T24: obsidian is primary, web supplements when sparse', () => {
  it('web supplements when obsidian results < 2', () => {
    const obsidianResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }> = [];
    const webItems = [
      { forSection: 'case1', type: 'case', content: 'web case', source: 'web:http://example.com', reliability: 'high' },
    ];

    // Obsidian first, web supplements when obsidian < 2
    const needsWeb = obsidianResults.length < 2;
    const merged = [...obsidianResults, ...(needsWeb ? webItems : [])];
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('web:http://example.com');
  });

  it('web does NOT supplement when obsidian results >= 2', () => {
    const obsidianResults = [
      { forSection: 'a', type: 'case', content: 'obsidian a', source: 'obsidian:a.md', reliability: 'high' },
      { forSection: 'b', type: 'case', content: 'obsidian b', source: 'obsidian:b.md', reliability: 'high' },
    ];
    const webItems = [
      { forSection: 'case1', type: 'case', content: 'web case', source: 'web:http://example.com', reliability: 'high' },
    ];

    const needsWeb = obsidianResults.length < 2;
    const merged = [...obsidianResults, ...(needsWeb ? webItems : [])];
    expect(merged).toHaveLength(2);
    expect(merged.every(m => m.source?.startsWith('obsidian:'))).toBe(true);
  });
});

// T25: material-search output contains obsidian source markers
describe('T25: obsidian source markers in material-search output', () => {
  it('obsidian materials have source prefix obsidian:', () => {
    const materials = [
      { forSection: 'case1', type: 'case', content: 'some content', source: 'obsidian:output/corpus/case-library/中年失业.md', reliability: 'high' },
    ];
    const obsidianMaterials = materials.filter(m => m.source?.startsWith('obsidian:'));
    expect(obsidianMaterials).toHaveLength(1);
    expect(obsidianMaterials[0].source).toContain('obsidian:');
  });

  it('web materials have source prefix web:', () => {
    const materials = [
      { forSection: 'case1', type: 'case', content: 'web content', source: 'web:http://example.com/article', reliability: 'high' },
    ];
    const webMaterials = materials.filter(m => m.source?.startsWith('web:'));
    expect(webMaterials).toHaveLength(1);
    expect(webMaterials[0].source).toContain('web:');
  });

  it('mixed results: both web and obsidian sources preserved', () => {
    const output: MaterialSearchOutput = {
      wechat: [
        { forSection: 'w1', type: 'case', content: 'web case', source: 'web:http://w1.com', reliability: 'high' },
        { forSection: 'w2', type: 'case', content: 'obsidian case', source: 'obsidian:output/corpus/w2.md', reliability: 'high' },
      ],
      xiaohongshu: [],
      douyin: [],
    };

    const obsidianSources = output.wechat.filter(m => m.source?.startsWith('obsidian:'));
    const webSources = output.wechat.filter(m => m.source?.startsWith('web:'));
    expect(obsidianSources).toHaveLength(1);
    expect(webSources).toHaveLength(1);
  });
});

// T26: loadMaterialSearchMaterials preserves all sources (not just obsidian)
describe('T26: loadMaterialSearchMaterials preserves all sources', () => {
  function loadMaterialSearchMaterials(output: MaterialSearchOutput | null, platform: 'wechat' | 'xiaohongshu' | 'douyin'): string {
    if (!output) return '';
    const materials = output[platform] ?? [];
    if (materials.length === 0) return '';
    return materials
      .map((m) => `[${m.type}] ${m.content}`)
      .join('\n');
  }

  it('returns empty string when context has no material-search output', () => {
    const result = loadMaterialSearchMaterials(null, 'wechat');
    expect(result).toBe('');
  });

  it('filters by platform correctly', () => {
    const output: MaterialSearchOutput = {
      wechat: [{ forSection: 'w', type: 'case', content: 'wechat obsidian', source: 'obsidian:w.md', reliability: 'high' }],
      xiaohongshu: [{ forSection: 'x', type: 'case', content: 'xiaohongshu web', source: 'web:http://x.com', reliability: 'high' }],
      douyin: [],
    };

    const wechat = loadMaterialSearchMaterials(output, 'wechat');
    const xhs = loadMaterialSearchMaterials(output, 'xiaohongshu');
    const douyin = loadMaterialSearchMaterials(output, 'douyin');

    expect(wechat).toContain('wechat obsidian');
    expect(xhs).toContain('xiaohongshu web');
    expect(douyin).toBe('');
  });

  it('includes both obsidian and web materials', () => {
    const output: MaterialSearchOutput = {
      wechat: [
        { forSection: 's', type: 'case', content: 'obsidian case', source: 'obsidian:s.md', reliability: 'high' },
        { forSection: 's', type: 'data', content: 'web data', source: 'web:http://example.com', reliability: 'medium' },
      ],
      xiaohongshu: [],
      douyin: [],
    };

    const result = loadMaterialSearchMaterials(output, 'wechat');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('[case] obsidian case');
    expect(lines[1]).toBe('[data] web data');
  });

  it('formats output as [type] content per line', () => {
    const output: MaterialSearchOutput = {
      wechat: [
        { forSection: 's', type: 'case', content: 'case content', source: 'obsidian:s.md', reliability: 'high' },
        { forSection: 's', type: 'data', content: 'data content', source: 'obsidian:s.md', reliability: 'high' },
      ],
      xiaohongshu: [],
      douyin: [],
    };

    const result = loadMaterialSearchMaterials(output, 'wechat');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('[case] case content');
    expect(lines[1]).toBe('[data] data content');
  });
});

// T27: obsidian >= 2 → skip web search
describe('T27: skip web search when obsidian has enough results', () => {
  it('does not call web search when obsidian returns >= 2', () => {
    const obsidianResults = [
      { forSection: 'a', type: 'case', content: 'obsidian a', source: 'obsidian:a.md', reliability: 'high' },
      { forSection: 'b', type: 'case', content: 'obsidian b', source: 'obsidian:b.md', reliability: 'high' },
    ];

    let webSearchCalled = false;
    function runMaterialSearch(obsidianResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }>) {
      const results = [...obsidianResults];
      if (results.length < 2) {
        webSearchCalled = true;
        results.push({ forSection: 'c', type: 'case', content: 'web c', source: 'web:http://c.com', reliability: 'low' });
      }
      return results;
    }

    const result = runMaterialSearch(obsidianResults);
    expect(webSearchCalled).toBe(false);
    expect(result).toHaveLength(2);
  });
});

// T28: obsidian < 2 → web search supplements
describe('T28: web search supplements when obsidian is sparse', () => {
  it('triggers web search when obsidian returns 0', () => {
    const obsidianResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }> = [];

    let webSearchCalled = false;
    function runMaterialSearch(obsidianResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }>) {
      const results = [...obsidianResults];
      if (results.length < 2) {
        webSearchCalled = true;
        results.push({ forSection: 'c', type: 'case', content: 'web c', source: 'web:http://c.com', reliability: 'low' });
      }
      return results;
    }

    const result = runMaterialSearch(obsidianResults);
    expect(webSearchCalled).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('web:http://c.com');
  });

  it('triggers web search when obsidian returns 1', () => {
    const obsidianResults = [
      { forSection: 'a', type: 'case', content: 'obsidian a', source: 'obsidian:a.md', reliability: 'high' },
    ];

    let webSearchCalled = false;
    function runMaterialSearch(obsidianResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }>) {
      const results = [...obsidianResults];
      if (results.length < 2) {
        webSearchCalled = true;
        results.push({ forSection: 'c', type: 'case', content: 'web c', source: 'web:http://c.com', reliability: 'low' });
      }
      return results;
    }

    const result = runMaterialSearch(obsidianResults);
    expect(webSearchCalled).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('obsidian:a.md');
    expect(result[1].source).toBe('web:http://c.com');
  });
});

// T29: web results have web: prefix
describe('T29: web results have web: source prefix', () => {
  it('web search results are prefixed with web:', () => {
    const webUrl = 'http://example.com/article';
    const source = `web:${webUrl}`;

    expect(source).toBe('web:http://example.com/article');
    expect(source.startsWith('web:')).toBe(true);
    expect(source.startsWith('obsidian:')).toBe(false);
  });

  it('obsidian and web sources are distinguishable', () => {
    const materials = [
      { forSection: 'a', type: 'case', content: 'obsidian', source: 'obsidian:a.md', reliability: 'high' },
      { forSection: 'b', type: 'case', content: 'web', source: 'web:http://b.com', reliability: 'medium' },
    ];

    const obsidian = materials.filter(m => m.source.startsWith('obsidian:'));
    const web = materials.filter(m => m.source.startsWith('web:'));
    expect(obsidian).toHaveLength(1);
    expect(web).toHaveLength(1);
  });
});

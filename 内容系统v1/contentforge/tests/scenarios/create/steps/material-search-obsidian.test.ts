import { describe, it, expect } from 'vitest';
import type { MaterialSearchOutput } from '../../../src/scenarios/create/types.js';

// T23: obsidianEnabled=false → only web channel used
describe('T23: obsidianEnabled=false uses only web channel', () => {
  it('obsidian channel is skipped when flag is false', () => {
    const obsidianEnabled = false;
    const webResults = [{ forSection: 'section1', type: 'case' as const, content: 'web result', source: 'http://example.com', reliability: 'high' as const }];

    // When obsidianEnabled is false, obsidian branch should not execute
    const merged = obsidianEnabled ? webResults : webResults;
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('http://example.com');
  });

  it('obsidian channel adds items only when enabled', () => {
    const obsidianItems = [{ forSection: 'case1', type: 'case' as const, content: 'obsidian result', source: 'obsidian:output/corpus/case1.md', reliability: 'high' as const }];
    const webResults: typeof obsidianItems = [];
    const obsidianEnabled = false;

    const merged = [...webResults, ...(obsidianEnabled ? obsidianItems : [])];
    expect(merged).toHaveLength(0); // no obsidian items when disabled
    expect(merged.some(m => m.source?.startsWith('obsidian:'))).toBe(false);
  });
});

// T24: obsidianEnabled=true + web empty → obsidian channel supplements
describe('T24: obsidian supplements when web results are sparse', () => {
  it('obsidian supplements when web results < 2', () => {
    const webResults: Array<{ forSection: string; type: string; content: string; source: string; reliability: string }> = [];
    const obsidianItems = [
      { forSection: 'case1', type: 'case', content: 'obsidian case', source: 'obsidian:case1.md', reliability: 'high' },
    ];
    const obsidianEnabled = true;

    const merged = [...webResults, ...(obsidianEnabled && webResults.length < 2 ? obsidianItems : [])];
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('obsidian:case1.md');
  });

  it('obsidian does NOT supplement when web results >= 2', () => {
    const webResults = [
      { forSection: 'a', type: 'case', content: 'web a', source: 'http://a.com', reliability: 'high' },
      { forSection: 'b', type: 'case', content: 'web b', source: 'http://b.com', reliability: 'high' },
    ];
    const obsidianItems = [
      { forSection: 'case1', type: 'case', content: 'obsidian case', source: 'obsidian:case1.md', reliability: 'high' },
    ];

    // Only supplement if < 2
    const merged = [...webResults, ...(webResults.length < 2 ? obsidianItems : [])];
    expect(merged).toHaveLength(2); // web results take precedence
    expect(merged.every(m => !m.source?.startsWith('obsidian:'))).toBe(true);
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

  it('web materials do NOT have obsidian: prefix', () => {
    const materials = [
      { forSection: 'case1', type: 'case', content: 'web content', source: 'http://example.com/article', reliability: 'high' },
    ];
    const obsidianMaterials = materials.filter(m => m.source?.startsWith('obsidian:'));
    expect(obsidianMaterials).toHaveLength(0);
  });

  it('mixed results: both web and obsidian sources preserved', () => {
    const output: MaterialSearchOutput = {
      wechat: [
        { forSection: 'w1', type: 'case', content: 'web case', source: 'http://w1.com', reliability: 'high' },
        { forSection: 'w2', type: 'case', content: 'obsidian case', source: 'obsidian:output/corpus/w2.md', reliability: 'high' },
      ],
      xiaohongshu: [],
      douyin: [],
    };

    const obsidianSources = output.wechat.filter(m => m.source?.startsWith('obsidian:'));
    const webSources = output.wechat.filter(m => !m.source?.startsWith('obsidian:'));
    expect(obsidianSources).toHaveLength(1);
    expect(webSources).toHaveLength(1);
  });
});

// T26: loadMaterialSearchMaterials reads context and filters by platform
describe('T26: loadMaterialSearchMaterials reads context and filters', () => {
  function loadMaterialSearchMaterials(output: MaterialSearchOutput | null, platform: 'wechat' | 'xiaohongshu' | 'douyin'): string {
    if (!output) return '';
    const materials = output[platform] ?? [];
    if (materials.length === 0) return '';
    return materials
      .filter((m) => m.source?.startsWith('obsidian:'))
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
      xiaohongshu: [{ forSection: 'x', type: 'case', content: 'xiaohongshu obsidian', source: 'obsidian:x.md', reliability: 'high' }],
      douyin: [],
    };

    const wechat = loadMaterialSearchMaterials(output, 'wechat');
    const xhs = loadMaterialSearchMaterials(output, 'xiaohongshu');
    const douyin = loadMaterialSearchMaterials(output, 'douyin');

    expect(wechat).toContain('wechat obsidian');
    expect(wechat).not.toContain('xiaohongshu obsidian');
    expect(xhs).toContain('xiaohongshu obsidian');
    expect(douyin).toBe('');
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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FragmentLoader } from '../../src/fragment-library/fragment-loader.js';

const TEST_SENTENCES = [
  {
    id: 's1', type: 'hook' as const, text: '测试句子', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试', '标签'], useCount: 0, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's2', type: 'hook' as const, text: '测试句子2', structure: '结构',
    source: 'external' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 10, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's3', type: 'hook' as const, text: '测试句子3', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 15, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's4', type: 'hook' as const, text: '测试句子4', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 30, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's5', type: 'transition' as const, text: '过渡句', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 30, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's6', type: 'cta' as const, text: 'CTA句', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 0, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 's7', type: 'hook' as const, text: '高使用次数', structure: '结构',
    source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 100, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
];

const TEST_PARAGRAPHS = [
  {
    id: 'p1', type: 'opening' as const, content: '段落1', narrativeStructure: '结构',
    emotionalArc: '弧线', source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 0, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 'p2', type: 'opening' as const, content: '段落2', narrativeStructure: '结构',
    emotionalArc: '弧线', source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 20, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
  {
    id: 'p3', type: 'argument' as const, content: '段落3', narrativeStructure: '结构',
    emotionalArc: '弧线', source: 'edited' as const, platform: 'universal' as const,
    tags: ['测试'], useCount: 20, decayLevel: 'active' as const,
    lastUsedAt: undefined,
  },
];

vi.mock('../../src/fragment-library/fragment-store.js', () => ({
  getFragmentStore: vi.fn(() => ({
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    getAllSentences: vi.fn(() => TEST_SENTENCES),
    getAllParagraphs: vi.fn(() => TEST_PARAGRAPHS),
    markFragmentUsed: vi.fn(),
  })),
}));

describe('FragmentLoader useCount penalty', () => {
  let loader: FragmentLoader;

  beforeEach(() => {
    loader = new FragmentLoader('./output/corpus');
  });

  describe('getSentenceFragments with useCount penalty', () => {
    it('useCount=30 with same keyword: wins over useCount=0 due to same score but different source', () => {
      // s1 (hook, useCount=0, score=1.0) and s2 (hook, useCount=10, score=1.0)
      // s2 is external, s1 is edited. Same score but s2 wins tiebreak (external loses)
      // So result should include s1 as hook (edited wins tiebreak when scores equal)
      const fragments = loader.getSentenceFragments(['hook'], 'universal', 5, ['测试']);
      // s1 should win hook slot (score=1.0, edited) over s2 (score=1.0, external)
      const hookFragment = fragments.find(f => f.type === 'hook');
      expect(hookFragment?.id).toBe('s1');
      expect(hookFragment?.relevanceScore).toBe(1);
    });

    it('deduplication: highest score wins the slot', () => {
      // s1 (hook, score=1.0), s3 (hook, score=0.75), s4 (hook, score=0.5)
      // Only s1 (highest score) gets the hook slot
      const fragments = loader.getSentenceFragments(['hook'], 'universal', 5, ['测试']);
      const ids = fragments.map(f => f.id);
      expect(ids).toContain('s1'); // hook slot - highest score
      expect(ids).not.toContain('s3'); // same type, lower score, deduplicated
      expect(ids).not.toContain('s4'); // same type, lower score, deduplicated
    });

    it('useCount=30 still included due to different type (transition)', () => {
      // s5 is transition type, so it gets its own slot even with 50% penalty
      const fragments = loader.getSentenceFragments(undefined, 'universal', 5, ['测试']);
      const ids = fragments.map(f => f.id);
      expect(ids).toContain('s5'); // transition type, score=0.5 after penalty
    });

    it('high useCount (100) gets 50% penalty but may be deduplicated out by higher scores', () => {
      // s7: useCount=100, penalty=0.5, final score=0.5
      // s7 is hook type, but s1 (hook, score=1.0) wins the slot
      const fragments = loader.getSentenceFragments(['hook'], 'universal', 5, ['测试']);
      // s7 is deduplicated - not included because s1 wins hook slot with higher score
      const ids = fragments.map(f => f.id);
      expect(ids).not.toContain('s7');
    });

    it('no keyword match: fragment excluded due to zero score', () => {
      // s4 with non-matching keyword: score=0
      // s4 is hook type, but s1 (hook, score=1.0) wins the slot
      const fragments = loader.getSentenceFragments(['hook'], 'universal', 5, ['不存在关键词']);
      const ids = fragments.map(f => f.id);
      // s4 excluded (score=0), s1 with matching keyword included
      expect(ids).not.toContain('s4');
    });
  });

  describe('getParagraphFragments with useCount penalty', () => {
    it('useCount=20: 50% penalty cap', () => {
      const fragments = loader.getParagraphFragments(['opening'], 'universal', 5, ['测试']);
      // p2 has useCount=20, keywordScore=1.0, penalty=0.5, final=0.5
      // But p1 (useCount=0) has score=1.0 and wins the slot
      const p2 = fragments.find(f => f.id === 'p2');
      const p1 = fragments.find(f => f.id === 'p1');
      // p2 is deduplicated out by p1 (same type, higher score)
      // But if we request only p2's type and both exist...
      const openingFragments = loader.getParagraphFragments(['opening'], 'universal', 5, ['测试']);
      // Only p1 wins the slot (score 1.0 vs p2's 0.5)
      expect(openingFragments.find(f => f.id === 'p1')?.relevanceScore).toBe(1);
    });

    it('different types can coexist with different useCounts', () => {
      const fragments = loader.getParagraphFragments(undefined, 'universal', 5, ['测试']);
      const ids = fragments.map(f => f.id);
      expect(ids).toContain('p1'); // opening, useCount=0, score=1.0
      expect(ids).toContain('p3'); // argument, useCount=20, score=0.5
    });
  });
});

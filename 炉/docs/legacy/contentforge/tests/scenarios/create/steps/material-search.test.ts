import { describe, it, expect } from 'vitest';
import { extractQueriesFromOutlines } from '../../../../src/scenarios/create/steps/material-search.js';
import type { PlatformAssignments, WechatOutline, XiaohongshuOutline, DouyinOutline } from '../../../../src/scenarios/create/types.js';

describe('extractQueriesFromOutlines', () => {
  const minimalAssignments: PlatformAssignments = {
    wechat: { platform: 'wechat', angle: 'AI trends', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [2000, 3000], contentType: '', emotionalGoal: '' },
    xiaohongshu: { platform: 'xiaohongshu', angle: 'AI tips', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [1000, 1500], contentType: '', emotionalGoal: '' },
    douyin: { platform: 'douyin', angle: 'AI facts', titleDrafts: [], coreArgument: '', targetAudience: '', tone: '', wordCountRange: [60, 90], contentType: '', emotionalGoal: '' },
    overlapAnalysis: '',
  };

  it('returns empty queries when all outlines are empty', () => {
    const outlines = {
      wechat: { sections: [] } as WechatOutline,
      xiaohongshu: { tips: [] } as XiaohongshuOutline,
      douyin: { corePoint: { statement: '', analogy: '' }, miniCase: '' } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.wechat).toEqual([]);
    expect(result.xiaohongshu).toEqual([]);
    expect(result.douyin).toEqual([]);
  });

  it('extracts queries from wechat sections with case slots', () => {
    const outlines = {
      wechat: {
        sections: [{
          title: 'intro',
          purpose: 'hook',
          keyPoints: ['AI is changing everything'],
          caseSlot: 'needs a real case',
          wordCount: 500,
          emotionTarget: 'curiosity',
        }],
      } as WechatOutline,
      xiaohongshu: { tips: [] } as XiaohongshuOutline,
      douyin: { corePoint: { statement: '', analogy: '' }, miniCase: '' } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.wechat.length).toBeGreaterThan(0);
    expect(result.wechat[0]).toContain('AI');
  });

  it('skips case slots containing 无需', () => {
    const outlines = {
      wechat: {
        sections: [{
          title: 'intro',
          purpose: 'hook',
          keyPoints: [],
          caseSlot: '无需案例',
          wordCount: 500,
          emotionTarget: 'curiosity',
        }],
      } as WechatOutline,
      xiaohongshu: { tips: [] } as XiaohongshuOutline,
      douyin: { corePoint: { statement: '', analogy: '' }, miniCase: '' } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.wechat).toEqual([]);
  });

  it('extracts queries from xiaohongshu tips', () => {
    const outlines = {
      wechat: { sections: [] } as WechatOutline,
      xiaohongshu: {
        tips: [{
          title: '5 AI tips',
          content: 'content',
          actionable: 'do it',
        }],
      } as XiaohongshuOutline,
      douyin: { corePoint: { statement: '', analogy: '' }, miniCase: '' } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.xiaohongshu.length).toBeGreaterThan(0);
    expect(result.xiaohongshu[0]).toContain('AI');
  });

  it('extracts queries from douyin corePoint and miniCase', () => {
    const outlines = {
      wechat: { sections: [] } as WechatOutline,
      xiaohongshu: { tips: [] } as XiaohongshuOutline,
      douyin: {
        corePoint: { statement: 'AI is like electricity', analogy: 'like electricity' },
        miniCase: 'smartphone revolution',
      } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.douyin.length).toBeGreaterThan(0);
  });

  it('deduplicates and limits to 4 queries per platform', () => {
    const outlines = {
      wechat: {
        sections: [
          { title: 's1', purpose: '', keyPoints: ['point one two three four five'], caseSlot: 'case1', wordCount: 100, emotionTarget: '' },
          { title: 's2', purpose: '', keyPoints: ['point two three four five six'], caseSlot: 'case2', wordCount: 100, emotionTarget: '' },
          { title: 's3', purpose: '', keyPoints: ['point three four five six seven'], caseSlot: 'case3', wordCount: 100, emotionTarget: '' },
          { title: 's4', purpose: '', keyPoints: ['point four five six seven eight'], caseSlot: 'case4', wordCount: 100, emotionTarget: '' },
          { title: 's5', purpose: '', keyPoints: ['point five six seven eight nine'], caseSlot: 'case5', wordCount: 100, emotionTarget: '' },
        ],
      } as WechatOutline,
      xiaohongshu: { tips: [] } as XiaohongshuOutline,
      douyin: { corePoint: { statement: '', analogy: '' }, miniCase: '' } as DouyinOutline,
    };
    const result = extractQueriesFromOutlines(minimalAssignments, outlines, 'AI');
    expect(result.wechat.length).toBeLessThanOrEqual(4);
  });
});

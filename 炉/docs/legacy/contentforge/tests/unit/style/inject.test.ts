import { describe, it, expect } from 'vitest';
import { injectStyle } from '../../../src/scenarios/style/inject.js';
import type { StyleProfile } from '../../../src/scenarios/style/types.js';

function makeTestProfile(name: string, type: StyleProfile['type'] = 'personal'): StyleProfile {
  return {
    name,
    type,
    dimensions: {
      vocabularyWeights: { 高频词: ['你会发现', '真正让人'], 避免词: ['首先', '其次'] },
      emotionalTone: '前压后起，结尾留悬念',
      structuralPreference: { hook: '反问/反差式', transition: '层层递进', closing: '留互动问题' },
      narrativeStyle: { caseType: '职场/成长类', logicVsEmotion: '感性60%', dataUsage: '偶尔用' },
    },
    sourceArticles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articleTags: {},
  };
}

describe('injectStyle', () => {
  it('generates system prompt with style description', () => {
    const profile = makeTestProfile('mark');
    const result = injectStyle(profile);
    expect(result.systemPrompt).toContain('情绪基调：前压后起，结尾留悬念');
    expect(result.systemPrompt).toContain('开头风格：反问/反差式');
  });

  it('generates constraints from avoid words', () => {
    const profile = makeTestProfile('mark');
    const result = injectStyle(profile);
    expect(result.constraints).toContain('避免使用：首先、其次');
  });

  it('generates constraints from high-frequency words', () => {
    const profile = makeTestProfile('mark');
    const result = injectStyle(profile);
    expect(result.constraints).toContain('偏好用词：你会发现、真正让人');
  });

  it('handles empty avoid words', () => {
    const profile = makeTestProfile('mark');
    profile.dimensions.vocabularyWeights.避免词 = [];
    const result = injectStyle(profile);
    expect(result.constraints).toHaveLength(1); // only high-freq
  });
});

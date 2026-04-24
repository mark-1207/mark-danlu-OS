import { describe, it, expect } from 'vitest';
import {
  ArticleTagSchema,
  StyleDimensionsSchema,
  StyleProfileSchema,
} from '../../../src/scenarios/style/types.js';

describe('style types', () => {
  it('validates article tag', () => {
    expect(ArticleTagSchema.parse('representative')).toBe('representative');
    expect(() => ArticleTagSchema.parse('invalid')).toThrow();
  });

  it('validates style dimensions', () => {
    const dims = {
      vocabularyWeights: { 高频词: ['你会发现'], 避免词: ['首先'] },
      emotionalTone: '前压后起',
      structuralPreference: { hook: '反问', transition: '递进', closing: '留悬念' },
      narrativeStyle: { caseType: '职场', logicVsEmotion: '感性60%', dataUsage: '偶尔' },
    };
    expect(StyleDimensionsSchema.parse(dims)).toEqual(dims);
  });

  it('validates style profile', () => {
    const profile = {
      name: 'mark',
      type: 'personal',
      dimensions: {
        vocabularyWeights: { 高频词: [], 避免词: [] },
        emotionalTone: '',
        structuralPreference: { hook: '', transition: '', closing: '' },
        narrativeStyle: { caseType: '', logicVsEmotion: '', dataUsage: '' },
      },
      sourceArticles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      articleTags: {},
    };
    expect(StyleProfileSchema.parse(profile).name).toBe('mark');
  });
});

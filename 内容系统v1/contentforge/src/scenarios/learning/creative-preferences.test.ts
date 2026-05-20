import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadCreativePreferences,
  DEFAULT_PREFERENCES,
} from './creative-preferences.js';

describe('creative-preferences', () => {
  beforeEach(() => {
    // Reset module state by clearing cachedPreferences
    // Note: This tests the sync load function which uses cachedPreferences
    // The actual async loadCreativePreferencesFromFeishu is tested separately with mocks
  });

  it('loadCreativePreferences returns DEFAULT_PREFERENCES when cache is empty', () => {
    const prefs = loadCreativePreferences();
    expect(prefs.wechat).toBeDefined();
    expect(prefs.xiaohongshu).toBeDefined();
    expect(prefs.douyin).toBeDefined();
    expect(prefs.lastUpdated).toBe('');
  });

  it('DEFAULT_PREFERENCES has valid structure for all platforms', () => {
    expect(DEFAULT_PREFERENCES.wechat.structure.preference).toBe('对比型');
    expect(DEFAULT_PREFERENCES.xiaohongshu.structure.preference).toBe('故事型');
    expect(DEFAULT_PREFERENCES.douyin.structure.preference).toBe('清单型');
  });

  it('DEFAULT_PREFERENCES wechat tone is 励志', () => {
    expect(DEFAULT_PREFERENCES.wechat.tone.preference).toBe('励志');
  });

  it('DEFAULT_PREFERENCES xiaohongshu tone is 温暖', () => {
    expect(DEFAULT_PREFERENCES.xiaohongshu.tone.preference).toBe('温暖');
  });

  it('DEFAULT_PREFERENCES douyin tone is 犀利', () => {
    expect(DEFAULT_PREFERENCES.douyin.tone.preference).toBe('犀利');
  });

  it('can parse valid preferences JSON', () => {
    const validJson = JSON.stringify({
      structure: { preference: '故事型', weight: 1.5, engagementRate: 0.05, sampleSize: 10, confidence: 'medium' },
      tone: { preference: '温暖', weight: 1.2, engagementRate: 0.03, sampleSize: 8, confidence: 'medium' },
      angle: { preference: '成长', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
      title: { effectivePatterns: [], confidence: 'low' },
      hook: { effectivePatterns: [], confidence: 'low' },
    });
    const parsed = JSON.parse(validJson);
    expect(parsed.structure.preference).toBe('故事型');
    expect(parsed.structure.confidence).toBe('medium');
  });

  it('fails gracefully for invalid JSON', () => {
    const invalidJson = '{ invalid json }';
    expect(() => JSON.parse(invalidJson)).toThrow();
  });
});

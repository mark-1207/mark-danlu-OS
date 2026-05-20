import { describe, it, expect } from 'vitest';
import { loadCreativePreferences, formatPreferencesReport } from './creative-preferences.js';
import type { CreativePreferences } from './types.js';

describe('creative-preferences', () => {
  describe('formatPreferencesReport', () => {
    const makePrefs = (overrides?: Partial<CreativePreferences>): CreativePreferences => ({
      wechat: {
        structure: { preference: '对比型', weight: 1.5, engagementRate: 0.08, sampleSize: 12, confidence: 'high' },
        tone: { preference: '励志', weight: 1.3, engagementRate: 0.06, sampleSize: 10, confidence: 'medium' },
        angle: { preference: '成长', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
        title: { effectivePatterns: [{ pattern: '数字开头', adoptionRate: 0.75, count: 8 }], confidence: 'medium' },
        hook: { effectivePatterns: [{ pattern: '提问式', adoptionRate: 0.6, count: 5 }], confidence: 'low' },
        ...overrides?.wechat,
      },
      xiaohongshu: {
        structure: { preference: '故事型', weight: 1.2, engagementRate: 0.05, sampleSize: 5, confidence: 'medium' },
        tone: { preference: '温暖', weight: 1.1, engagementRate: 0.04, sampleSize: 4, confidence: 'low' },
        angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
        title: { effectivePatterns: [], confidence: 'low' },
        hook: { effectivePatterns: [], confidence: 'low' },
        ...overrides?.xiaohongshu,
      },
      douyin: {
        structure: { preference: '清单型', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
        tone: { preference: '犀利', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
        angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
        title: { effectivePatterns: [], confidence: 'low' },
        hook: { effectivePatterns: [], confidence: 'low' },
        ...overrides?.douyin,
      },
      lastUpdated: '2026-05-20',
      ...overrides,
    });

    it('returns JSON string when json=true', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, true);
      const parsed = JSON.parse(result);
      expect(parsed.wechat.structure.preference).toBe('对比型');
    });

    it('shows platform sections in text mode', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('【wechat】');
      expect(result).toContain('【xiaohongshu】');
      expect(result).toContain('【douyin】');
    });

    it('shows correct icon for high confidence structure', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('✓ 叙事结构: 对比型 (样本12, 置信度 high)');
    });

    it('shows warning icon for medium confidence', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('⚠️ 情感调性: 励志 (样本10, 置信度 medium)');
    });

    it('shows cross icon for low confidence', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('✗ 内容角度: 成长 (样本0, 置信度 low)');
    });

    it('shows competitor insights when present', () => {
      const prefs = makePrefs({
        wechat: {
          structure: { preference: '对比型', weight: 1.5, engagementRate: 0.08, sampleSize: 12, confidence: 'high' },
          tone: { preference: '励志', weight: 1.3, engagementRate: 0.06, sampleSize: 10, confidence: 'medium' },
          angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
          title: { effectivePatterns: [], confidence: 'low' },
          hook: { effectivePatterns: [], confidence: 'low' },
          competitorInsights: {
            structure: { preference: '对比型', avgEngagement: 0.081, sampleSize: 23 },
            tone: { preference: '励志', avgEngagement: 0.075, sampleSize: 18 },
          },
        },
      });
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('竞品结构偏好: 对比型 (8.1%, n=23)');
      expect(result).toContain('竞品调性偏好: 励志 (7.5%, n=18)');
    });

    it('shows effective patterns when present', () => {
      const prefs = makePrefs();
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('有效标题模式: 数字开头');
      expect(result).toContain('有效钩子模式: 提问式');
    });

    it('shows lastUpdated date', () => {
      const prefs = makePrefs({ lastUpdated: '2026-05-20' });
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('最后更新: 2026-05-20');
    });

    it('shows "从未" when lastUpdated is empty', () => {
      const prefs = makePrefs({ lastUpdated: '' });
      const result = formatPreferencesReport(prefs, false);
      expect(result).toContain('最后更新: 从未');
    });
  });

  describe('loadCreativePreferences', () => {
    it('returns preferences object with all platforms', () => {
      // loadCreativePreferences is sync, returns the module-level cache
      // In isolation (no Feishu), it returns DEFAULT_PREFERENCES
      const prefs = loadCreativePreferences();
      expect(prefs.wechat).toBeDefined();
      expect(prefs.xiaohongshu).toBeDefined();
      expect(prefs.douyin).toBeDefined();
    });
  });
});
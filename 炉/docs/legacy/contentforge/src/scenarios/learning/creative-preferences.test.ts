import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../feedback/feishu-feedback.js', () => ({
  readCreativePreferences: vi.fn().mockResolvedValue([]),
  writeCreativePreferences: vi.fn().mockResolvedValue(undefined),
}));

import {
  loadCreativePreferences,
  formatPreferencesReport,
  DEFAULT_PREFERENCES,
  getPlatformPreferences,
  hasEnoughData,
  applyStructureWeight,
  applyToneWeight,
  getEffectiveTitlePatterns,
  getEffectiveHookPatterns,
  buildPreferencePrompt,
  updateCreativePreferences,
  loadCreativePreferencesFromFeishu,
} from './creative-preferences.js';
import type { CreativePreferences } from './types.js';
import { writeCreativePreferences, readCreativePreferences } from '../feedback/feishu-feedback.js';

const writeMock = vi.mocked(writeCreativePreferences);
const readMock = vi.mocked(readCreativePreferences);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level cache by reloading defaults
  loadCreativePreferences();
});

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

describe('creative-preferences', () => {
  describe('DEFAULT_PREFERENCES', () => {
    it('has all three platforms with correct confidence levels', () => {
      expect(DEFAULT_PREFERENCES.wechat.structure.confidence).toBe('high');
      expect(DEFAULT_PREFERENCES.xiaohongshu.structure.confidence).toBe('medium');
      expect(DEFAULT_PREFERENCES.douyin.structure.confidence).toBe('medium');
    });

    it('has empty lastUpdated', () => {
      expect(DEFAULT_PREFERENCES.lastUpdated).toBe('');
    });
  });

  describe('getPlatformPreferences', () => {
    it('returns wechat preferences', () => {
      const prefs = getPlatformPreferences('wechat');
      expect(prefs.structure.preference).toBe('递进式');
      expect(prefs.tone.preference).toBe('犀利');
    });

    it('returns xiaohongshu preferences', () => {
      const prefs = getPlatformPreferences('xiaohongshu');
      expect(prefs.structure.preference).toBe('故事型');
    });
  });

  describe('hasEnoughData', () => {
    it('returns true when combined sampleSize >= 5', () => {
      expect(hasEnoughData('wechat')).toBe(true);
    });

    it('returns true for all default platforms', () => {
      expect(hasEnoughData('douyin')).toBe(true);
    });
  });

  describe('applyStructureWeight', () => {
    it('multiplies by weight when structure matches preference', () => {
      const result = applyStructureWeight(100, '递进式', 'wechat');
      expect(result).toBe(100);
    });

    it('returns base score when structure does not match', () => {
      const result = applyStructureWeight(100, '清单型', 'wechat');
      expect(result).toBe(100);
    });
  });

  describe('applyToneWeight', () => {
    it('multiplies by weight when tone matches preference', () => {
      const result = applyToneWeight(80, '犀利', 'wechat');
      expect(result).toBe(80);
    });

    it('returns base score when tone does not match', () => {
      const result = applyToneWeight(80, '温暖', 'wechat');
      expect(result).toBe(80);
    });
  });

  describe('getEffectiveTitlePatterns', () => {
    it('returns pattern strings for wechat', () => {
      const patterns = getEffectiveTitlePatterns('wechat');
      expect(patterns).toContain('反直觉断言+具体结果');
      expect(patterns).toContain('问句+数字');
    });

    it('returns pattern strings for xiaohongshu', () => {
      const patterns = getEffectiveTitlePatterns('xiaohongshu');
      expect(patterns).toContain('身份标签+结果+数字');
    });
  });

  describe('getEffectiveHookPatterns', () => {
    it('returns hook patterns for wechat', () => {
      const hooks = getEffectiveHookPatterns('wechat');
      expect(hooks).toContain('冲突场景+情绪共鸣');
      expect(hooks).toContain('数据冲击+反常识');
    });
  });

  describe('buildPreferencePrompt', () => {
    it('returns non-empty string for high-confidence platform', () => {
      const prompt = buildPreferencePrompt('wechat');
      expect(prompt).toContain('创作偏好参考');
      expect(prompt).toContain('递进式');
      expect(prompt).toContain('犀利');
    });

    it('includes title and hook patterns', () => {
      const prompt = buildPreferencePrompt('wechat');
      expect(prompt).toContain('有效标题模式');
      expect(prompt).toContain('有效钩子模式');
    });
  });

  describe('updateCreativePreferences', () => {
    it('writes to Feishu via writeCreativePreferences', async () => {
      const prefs = loadCreativePreferences();
      await updateCreativePreferences(prefs);
      expect(writeMock).toHaveBeenCalledWith(prefs.wechat, prefs.xiaohongshu, prefs.douyin);
    });

    it('sets lastUpdated to today on success', async () => {
      const prefs = loadCreativePreferences();
      await updateCreativePreferences(prefs);
      const updated = loadCreativePreferences();
      expect(updated.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('does not throw when Feishu write fails', async () => {
      writeMock.mockRejectedValueOnce(new Error('network error'));
      const prefs = loadCreativePreferences();
      await expect(updateCreativePreferences(prefs)).resolves.not.toThrow();
    });
  });

  describe('loadCreativePreferencesFromFeishu', () => {
    it('returns defaults when Feishu returns empty', async () => {
      readMock.mockResolvedValueOnce([]);
      const prefs = await loadCreativePreferencesFromFeishu();
      expect(prefs.wechat.structure.preference).toBe('递进式');
    });

    it('returns defaults when Feishu throws', async () => {
      readMock.mockRejectedValueOnce(new Error('timeout'));
      const prefs = await loadCreativePreferencesFromFeishu();
      expect(prefs.wechat.structure.preference).toBe('递进式');
    });

    it('parses Feishu records into preferences', async () => {
      readMock.mockResolvedValueOnce([
        {
          record_id: 'rec_test_1',
          fields: {
            platform: 'wechat',
            preferences_json: JSON.stringify({
              structure: { preference: '对比型', weight: 1.5, engagementRate: 0.1, sampleSize: 30, confidence: 'high' },
              tone: { preference: '温暖', weight: 1.2, engagementRate: 0.08, sampleSize: 25, confidence: 'high' },
              angle: { preference: '成长', weight: 1.0, engagementRate: 0.05, sampleSize: 15, confidence: 'medium' },
              title: { effectivePatterns: [], confidence: 'low' },
              hook: { effectivePatterns: [], confidence: 'low' },
            }),
            last_updated: '2026-06-01',
          },
        },
      ]);
      const prefs = await loadCreativePreferencesFromFeishu();
      expect(prefs.wechat.structure.preference).toBe('对比型');
      expect(prefs.wechat.structure.weight).toBe(1.5);
      expect(prefs.lastUpdated).toBe('2026-06-01');
    });
  });

  describe('formatPreferencesReport', () => {
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
      const prefs = loadCreativePreferences();
      expect(prefs.wechat).toBeDefined();
      expect(prefs.xiaohongshu).toBeDefined();
      expect(prefs.douyin).toBeDefined();
    });
  });
});

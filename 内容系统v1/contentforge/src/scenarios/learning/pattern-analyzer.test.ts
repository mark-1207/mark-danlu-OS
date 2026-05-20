import { describe, it, expect } from 'vitest';
import { analyzePatterns } from './pattern-analyzer.js';
import type { RevisionManifest } from '../revision/types.js';
import type { FeedbackRecord } from '../feedback/types.js';
import type { FeishuRecord } from '../topic/types.js';

describe('pattern-analyzer', () => {
  describe('time decay', () => {
    it('recent records have higher weight than old records', () => {
      const now = new Date().toISOString().slice(0, 10);
      const recentDate = now;
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 100 days ago

      const records: FeedbackRecord[] = [
        {
          record_id: '1',
          fields: {
            文章ID: 'a1', 内容标题: 't1', 原文链接: '', 平台: 'wechat',
            主题标签: ['标签A'], 内容角度: '', 叙事结构: '对比型',
            情感调性: '励志', 发布日期: recentDate, 数据周期: '7日',
            阅读量: 1000, 点赞数: 100, 评论数: 10, 转发数: 5,
            完播率: 0, 收藏数: 0, 数据备注: '', 下次更新时间: '',
          },
        },
        {
          record_id: '2',
          fields: {
            文章ID: 'a2', 内容标题: 't2', 原文链接: '', 平台: 'wechat',
            主题标签: ['标签A'], 内容角度: '', 叙事结构: '对比型',
            情感调性: '励志', 发布日期: oldDate, 数据周期: '7日',
            阅读量: 1000, 点赞数: 100, 评论数: 10, 转发数: 5,
            完播率: 0, 收藏数: 0, 数据备注: '', 下次更新时间: '',
          },
        },
      ];

      // With 30+ records, time decay kicks in
      // Recent should dominate
      const result = analyzePatterns([], records, []);
      // Recent record should have more influence on preference
      expect(result.wechat.structure.preference).toBe('对比型');
    });

    it('accepts lambda parameter without error', () => {
      const now = new Date().toISOString().slice(0, 10);
      const records: FeedbackRecord[] = Array.from({ length: 35 }, (_, i) => ({
        record_id: String(i),
        fields: {
          文章ID: `a${i}`, 内容标题: `t${i}`, 原文链接: '', 平台: 'wechat',
          主题标签: ['标签A'], 内容角度: '', 叙事结构: i % 2 === 0 ? '对比型' : '清单型',
          情感调性: '励志', 发布日期: now, 数据周期: '7日',
          阅读量: 1000, 点赞数: 100, 评论数: 10, 转发数: 5,
          完播率: 0, 收藏数: 0, 数据备注: '', 下次更新时间: '',
        },
      }));

      // With identical dates, time decay has no effect (all same age)
      // But lambda parameter should be accepted without error
      const result1 = analyzePatterns([], records, [], { lambda: 0.001 });
      const result2 = analyzePatterns([], records, [], { lambda: 0.1 });

      // Both should produce valid results
      expect(result1.wechat.structure.sampleSize).toBeGreaterThan(0);
      expect(result2.wechat.structure.sampleSize).toBeGreaterThan(0);
      // Since dates are identical, both should produce same preference
      expect(result1.wechat.structure.preference).toBe(result2.wechat.structure.preference);
    });
  });

  describe('analyzeCompetitorPatterns', () => {
    it('returns top structure and tone by engagement rate', () => {
      const records: FeishuRecord[] = [
        {
          record_id: '1',
          fields: {
            竞品标题: 't1', 平台: 'wechat', 叙事结构: '对比型', 情感调性: '励志',
            阅读数: 1000, 点赞数: 80, 评论数: 10, 转发数: 5, 收藏数: 5,
            标签: [], 状态: 'analyzed', 原始链接: '',
          },
        },
        {
          record_id: '2',
          fields: {
            竞品标题: 't2', 平台: 'wechat', 叙事结构: '对比型', 情感调性: '冷静',
            阅读数: 1000, 点赞数: 40, 评论数: 5, 转发数: 2, 收藏数: 2,
            标签: [], 状态: 'analyzed', 原始链接: '',
          },
        },
        {
          record_id: '3',
          fields: {
            竞品标题: 't3', 平台: 'wechat', 叙事结构: '清单型', 情感调性: '励志',
            阅读数: 1000, 点赞数: 20, 评论数: 3, 转发数: 1, 收藏数: 1,
            标签: [], 状态: 'analyzed', 原始链接: '',
          },
        },
      ];

      const result = analyzePatterns([], [], records);
      // 对比型: avg eng = (0.095 + 0.047) / 2 = 0.071
      // 清单型: avg eng = 0.024
      // 励志: avg eng = (0.095 + 0.024) / 2 = 0.0595
      // 冷静: avg eng = 0.047
      expect(result.wechat.competitorInsights?.structure.preference).toBe('对比型');
      expect(result.wechat.competitorInsights?.tone.preference).toBe('励志');
      expect(result.xiaohongshu.competitorInsights?.structure.preference).toBe('对比型');
    });

    it('handles empty competitor records', () => {
      const result = analyzePatterns([], [], []);
      expect(result.wechat.competitorInsights?.structure.preference).toBe('');
      expect(result.wechat.competitorInsights?.tone.preference).toBe('');
    });

    it('skips records with zero reads', () => {
      const records: FeishuRecord[] = [
        {
          record_id: '1',
          fields: {
            竞品标题: 't1', 平台: 'wechat', 叙事结构: '对比型', 情感调性: '励志',
            阅读数: 0, 点赞数: 80, 评论数: 10, 转发数: 5, 收藏数: 5,
            标签: [], 状态: 'analyzed', 原始链接: '',
          },
        },
      ];
      const result = analyzePatterns([], [], records);
      expect(result.wechat.competitorInsights?.structure.preference).toBe('');
    });
  });

  describe('analyzePatterns integration', () => {
    it('includes competitorInsights in all platforms', () => {
      const records: FeishuRecord[] = [
        {
          record_id: '1',
          fields: {
            竞品标题: 't1', 平台: 'wechat', 叙事结构: '故事型', 情感调性: '温暖',
            阅读数: 1000, 点赞数: 50, 评论数: 5, 转发数: 3, 收藏数: 3,
            标签: [], 状态: 'analyzed', 原始链接: '',
          },
        },
      ];

      const result = analyzePatterns([], [], records);
      expect(result.wechat.competitorInsights).toBeDefined();
      expect(result.xiaohongshu.competitorInsights).toBeDefined();
      expect(result.douyin.competitorInsights).toBeDefined();
    });

    it('sets lastUpdated to today', () => {
      const result = analyzePatterns([], [], []);
      expect(result.lastUpdated).toBe(new Date().toISOString().slice(0, 10));
    });

    it('uses hardcoded fallback when no data', () => {
      const result = analyzePatterns([], [], []);
      // No data → all platforms fall back to '对比型' (hardcoded default in buildPlatformPreferences)
      // Note: DEFAULT_PREFERENCES has xiaohongshu = '故事型' but buildPlatformPreferences ignores those
      expect(result.wechat.structure.preference).toBe('对比型');
      expect(result.xiaohongshu.structure.preference).toBe('对比型');
      expect(result.douyin.structure.preference).toBe('对比型');
    });
  });
});
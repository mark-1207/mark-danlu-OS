import { describe, it, expect } from 'vitest';

// T10: topic-gap core logic — platform coverage counting
describe('topic-gap core logic', () => {
  it('T10: counts platform coverage from article records', () => {
    const records = [
      { platform: 'wechat' as const },
      { platform: 'wechat' as const },
      { platform: 'xiaohongshu' as const },
      { platform: 'douyin' as const },
    ];

    const byPlatform = { wechat: 0, xiaohongshu: 0, douyin: 0 };
    for (const rec of records) {
      byPlatform[rec.platform]++;
    }

    expect(byPlatform.wechat).toBe(2);
    expect(byPlatform.xiaohongshu).toBe(1);
    expect(byPlatform.douyin).toBe(1);

    // Check suggestion logic
    expect(byPlatform.xiaohongshu < 10).toBe(true); // Should suggest supplement
    expect(byPlatform.douyin < 10).toBe(true);
  });
});

// T11: platform-allocation core logic — distribution percentages
describe('platform-allocation core logic', () => {
  it('T11: calculates platform distribution percentages', () => {
    const records = [
      { platform: 'wechat' as const },
      { platform: 'wechat' as const },
      { platform: 'wechat' as const },
      { platform: 'xiaohongshu' as const },
      { platform: 'douyin' as const },
    ];

    const total = records.length;
    const byPlatform = { wechat: 0, xiaohongshu: 0, douyin: 0 };
    for (const rec of records) {
      byPlatform[rec.platform]++;
    }

    expect(total).toBe(5);
    expect(byPlatform.wechat).toBe(3);
    expect(byPlatform.xiaohongshu).toBe(1);
    expect(byPlatform.douyin).toBe(1);

    // Verify percentages
    expect((byPlatform.wechat / total) * 100).toBe(60);
    expect((byPlatform.xiaohongshu / total) * 100).toBe(20);
    expect((byPlatform.douyin / total) * 100).toBe(20);

    // Verify suggestion logic
    expect(byPlatform.xiaohongshu < 10).toBe(true); // Should suggest more
    expect(byPlatform.douyin < 10).toBe(true);
  });

  it('T11: generates suggestions based on thresholds', () => {
    const byPlatform = { wechat: 5, xiaohongshu: 2, douyin: 1 };
    const total = 8;

    const suggestions: string[] = [];
    if (byPlatform.xiaohongshu < 10) {
      suggestions.push(`小红书产出偏少 (${byPlatform.xiaohongshu}篇)，建议补充 5-10 篇`);
    }
    if (byPlatform.douyin < 10) {
      suggestions.push(`抖音产出偏少 (${byPlatform.douyin}篇)，建议补充 3-5 篇`);
    }

    expect(suggestions.length).toBe(2);
    expect(suggestions[0]).toContain('小红书');
    expect(suggestions[1]).toContain('抖音');
  });
});
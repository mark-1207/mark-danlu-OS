import { describe, it, expect } from 'vitest';
import { NineDimensionScores, HotTopic, MaterialPackage, DynamicPromptContext, AudienceProfile } from '../../src/types';

describe('NineDimensionScores', () => {
  it('should have all nine dimensions', () => {
    const scores: NineDimensionScores = {
      emotion: 7,
      utility: 8,
      narrative: 6,
      socialCurrency: 5,
      controversy: 4,
      timeliness: 7,
      differentiation: 6,
      shareability: 5,
      conversionPotential: 7,
    };
    expect(scores.emotion).toBe(7);
    expect(Object.keys(scores).length).toBe(9);
  });
});

describe('HotTopic', () => {
  it('should create hot topic with required fields', () => {
    const topic: HotTopic = {
      id: 'wb-001',
      platform: 'weibo',
      title: '职场内卷如何破局',
      heatScore: 8500,
      fetchedAt: new Date(),
    };
    expect(topic.platform).toBe('weibo');
  });
});

describe('MaterialPackage', () => {
  it('should hold extracted materials', () => {
    const pkg: MaterialPackage = {
      viralQuotes: ['赚钱最重要的是动脑子'],
      caseStudies: ['冯小刚把段子和王朔聊天时记下来'],
    };
    expect(pkg.viralQuotes.length).toBe(1);
  });
});

describe('DynamicPromptContext', () => {
  it('should build context with all fields', () => {
    const ctx: DynamicPromptContext = {
      taskBackground: '用户想写一篇关于赚钱的文章',
      materialPackage: {
        viralQuotes: ['赚钱最重要的是动脑子'],
        caseStudies: ['冯小刚案例'],
        counterArguments: [],
      },
      improvementSuggestions: ['加强个人故事'],
      targetAudience: {
        core: ['大厂边缘人'],
        edge: ['小企业主'],
        painPoints: ['职场内卷'],
        aspirations: ['找到新方向'],
      },
    };
    expect(ctx.taskBackground).toBe('用户想写一篇关于赚钱的文章');
  });
});

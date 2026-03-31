import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicPromptBuilder } from '../../src/prompts';
import { WECHAT_BASE_PROMPT, XIAOHONGSHU_BASE_PROMPT } from '../../src/prompts';

describe('DynamicPromptBuilder', () => {
  let builder: DynamicPromptBuilder;

  beforeEach(() => {
    builder = new DynamicPromptBuilder();
  });

  it('should build WeChat prompt with materials', () => {
    const prompt = builder.buildForWechat({
      taskBackground: '用户想写一篇关于赚钱的文章',
      materialPackage: {
        viralQuotes: ['赚钱最重要的是动脑子'],
        caseStudies: ['冯小刚案例'],
        counterArguments: ['不是靠运气'],
      },
      improvementSuggestions: ['加强个人故事'],
      targetAudience: {
        core: ['大厂边缘人'],
        edge: ['小企业主'],
        painPoints: ['职场内卷'],
        aspirations: ['找到新方向'],
      },
    });
    expect(prompt).toContain('赚钱最重要的是动脑子');
    expect(prompt).toContain('冯小刚');
    expect(prompt).toContain('参考素材');
    expect(prompt).toContain('改进');
  });

  it('should build WeChat prompt without materials', () => {
    const prompt = builder.buildForWechat({
      taskBackground: '用户想写一篇关于认知的文章',
      materialPackage: undefined,
      improvementSuggestions: [],
      targetAudience: {
        core: ['职场人'],
        edge: [],
        painPoints: ['认知焦虑'],
        aspirations: ['提升认知'],
      },
    });
    expect(prompt).toContain('认知的文章');
    expect(prompt).not.toContain('参考素材');
  });

  it('should build Xiaohongshu prompt', () => {
    const prompt = builder.buildForXiaohongshu({
      taskBackground: '分享一个职场技巧',
      materialPackage: {
        viralQuotes: ['short quote'],
        caseStudies: ['案例'],
        counterArguments: [],
      },
      improvementSuggestions: [],
      targetAudience: {
        core: ['年轻女性'],
        edge: [],
        painPoints: ['职场困惑'],
        aspirations: ['成长'],
      },
    });
    expect(prompt).toContain('小红书');
    expect(prompt).toContain('short quote');
  });

  it('should build Twitter prompt', () => {
    const prompt = builder.buildForTwitter({
      taskBackground: '一个观点',
      materialPackage: {
        viralQuotes: ['核心观点'],
        caseStudies: [],
        counterArguments: [],
      },
      improvementSuggestions: [],
      targetAudience: {
        core: ['专业人士'],
        edge: [],
        painPoints: [],
        aspirations: [],
      },
    });
    expect(prompt).toContain('Twitter');
    expect(prompt).toContain('核心观点');
  });

  it('should handle empty improvement suggestions', () => {
    const prompt = builder.buildForWechat({
      taskBackground: 'test',
      materialPackage: { viralQuotes: ['quote'], caseStudies: [], counterArguments: [] },
      improvementSuggestions: [],
      targetAudience: { core: [], edge: [], painPoints: [], aspirations: [] },
    });
    // EMBEDDED_REVIEW_PROMPT contains "改进" but the section title "上轮改进建议" should not appear
    expect(prompt).not.toContain('上轮改进建议');
    expect(prompt).not.toContain('请特别注意以下改进点');
  });

  it('should build for wechat platform using buildFor method', () => {
    const prompt = builder.buildFor('wechat', {
      taskBackground: 'test',
      materialPackage: {
        viralQuotes: ['quote'],
        caseStudies: ['case'],
        counterArguments: ['counter'],
      },
      improvementSuggestions: ['suggestion'],
      targetAudience: {
        core: ['core-audience'],
        edge: [],
        painPoints: ['pain'],
        aspirations: ['aspire'],
      },
    });
    expect(prompt).toContain('quote');
    expect(prompt).toContain('case');
    expect(prompt).toContain('counter');
    expect(prompt).toContain('suggestion');
    expect(prompt).toContain('pain');
    expect(prompt).toContain('aspire');
  });

  it('should throw error for unknown platform', () => {
    expect(() => {
      builder.buildFor('unknown' as any, {
        taskBackground: 'test',
        materialPackage: undefined,
        improvementSuggestions: [],
        targetAudience: { core: [], edge: [], painPoints: [], aspirations: [] },
      });
    }).toThrow('Unknown platform: unknown');
  });
});
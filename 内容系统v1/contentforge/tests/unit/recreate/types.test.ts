import { describe, it, expect } from 'vitest';
import { ViralGenomeSchema } from '../../../src/scenarios/recreate/types.js';

describe('ViralGenome types', () => {
  it('validates caseStudies and keyDataPoints', () => {
    const genome = {
      topicStrategy: { painPoint: '焦虑', emotionalTrigger: '共鸣', targetAudience: '打工人', whyItWorks: '戳痛点' },
      narrativeStructure: [
        { sectionIndex: 0, purpose: '引出问题', wordRatio: 0.2, emotionMark: '好奇', technique: '反问', argumentativePath: '反问引入→共鸣' },
        { sectionIndex: 1, purpose: '分析原因', wordRatio: 0.4, emotionMark: '紧张', technique: '数据', argumentativePath: '数据→结论' },
        { sectionIndex: 2, purpose: '给出方案', wordRatio: 0.4, emotionMark: '释放', technique: '建议', argumentativePath: '方案→行动' },
      ],
      hookTechnique: { type: '反问', mechanism: '激发好奇', template: '{反问句}?' },
      emotionCurve: [
        { position: 0, emotion: '好奇', intensity: 6 },
        { position: 1, emotion: '紧张', intensity: 7 },
        { position: 2, emotion: '释放', intensity: 8 },
      ],
      powerSentences: [
        { original: '句子1', structure: '反问+数据', whyPowerful: '制造认知冲突' },
        { original: '句子2', structure: '对比', whyPowerful: '强化反差' },
        { original: '句子3', structure: '行动号召', whyPowerful: '明确方向' },
      ],
      viralFactors: ['焦虑', '数据', '行动指南'],
      contentDensityScore: 8,
      estimatedReadTime: '5分钟',
      forbiddenExpressions: [
        { text: '原句1', reason: '高辨识度' },
        { text: '原句2', reason: '核心观点' },
        { text: '原句3', reason: '金句' },
      ],
      caseStudies: [
        { id: 'c1', protagonist: '外卖小哥', setting: '一线城市', story: '日赚300的生存记录', whyItWorks: '代入感强' },
      ],
      keyDataPoints: [
        { id: 'd1', data: '72%', context: '裁员概率', field: '就业' },
      ],
    };
    const parsed = ViralGenomeSchema.parse(genome);
    expect(parsed.caseStudies).toHaveLength(1);
    expect(parsed.keyDataPoints).toHaveLength(1);
  });

  it('rejects caseStudies with less than 1 item', () => {
    const genome = {
      topicStrategy: { painPoint: '焦虑', emotionalTrigger: '共鸣', targetAudience: '打工人', whyItWorks: '戳痛点' },
      narrativeStructure: [
        { sectionIndex: 0, purpose: '引出问题', wordRatio: 0.2, emotionMark: '好奇', technique: '反问', argumentativePath: '反问引入→共鸣' },
        { sectionIndex: 1, purpose: '分析原因', wordRatio: 0.4, emotionMark: '紧张', technique: '数据', argumentativePath: '数据→结论' },
        { sectionIndex: 2, purpose: '给出方案', wordRatio: 0.4, emotionMark: '释放', technique: '建议', argumentativePath: '方案→行动' },
      ],
      hookTechnique: { type: '反问', mechanism: '激发好奇', template: '{反问句}?' },
      emotionCurve: [
        { position: 0, emotion: '好奇', intensity: 6 },
        { position: 1, emotion: '紧张', intensity: 7 },
        { position: 2, emotion: '释放', intensity: 8 },
      ],
      powerSentences: [
        { original: '句子1', structure: '反问+数据', whyPowerful: '制造认知冲突' },
        { original: '句子2', structure: '对比', whyPowerful: '强化反差' },
        { original: '句子3', structure: '行动号召', whyPowerful: '明确方向' },
      ],
      viralFactors: ['焦虑', '数据', '行动指南'],
      contentDensityScore: 8,
      estimatedReadTime: '5分钟',
      forbiddenExpressions: [
        { text: '原句1', reason: '高辨识度' },
        { text: '原句2', reason: '核心观点' },
        { text: '原句3', reason: '金句' },
      ],
      caseStudies: [],
      keyDataPoints: [
        { id: 'd1', data: '72%', context: '裁员概率', field: '就业' },
      ],
    };
    expect(() => ViralGenomeSchema.parse(genome)).toThrow('caseStudies must have at least 1 item');
  });

  it('rejects keyDataPoints with less than 1 item', () => {
    const genome = {
      topicStrategy: { painPoint: '焦虑', emotionalTrigger: '共鸣', targetAudience: '打工人', whyItWorks: '戳痛点' },
      narrativeStructure: [
        { sectionIndex: 0, purpose: '引出问题', wordRatio: 0.2, emotionMark: '好奇', technique: '反问', argumentativePath: '反问引入→共鸣' },
        { sectionIndex: 1, purpose: '分析原因', wordRatio: 0.4, emotionMark: '紧张', technique: '数据', argumentativePath: '数据→结论' },
        { sectionIndex: 2, purpose: '给出方案', wordRatio: 0.4, emotionMark: '释放', technique: '建议', argumentativePath: '方案→行动' },
      ],
      hookTechnique: { type: '反问', mechanism: '激发好奇', template: '{反问句}?' },
      emotionCurve: [
        { position: 0, emotion: '好奇', intensity: 6 },
        { position: 1, emotion: '紧张', intensity: 7 },
        { position: 2, emotion: '释放', intensity: 8 },
      ],
      powerSentences: [
        { original: '句子1', structure: '反问+数据', whyPowerful: '制造认知冲突' },
        { original: '句子2', structure: '对比', whyPowerful: '强化反差' },
        { original: '句子3', structure: '行动号召', whyPowerful: '明确方向' },
      ],
      viralFactors: ['焦虑', '数据', '行动指南'],
      contentDensityScore: 8,
      estimatedReadTime: '5分钟',
      forbiddenExpressions: [
        { text: '原句1', reason: '高辨识度' },
        { text: '原句2', reason: '核心观点' },
        { text: '原句3', reason: '金句' },
      ],
      caseStudies: [
        { id: 'c1', protagonist: '外卖小哥', setting: '一线城市', story: '日赚300的生存记录', whyItWorks: '代入感强' },
      ],
      keyDataPoints: [],
    };
    expect(() => ViralGenomeSchema.parse(genome)).toThrow('keyDataPoints must have at least 1 item');
  });
});

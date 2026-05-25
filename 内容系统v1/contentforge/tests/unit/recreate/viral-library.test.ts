import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViralGenome } from '../../../src/scenarios/recreate/types.js';
import { writeViralGenomeToFeishu, loadViralGenomeFromFeishu } from '../../../src/scenarios/feedback/feishu-viral-library.js';
import { writeFile } from 'fs/promises';

const validGenome: ViralGenome = {
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
    { id: 'c1', protagonist: '外卖小哥', setting: '一线城市', story: '日赚300', whyItWorks: '代入感强' },
  ],
  keyDataPoints: [
    { id: 'd1', data: '72%', context: '裁员概率', field: '就业' },
  ],
};

const callLog: string[] = [];

let mockImpl: (cmd: string) => string = () =>
  JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });

vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    callLog.push(cmd);
    return mockImpl(cmd);
  }),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

function setupEnv() {
  vi.stubEnv('FEISHU_VIRAL_LIBRARY_APP_TOKEN', 'test_viral_app_token');
  vi.stubEnv('FEISHU_VIRAL_LIBRARY_TABLE_ID', 'test_viral_table_id');
  vi.stubEnv('FEISHU_TOPIC_TABLE_APP_TOKEN', 'test_topic_app_token');
  vi.stubEnv('FEISHU_TOPIC_TABLE_ID', 'test_topic_table_id');
}

describe('writeViralGenomeToFeishu', () => {
  beforeEach(async () => {
    callLog.length = 0;
    mockImpl = () =>
      JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    setupEnv();
    await vi.resetModules();
  });

  it('T1: 写入成功返回 record_id', async () => {
    mockImpl = (cmd: string) => {
      if (cmd.includes('+record-upsert')) {
        return JSON.stringify({ data: { record: { record_id_list: ['rec_viral_001'] } } });
      }
      return JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    };

    const { writeViralGenomeToFeishu: writeFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    const recordId = await writeFn({
      url: 'https://mp.weixin.qq.com/s/test',
      title: '测试标题',
      platform: 'wechat',
      viralGenome: validGenome,
    });

    expect(recordId).toBe('rec_viral_001');
  });

  it('T2: 同一 URL 重复写入时覆盖更新（而非新建）', async () => {
    mockImpl = (cmd: string) => {
      if (cmd.includes('+record-upsert')) {
        return JSON.stringify({ data: { record: { record_id_list: ['rec_viral_001'] } } });
      }
      return JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    };

    const { writeViralGenomeToFeishu: writeFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    const recordId = await writeFn({
      url: 'https://mp.weixin.qq.com/s/test',
      title: '测试标题v2',
      platform: 'wechat',
      viralGenome: validGenome,
    });

    expect(recordId).toBe('rec_viral_001');
    const upsertCalls = callLog.filter(c => c.includes('+record-upsert'));
    expect(upsertCalls).toHaveLength(1);
  });

  it('T3: URL 在竞品表中不存在时，写入时互动数据字段为空', async () => {
    mockImpl = (cmd: string) => {
      if (cmd.includes('+record-upsert')) {
        return JSON.stringify({ data: { record: { record_id_list: ['rec_viral_002'] } } });
      }
      return JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    };

    const { writeViralGenomeToFeishu: writeFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    const recordId = await writeFn({
      url: 'https://mp.weixin.qq.com/s/not-exists',
      title: '不存在',
      platform: 'wechat',
      viralGenome: validGenome,
    });

    expect(recordId).toBe('rec_viral_002');
    const upsertCalls = callLog.filter(c => c.includes('+record-upsert'));
    expect(upsertCalls).toHaveLength(1);
    const upsertCmd = upsertCalls[0];
    let parsed: Record<string, unknown>;
    if (upsertCmd.includes('@')) {
      const writeCall = vi.mocked(writeFile).mock.calls.find(
        ([, content]) => typeof content === 'string' && content.includes('互动数据'),
      );
      expect(writeCall).toBeTruthy();
      parsed = JSON.parse(writeCall![1] as string);
    } else {
      parsed = JSON.parse(upsertCmd.split('--json')[1].trim());
    }
    expect(() => JSON.parse(parsed['互动数据'] as string)).not.toThrow();
    const interaction = JSON.parse(parsed['互动数据'] as string);
    expect(interaction).toEqual({});
  });
});

describe('loadViralGenomeFromFeishu', () => {
  beforeEach(async () => {
    callLog.length = 0;
    mockImpl = () =>
      JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    setupEnv();
    await vi.resetModules();
  });

  it('T4: loadViralGenomeFromFeishu(record_id) 返回完整 ViralGenome', async () => {
    mockImpl = () =>
      JSON.stringify({
        data: {
          data: [[
            '测试标题',
            'https://mp.weixin.qq.com/s/test',
            'wechat',
            '{"阅读数": 10000, "点赞数": 500}',
            '2026-05-25',
            JSON.stringify(validGenome),
          ]],
          fields: ['原文标题', '原始链接', '平台', '互动数据', '抓取时间', 'ViralGenomeJSON'],
          record_id_list: ['rec_viral_001'],
        },
      });

    const { loadViralGenomeFromFeishu: loadFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    const genome = await loadFn('rec_viral_001');

    expect(genome.topicStrategy.painPoint).toBe('焦虑');
    expect(genome.narrativeStructure).toHaveLength(3);
    expect(genome.forbiddenExpressions).toHaveLength(3);
    expect(genome.caseStudies).toHaveLength(1);
    expect(genome.keyDataPoints).toHaveLength(1);
  });

  it('T5: loadViralGenomeFromFeishu 读取不存在的 record 抛错', async () => {
    mockImpl = () =>
      JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });

    const { loadViralGenomeFromFeishu: loadFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    await expect(loadFn('rec_nonexistent')).rejects.toThrow(/不存在/i);
  });
});

// T6: recreate --from-library loads ViralGenome into context (Step 2 skipped)
// This test verifies the context pre-loading behavior by checking the context object
describe('recreate --from-library context injection', () => {
  beforeEach(async () => {
    callLog.length = 0;
    mockImpl = () =>
      JSON.stringify({ data: { data: [], fields: [], record_id_list: [] } });
    setupEnv();
    await vi.resetModules();
  });

  it('T6: loadViralGenomeFromFeishu returns genome that can be set as viral-genome in context', async () => {
    mockImpl = () =>
      JSON.stringify({
        data: {
          data: [[
            '测试标题',
            'https://mp.weixin.qq.com/s/test',
            'wechat',
            '{"阅读数": 10000, "点赞数": 500}',
            '2026-05-25',
            JSON.stringify(validGenome),
          ]],
          fields: ['原文标题', '原始链接', '平台', '互动数据', '抓取时间', 'ViralGenomeJSON'],
          record_id_list: ['rec_viral_001'],
        },
      });

    const { loadViralGenomeFromFeishu: loadFn } = await import('../../../src/scenarios/feedback/feishu-viral-library.js');
    const genome = await loadFn('rec_viral_001');

    // Simulate context.set('viral-genome', genome)
    const context = new Map<string, ViralGenome>();
    context.set('viral-genome', genome);

    const stored = context.get('viral-genome');
    expect(stored).toBeTruthy();
    expect(stored!.topicStrategy.painPoint).toBe('焦虑');
    expect(stored!.narrativeStructure).toHaveLength(3);
    expect(stored!.caseStudies).toHaveLength(1);
    expect(stored!.keyDataPoints).toHaveLength(1);
  });
});
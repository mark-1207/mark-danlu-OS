import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../../src/cli/commands/skill.js';
import type { RefinedOpinion, ConfirmedOpinion } from '../../../src/scenarios/opinion/types.js';
import { validateRefinedOpinion, validateConfirmedOpinion } from '../../../src/scenarios/opinion/types.js';
import { sanitizeFilename } from '../../../src/utils/sanitize.js';
import { PipelineContext } from '../../../src/core/context.js';
import { L1ForbiddenWordScanner, L1_REPLACEMENTS } from '../../../src/scenarios/opinion/quality/l1-forbidden.js';
import { L2StyleChecker } from '../../../src/scenarios/opinion/quality/l2-style.js';

// ── T1-T8: parseIntent opinion detection ───────────────────────────

describe('parseIntent opinion detection', () => {
  it('T1: detects opinion from 判断句 with question mark', () => {
    const result = parseIntent('AI时代最大的受益者和失意者是谁？');
    expect(result.type).toBe('opinion');
    expect(result.opinion).toBeTruthy();
  });

  it('T2: detects opinion from 判断句 with 是/不是', () => {
    const result = parseIntent('AI只是裁员借口，是过度招聘的修正吗');
    expect(result.type).toBe('opinion');
    expect(result.opinion).toBeTruthy();
  });

  it('T3: detects opinion from 凭什么/为什么 question', () => {
    const result = parseIntent('35岁职场人被优化，凭什么说是AI的锅？');
    expect(result.type).toBe('opinion');
  });

  it('T4: detects opinion from 讨论/分析 keywords', () => {
    const result = parseIntent('讨论一下：AI到底是在创造就业还是消灭就业');
    expect(result.type).toBe('opinion');
  });

  it('T5: opinion with platform keyword', () => {
    const result = parseIntent('AI让谁变富了？发公众号');
    expect(result.type).toBe('opinion');
    expect(result.platforms).toContain('wechat');
  });

  it('T6: 判断句 without question mark still triggers opinion (short input)', () => {
    const result = parseIntent('AI时代最大的受益者是资本家');
    expect(result.type).toBe('opinion');
  });

  it('T7: 普通create intent 不被误判为opinion', () => {
    const result = parseIntent('帮我写一篇关于AI时代的职场人文章 发公众号');
    expect(result.type).toBe('create');
    expect(result.type).not.toBe('opinion');
  });

  it('T8: recreate with path not misclassified as opinion', () => {
    const result = parseIntent('d:/work/爆款文章.md');
    expect(result.type).toBe('recreate');
  });
});

// ── T9-T12: RefinedOpinion type validation ────────────────────────

describe('RefinedOpinion type validation', () => {
  it('T9: valid RefinedOpinion passes validation', () => {
    const valid: RefinedOpinion = {
      originalOpinion: 'AI时代最大的受益者和失意者是谁？',
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人，而最大失意者是不具备这两者的中层白领。',
      type: 'comparison',
      evidence: ['顶级工程师+AI=10倍产出', '中层白领被信息差消除'],
      counterArguments: ['AI也创造了新岗位', '技术普及长期利好'],
      boundaries: '本论点聚焦科技行业，不覆盖制造业蓝领',
      whyNow: '2024-2025年AI爆发期，大规模裁员新闻引发广泛讨论',
      hkrScore: { h: 85, k: 78, r: 82 },
      recommendedTitles: [
        'AI时代：谁在暴富，谁在出局？',
        '被AI改变的社会阶层：有人在上升，有人在坠落',
        '一个残忍的真相：AI革命受益者只有两种人',
      ],
    };
    expect(() => validateRefinedOpinion(valid)).not.toThrow();
  });

  it('T10: missing required field fails validation', () => {
    const invalid = {
      originalOpinion: 'AI时代最大的受益者和失意者是谁？',
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      // missing type, evidence, hkrScore
    };
    expect(() => validateRefinedOpinion(invalid as RefinedOpinion)).toThrow();
  });

  it('T11: hkrScore out of range fails', () => {
    const invalid: RefinedOpinion = {
      originalOpinion: 'test',
      refinedThesis: 'test thesis',
      type: 'judgment',
      evidence: [],
      counterArguments: [],
      boundaries: '',
      whyNow: '',
      hkrScore: { h: 150, k: 50, r: 50 }, // h > 100
      recommendedTitles: [],
    };
    expect(() => validateRefinedOpinion(invalid)).toThrow();
  });

  it('T12: empty refinedThesis fails', () => {
    const invalid: RefinedOpinion = {
      originalOpinion: 'test',
      refinedThesis: '', // empty
      type: 'judgment',
      evidence: [],
      counterArguments: [],
      boundaries: '',
      whyNow: '',
      hkrScore: { h: 0, k: 0, r: 0 },
      recommendedTitles: [],
    };
    expect(() => validateRefinedOpinion(invalid)).toThrow();
  });
});

// ── T13-T15: ConfirmedOpinion type validation ──────────────────────

describe('ConfirmedOpinion type validation', () => {
  it('T13: valid ConfirmedOpinion passes', () => {
    const valid: ConfirmedOpinion = {
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      confirmedTitle: 'AI革命：谁在暴富，谁在出局？',
      opinionType: 'comparison',
      personalCase: '我在互联网公司工作了12年，亲眼见证了从扩招到裁员的完整周期。',
      seedMaterial: '',
    };
    expect(() => validateConfirmedOpinion(valid)).not.toThrow();
  });

  it('T14: missing confirmedTitle fails', () => {
    const invalid: ConfirmedOpinion = {
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      confirmedTitle: '', // empty
      opinionType: 'comparison',
    };
    expect(() => validateConfirmedOpinion(invalid)).toThrow();
  });

  it('T15: optional personalCase can be empty', () => {
    const valid: ConfirmedOpinion = {
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      confirmedTitle: 'AI革命：谁在暴富，谁在出局？',
      opinionType: 'comparison',
      personalCase: '',
      seedMaterial: '',
    };
    expect(() => validateConfirmedOpinion(valid)).not.toThrow();
  });
});

// ── T16-T19: sanitizeFilename for opinion titles ────────────────────

describe('sanitizeFilename for opinion-generated titles', () => {
  it('T16: removes question marks from title', () => {
    expect(sanitizeFilename('AI时代最大的受益者是谁？')).toBe('AI时代最大的受益者是谁');
  });

  it('T17: handles colons from titles', () => {
    expect(sanitizeFilename('AI：谁在暴富，谁在出局？')).toBe('AI谁在暴富谁在出局');
  });

  it('T18: handles Chinese punctuation', () => {
    expect(sanitizeFilename('被AI改变的社会阶层：有人在上升，有人在坠落')).toBe('被AI改变的社会阶层有人在上升有人在坠落');
  });

  it('T19: preserves meaningful characters', () => {
    expect(sanitizeFilename('一个残忍的真相：AI革命受益者只有两种人')).toBe('一个残忍的真相AI革命受益者只有两种人');
  });
});

// ── T20-T22: context persistence for opinion flow ───────────────────

describe('opinion context persistence', () => {
  it('T20: PipelineContext stores opinion artifacts with correct keys', () => {
    const outputDir = 'output/test-opinion';
    const ctx = new PipelineContext('opinion', outputDir, 'opinion-test-run');

    const refined: RefinedOpinion = {
      originalOpinion: 'AI时代最大的受益者和失意者是谁？',
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      type: 'comparison',
      evidence: ['证据1'],
      counterArguments: ['反例1'],
      boundaries: '适用范围',
      whyNow: '为什么现在说',
      hkrScore: { h: 85, k: 78, r: 82 },
      recommendedTitles: ['title1', 'title2'],
    };
    ctx.set('refined-opinion', refined);

    const confirmed: ConfirmedOpinion = {
      refinedThesis: refined.refinedThesis,
      confirmedTitle: 'AI革命：谁在暴富，谁在出局？',
      opinionType: 'comparison',
      personalCase: '我的亲身经历',
      seedMaterial: '',
    };
    ctx.set('confirmed-opinion', confirmed);

    expect(ctx.get<RefinedOpinion>('refined-opinion')?.refinedThesis).toBe(refined.refinedThesis);
    expect(ctx.get<ConfirmedOpinion>('confirmed-opinion')?.confirmedTitle).toBe(confirmed.confirmedTitle);
  });

  it('T21: opinion context persists to disk', async () => {
    // persist() writes to ctx.outputDir directly, but restore() reads from path.join(baseDir, runId)
    // So: context(outputDir = 'base/runId') → persist writes to base/runId/
    //     restore(baseDir='base', runId) → reads from base/runId/  ✓
    const baseDir = 'output/test-opinion';
    const runId = 'opinion-persist-test';
    const ctx = new PipelineContext('opinion', `${baseDir}/${runId}`, runId);

    const confirmed: ConfirmedOpinion = {
      refinedThesis: 'test thesis',
      confirmedTitle: 'test title',
      opinionType: 'judgment',
      personalCase: '',
      seedMaterial: '',
    };
    ctx.set('confirmed-opinion', confirmed);
    await ctx.persist();

    // restore reads from path.join('output/test-opinion', 'opinion-persist-test') = output/test-opinion/opinion-persist-test/
    const restored = await PipelineContext.restore(runId, baseDir);
    expect(restored.get<ConfirmedOpinion>('confirmed-opinion')?.confirmedTitle).toBe('test title');
  });

  it('T22: topic-analysis compatible artifact generated from refined opinion', () => {
    const outputDir = 'output/test-opinion';
    const ctx = new PipelineContext('opinion', outputDir, 'opinion-ta-test');

    const refined: RefinedOpinion = {
      originalOpinion: 'AI时代最大的受益者和失意者是谁？',
      refinedThesis: 'AI时代真正的受益者是拥有资本和顶级技术的人。',
      type: 'comparison',
      evidence: ['证据1'],
      counterArguments: ['反例1'],
      boundaries: '',
      whyNow: '',
      hkrScore: { h: 85, k: 78, r: 82 },
      recommendedTitles: ['title1'],
    };
    ctx.set('refined-opinion', refined);

    // Simulate building topic-analysis compatible artifact
    const topicAnalysisCompatible = {
      keyword: refined.refinedThesis,
      subTopics: [],  // opinion文章不需要多角度展开
    };
    ctx.set('topic-analysis', topicAnalysisCompatible);

    expect(ctx.get('topic-analysis')).toBeTruthy();
    expect((ctx.get('topic-analysis') as any).subTopics).toEqual([]);
  });
});

// ── T23-T28: L1 禁词扫描 ─────────────────────────────────────────

describe('L1 forbidden word scanner', () => {
  it('T23: detects 说白了 as forbidden', () => {
    const scanner = new L1ForbiddenWordScanner();
    const result = scanner.scan('说白了，这就是AI的真相。');
    expect(result.hits.some(h => h.word === '说白了')).toBe(true);
  });

  it('T24: detects 这意味着 as forbidden', () => {
    const scanner = new L1ForbiddenWordScanner();
    const result = scanner.scan('这意味着AI时代来了。');
    expect(result.hits.some(h => h.word === '这意味着')).toBe(true);
  });

  it('T25: detects 本质上 as forbidden', () => {
    const scanner = new L1ForbiddenWordScanner();
    const result = scanner.scan('本质上是一种工具。');
    expect(result.hits.some(h => h.word === '本质上')).toBe(true);
  });

  it('T26: detects 不可否认 as forbidden', () => {
    const scanner = new L1ForbiddenWordScanner();
    const result = scanner.scan('不可否认的事实。');
    expect(result.hits.some(h => h.word === '不可否认')).toBe(true);
  });

  it('T27: clean text has no hits', () => {
    const scanner = new L1ForbiddenWordScanner();
    const result = scanner.scan('这篇文章写得很清楚，观点也明确。');
    expect(result.hits.length).toBe(0);
  });

  it('T28: replacement map has all forbidden words (keys present)', () => {
    // 注意：空字符串表示"删除该词"，是合法的 replacement
    expect('说白了' in L1_REPLACEMENTS).toBe(true);
    expect('这意味着' in L1_REPLACEMENTS).toBe(true);
    expect('本质上' in L1_REPLACEMENTS).toBe(true);
    expect('不可否认' in L1_REPLACEMENTS).toBe(true);
  });
});

// ── T29-T34: L2 风格检查 ─────────────────────────────────────────

describe('L2 style checker', () => {
  it('T29: detects absence of punctuation (no LLM smell)', () => {
    const checker = new L2StyleChecker();
    const result = checker.check('首先...其次...最后...接下来让我们看看');
    expect(result.flags.some(f => f.code === 'llm_punctuation')).toBe(true);
  });

  it('T30: detects textbook opening', () => {
    const checker = new L2StyleChecker();
    const result = checker.check('在当今AI快速发展的时代，技术日新月异。');
    expect(result.flags.some(f => f.code === 'textbook_opening')).toBe(true);
  });

  it('T31: clean opening has no flags', () => {
    const checker = new L2StyleChecker();
    const result = checker.check('故事是这样的。上周五，我坐在会议室里。');
    expect(result.flags.length).toBe(0);
  });

  it('T32: detects missing HKR match (no HKR mentioned)', () => {
    const checker = new L2StyleChecker();
    const longText = 'x'.repeat(2000);
    const result = checker.check(longText);
    expect(result.flags.some(f => f.code === 'hkr_match' || f.code === 'no_break')).toBe(true);
  });

  it('T33: detects short sentence rhythm (good)', () => {
    const checker = new L2StyleChecker();
    const text = '这句话很短。\n\n但它很有力。\n\n我喜欢。';
    const result = checker.check(text);
    // Should not flag rhythm issues if has short sentences
    expect(result.flags.filter(f => f.code === 'rhythm_flat').length).toBe(0);
  });

  it('T34: L2 report structure has flags and score', () => {
    const checker = new L2StyleChecker();
    const result = checker.check('任意文本');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('score');
    expect(typeof result.score).toBe('number');
  });
});

// ── T35: opinion resume requires runId ───────────────────────────

describe('opinion resume validation', () => {
  it('T35: phase=content without runId should throw', async () => {
    const { runOpinion } = await import('../../../src/scenarios/opinion/index.js');
    await expect(
      runOpinion('test opinion', { phase: 'content' })
    ).rejects.toThrow(/requires --run-id/);
  });
});

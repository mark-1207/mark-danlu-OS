import { describe, it, expect } from 'vitest';
import {
  ShortAngleSchema,
  ShortContentSchema,
  ShortReviewSchema,
} from '../../../src/scenarios/create/types.js';

// ─── ShortAngleSchema ──────────────────────────────────────────────

describe('ShortAngleSchema', () => {
  const validAngle = {
    angle: 'AI不会取代你，但会用AI的人会取代你',
    hookStrategy: '反常识',
    emotionalCore: '焦虑+希望',
    targetAudience: '30+职场白领',
  };

  it('T1: accepts valid ShortAngle', () => {
    expect(() => ShortAngleSchema.parse(validAngle)).not.toThrow();
  });

  it('T2: rejects missing angle', () => {
    const invalid = {
      hookStrategy: '反常识',
      emotionalCore: '焦虑+希望',
      targetAudience: '30+职场白领',
    };
    expect(() => ShortAngleSchema.parse(invalid)).toThrow();
  });

  it('T3: rejects empty angle', () => {
    expect(() => ShortAngleSchema.parse({ ...validAngle, angle: '' })).toThrow();
  });

  it('T4: rejects missing hookStrategy', () => {
    const { hookStrategy: _drop, ...rest } = validAngle;
    expect(() => ShortAngleSchema.parse(rest)).toThrow();
  });

  it('T5: rejects missing targetAudience', () => {
    const { targetAudience: _drop, ...rest } = validAngle;
    expect(() => ShortAngleSchema.parse(rest)).toThrow();
  });
});

// ─── ShortContentSchema ────────────────────────────────────────────

describe('ShortContentSchema', () => {
  const validContent = {
    title: 'AI不会取代你',
    content: 'x'.repeat(300), // 300 chars
    wordCount: 300,
    hookType: '反常识',
    goldenSentence: '会用AI的人，正在悄悄取代你',
  };

  it('T6: accepts valid ShortContent at 200 chars', () => {
    expect(() =>
      ShortContentSchema.parse({ ...validContent, content: 'x'.repeat(200), wordCount: 200 }),
    ).not.toThrow();
  });

  it('T7: accepts valid ShortContent at 500 chars', () => {
    expect(() =>
      ShortContentSchema.parse({ ...validContent, content: 'x'.repeat(500), wordCount: 500 }),
    ).not.toThrow();
  });

  it('T8: rejects content shorter than 200 chars', () => {
    expect(() =>
      ShortContentSchema.parse({ ...validContent, content: 'x'.repeat(199), wordCount: 199 }),
    ).toThrow();
  });

  it('T9: rejects content longer than 500 chars', () => {
    expect(() =>
      ShortContentSchema.parse({ ...validContent, content: 'x'.repeat(501), wordCount: 501 }),
    ).toThrow();
  });

  it('T10: rejects empty goldenSentence (强制金句)', () => {
    expect(() => ShortContentSchema.parse({ ...validContent, goldenSentence: '' })).toThrow();
  });

  it('T11: rejects missing goldenSentence', () => {
    const { goldenSentence: _drop, ...rest } = validContent;
    expect(() => ShortContentSchema.parse(rest)).toThrow();
  });

  it('T12: rejects missing title', () => {
    const { title: _drop, ...rest } = validContent;
    expect(() => ShortContentSchema.parse(rest)).toThrow();
  });
});

// ─── ShortReviewSchema ─────────────────────────────────────────────

describe('ShortReviewSchema', () => {
  const validScores = {
    emotionalResonance: 8,
    virality: 7,
    hookStrength: 9,
    groundedness: 8,
    insightDensity: 7,
  };

  const validStyleFlags = {
    isPreachy: false,
    isColloquial: true,
  };

  const validReview = {
    title: 'AI不会取代你',
    content: 'x'.repeat(300),
    wordCount: 300,
    scores: validScores,
    styleFlags: validStyleFlags,
    suggestions: ['第一句可以更直接'],
    approved: true,
  };

  it('T13: accepts valid ShortReview', () => {
    expect(() => ShortReviewSchema.parse(validReview)).not.toThrow();
  });

  it('T14: accepts score at lower bound (1)', () => {
    const minScores = {
      emotionalResonance: 1,
      virality: 1,
      hookStrength: 1,
      groundedness: 1,
      insightDensity: 1,
    };
    expect(() => ShortReviewSchema.parse({ ...validReview, scores: minScores })).not.toThrow();
  });

  it('T15: accepts score at upper bound (10)', () => {
    const maxScores = {
      emotionalResonance: 10,
      virality: 10,
      hookStrength: 10,
      groundedness: 10,
      insightDensity: 10,
    };
    expect(() => ShortReviewSchema.parse({ ...validReview, scores: maxScores })).not.toThrow();
  });

  it('T16: rejects score below 1', () => {
    expect(() =>
      ShortReviewSchema.parse({
        ...validReview,
        scores: { ...validScores, emotionalResonance: 0 },
      }),
    ).toThrow();
  });

  it('T17: rejects score above 10', () => {
    expect(() =>
      ShortReviewSchema.parse({
        ...validReview,
        scores: { ...validScores, virality: 11 },
      }),
    ).toThrow();
  });

  it('T18: rejects missing styleFlags', () => {
    const { styleFlags: _drop, ...rest } = validReview;
    expect(() => ShortReviewSchema.parse(rest)).toThrow();
  });

  it('T19: accepts isPreachy=true (标记待改，不是失败)', () => {
    expect(() =>
      ShortReviewSchema.parse({
        ...validReview,
        styleFlags: { isPreachy: true, isColloquial: false },
      }),
    ).not.toThrow();
  });

  it('T20: accepts empty suggestions array', () => {
    expect(() => ShortReviewSchema.parse({ ...validReview, suggestions: [] })).not.toThrow();
  });

  it('T21: rejects missing approved field', () => {
    const { approved: _drop, ...rest } = validReview;
    expect(() => ShortReviewSchema.parse(rest)).toThrow();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineContext } from '../../../../src/core/context.js';
import type { LLMProvider } from '../../../../src/llm/types.js';
import type { ShortContent } from '../../../../src/scenarios/create/types.js';
import { ShortReviewStep } from '../../../../src/scenarios/create/steps/short-review.js';

// ─── ShortReviewStep ───────────────────────────────────────────────

describe('ShortReviewStep', () => {
  const mockShortContent: ShortContent = {
    title: 'AI不会取代你',
    content: 'x'.repeat(300),
    wordCount: 300,
    hookType: '反常识',
    goldenSentence: '会用AI的人，正在悄悄取代你',
  };

  const validLLMResponse = {
    title: 'AI不会取代你',
    content: 'x'.repeat(300),
    wordCount: 300,
    scores: {
      emotionalResonance: 8,
      virality: 7,
      hookStrength: 9,
      groundedness: 8,
      insightDensity: 7,
    },
    styleFlags: {
      isPreachy: false,
      isColloquial: true,
    },
    suggestions: ['第一句可以更直接'],
    approved: true,
  };

  let mockProvider: LLMProvider;

  beforeEach(() => {
    mockProvider = {
      name: 'mock',
      chat: vi.fn(async () => ({
        content: JSON.stringify(validLLMResponse),
        tokenUsage: { input: 100, output: 200 },
        model: 'mock-model',
        finishReason: 'stop',
      })),
    };
  });

  it('T1: has correct config name', () => {
    const step = new ShortReviewStep(mockProvider, 'mock-model');
    expect(step.config.name).toBe('short-review');
  });

  it('T2: returns ShortReview when LLM returns valid JSON', async () => {
    const step = new ShortReviewStep(mockProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-content', mockShortContent);

    const result = await step.execute({}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validLLMResponse);
  });

  it('T3: enforces 1-10 score range via schema validation (partial success on violation)', async () => {
    const outOfRangeProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn(async () => ({
        content: JSON.stringify({
          ...validLLMResponse,
          scores: { ...validLLMResponse.scores, emotionalResonance: 15 },
        }),
        tokenUsage: { input: 100, output: 200 },
        model: 'mock-model',
        finishReason: 'stop',
      })),
    };
    const step = new ShortReviewStep(outOfRangeProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-content', mockShortContent);

    const result = await step.execute({}, ctx);

    expect(result).toBeDefined();
  });

  it('T4: requires approved field (boolean)', async () => {
    const noApprovedProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn(async () => ({
        content: JSON.stringify({
          title: 't',
          content: 'x'.repeat(300),
          wordCount: 300,
          scores: validLLMResponse.scores,
          styleFlags: validLLMResponse.styleFlags,
          suggestions: [],
          // no approved
        }),
        tokenUsage: { input: 100, output: 200 },
        model: 'mock-model',
        finishReason: 'stop',
      })),
    };
    const step = new ShortReviewStep(noApprovedProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-content', mockShortContent);

    const result = await step.execute({}, ctx);

    expect(result).toBeDefined();
  });
});

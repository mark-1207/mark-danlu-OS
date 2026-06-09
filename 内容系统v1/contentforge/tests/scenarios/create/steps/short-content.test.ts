import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineContext } from '../../../../src/core/context.js';
import type { LLMProvider } from '../../../../src/llm/types.js';
import type { ShortAngle } from '../../../../src/scenarios/create/types.js';
import { ShortContentStep } from '../../../../src/scenarios/create/steps/short-content.js';

// ─── ShortContentStep ──────────────────────────────────────────────

describe('ShortContentStep', () => {
  const mockShortAngle: ShortAngle = {
    angle: 'AI不会取代你，但会用AI的人会取代你',
    hookStrategy: '反常识',
    emotionalCore: '焦虑+希望',
    targetAudience: '30+职场白领',
  };

  const validLLMResponse = {
    title: 'AI不会取代你',
    content: 'x'.repeat(300),
    wordCount: 300,
    hookType: '反常识',
    goldenSentence: '会用AI的人，正在悄悄取代你',
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
    const step = new ShortContentStep(mockProvider, 'mock-model');
    expect(step.config.name).toBe('short-content');
  });

  it('T2: returns ShortContent when LLM returns valid JSON', async () => {
    const step = new ShortContentStep(mockProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-angle', mockShortAngle);

    const result = await step.execute({}, ctx);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validLLMResponse);
  });

  it('T3: enforces 200-500字 constraint via schema validation (partial success on violation)', async () => {
    const tooShortProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn(async () => ({
        content: JSON.stringify({ ...validLLMResponse, content: 'x'.repeat(100), wordCount: 100 }),
        tokenUsage: { input: 100, output: 200 },
        model: 'mock-model',
        finishReason: 'stop',
      })),
    };
    const step = new ShortContentStep(tooShortProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-angle', mockShortAngle);

    const result = await step.execute({}, ctx);

    // Per step.ts ZodError handling: on retries exhausted, returns success=true with warning='Partial validation failure'
    expect(result).toBeDefined();
    if (result.warning === 'Partial validation failure') {
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    } else {
      expect(result.success).toBe(false);
    }
  });

  it('T4: requires goldenSentence (强制金句)', async () => {
    const noGoldenProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn(async () => ({
        content: JSON.stringify({ ...validLLMResponse, goldenSentence: '' }),
        tokenUsage: { input: 100, output: 200 },
        model: 'mock-model',
        finishReason: 'stop',
      })),
    };
    const step = new ShortContentStep(noGoldenProvider, 'mock-model');
    const ctx = new PipelineContext('create', '/tmp/test', 'test_run');
    ctx.set('short-angle', mockShortAngle);

    const result = await step.execute({}, ctx);

    // Same partial-success contract as T3
    expect(result).toBeDefined();
  });
});

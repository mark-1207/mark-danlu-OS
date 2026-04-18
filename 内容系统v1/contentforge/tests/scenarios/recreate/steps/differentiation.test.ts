import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DifferentiationStep } from '../../../../src/scenarios/recreate/steps/differentiation.js';
import { PipelineContext } from '../../../../src/core/context.js';
import type { LLMProvider } from '../../../../src/llm/types.js';

describe('DifferentiationStep', () => {
  const mockViralGenome = {
    topicStrategy: { painPoint: 'info overload', emotionalTrigger: 'curiosity', targetAudience: 'students', whyItWorks: 'relatable' },
    narrativeStructure: [{ sectionIndex: 0, purpose: 'hook', wordRatio: 0.1, emotionMark: 'curiosity', technique: 'question' }],
    hookTechnique: { type: 'question', mechanism: 'engages', template: 'Ask a question' },
    emotionCurve: [{ position: 0, emotion: 'curiosity', intensity: 5 }],
    powerSentences: [{ original: 'Sentence', structure: 'simple', whyPowerful: 'short' }],
    viralFactors: ['emotion'],
    contentDensityScore: 7,
    estimatedReadTime: '5 min',
  };

  it('auto mode returns selectedDirection from LLM', async () => {
    const context = new PipelineContext('recreate', '/tmp/test-diff', 'test-run');
    context.set('viral-deconstruction', mockViralGenome);
    context.set('_direction', 'auto');

    const mockLLMResponse = {
      directions: [
        { name: '角度1', perspectiveShift: 'shift', audienceShift: 'aud', contentShift: 'cnt', newAngle: 'new', sampleTitle: 'title1', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6, structuralCommitment: '问题共鸣→个人故事→数据支撑' },
        { name: '角度2', perspectiveShift: 's2', audienceShift: 'a2', contentShift: 'c2', newAngle: 'n2', sampleTitle: 'title2', differentiationScore: 6, feasibilityScore: 9, compositeScore: 7.2, structuralCommitment: '观点对比→案例分析→方法总结' },
      ],
      selectedDirection: { name: '角度1', perspectiveShift: 'shift', audienceShift: 'aud', contentShift: 'cnt', newAngle: 'new', sampleTitle: 'title1', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6, structuralCommitment: '问题共鸣→个人故事→数据支撑' },
      selectionReason: 'highest composite score',
    };

    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        tokenUsage: { input: 200, output: 300 },
      }),
    } as any;

    const step = new DifferentiationStep(mockProvider, 'test-model');
    const result = await step.execute({}, context);
    expect(result.success).toBe(true);
    expect(result.data?.selectedDirection?.name).toBe('角度1');
    expect(result.data?.directions.length).toBe(2);
  });

  it('interactive mode returns null selectedDirection', async () => {
    const context = new PipelineContext('recreate', '/tmp/test-diff', 'test-run');
    context.set('viral-deconstruction', mockViralGenome);
    context.set('_direction', 'interactive');

    const mockLLMResponse = {
      directions: [
        { name: '角度1', perspectiveShift: 's', audienceShift: 'a', contentShift: 'c', newAngle: 'n', sampleTitle: 't1', differentiationScore: 8, feasibilityScore: 7, compositeScore: 7.6, structuralCommitment: '问题切入→故事展开→观点升华' },
      ],
      selectedDirection: null,
      selectionReason: 'User will select interactively',
    };

    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        tokenUsage: { input: 200, output: 300 },
      }),
    } as any;

    const step = new DifferentiationStep(mockProvider, 'test-model');
    const result = await step.execute({}, context);
    expect(result.success).toBe(true);
    expect(result.data?.selectedDirection).toBeNull();
    expect(result.data?.directions.length).toBe(1);
  });

  it('returns failure result when viral-deconstruction not in context', async () => {
    const emptyContext = new PipelineContext('recreate', '/tmp/test', 'test-run');
    const step = new DifferentiationStep({} as LLMProvider, 'test-model');
    const result = await step.execute({}, emptyContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('viral-deconstruction not found');
  });

  it('defaults to auto mode when _direction not set', async () => {
    const context = new PipelineContext('recreate', '/tmp/test-diff', 'test-run');
    context.set('viral-deconstruction', mockViralGenome);
    // _direction not set

    const mockLLMResponse = {
      directions: [
        { name: 'a', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 5, feasibilityScore: 5, compositeScore: 5, structuralCommitment: '引入→分析→结论' },
      ],
      selectedDirection: { name: 'a', perspectiveShift: '', audienceShift: '', contentShift: '', newAngle: '', sampleTitle: '', differentiationScore: 5, feasibilityScore: 5, compositeScore: 5, structuralCommitment: '引入→分析→结论' },
      selectionReason: 'auto',
    };

    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        tokenUsage: { input: 200, output: 300 },
      }),
    } as any;

    const step = new DifferentiationStep(mockProvider, 'test-model');
    const result = await step.execute({}, context);
    expect(result.success).toBe(true);
    // In auto mode, selectedDirection should be set by LLM (not null)
    expect(result.data?.selectedDirection?.name).toBe('a');
  });
});

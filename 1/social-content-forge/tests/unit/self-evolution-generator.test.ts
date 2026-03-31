import { describe, it, expect, beforeEach } from 'vitest';
import { LLMPool, LLM_POOL } from '../../src/generation/llm-pool';
import { QualityGate } from '../../src/generation/quality-gate';

describe('LLMPool', () => {
  let pool: LLMPool;

  beforeEach(() => {
    const mockLlmCall = async () => 'result';
    pool = new LLMPool(mockLlmCall);
  });

  it('should get first LLM', () => {
    const llm = pool.getNext();
    expect(llm?.name).toBe('claude');
  });

  it('should move to next LLM', () => {
    pool.next();
    const llm = pool.getNext();
    expect(llm?.name).toBe('gpt');
  });

  it('should return null after all LLMs exhausted', () => {
    pool.next(); // to gpt
    pool.next(); // to deepseek
    pool.next(); // should return null
    const llm = pool.getNext();
    expect(llm).toBeNull();
  });

  it('should reset pool', () => {
    pool.next();
    pool.next();
    pool.reset();
    expect(pool.getNext()?.name).toBe('claude');
  });

  it('should track retry count', () => {
    expect(pool.getRetryCount()).toBe(0);
    pool.incrementRetry();
    expect(pool.getRetryCount()).toBe(1);
  });

  it('should respect max retries', () => {
    const llm = LLM_POOL[0]; // claude with maxRetries=1
    pool.incrementRetry(); // 1
    expect(pool.hasRetries()).toBe(false);
  });
});

describe('QualityGate', () => {
  let gate: QualityGate;

  beforeEach(() => {
    gate = new QualityGate();
  });

  it('should pass when all scores >= 7', () => {
    // Scores need to be high enough to achieve weighted score >= 85
    // Weighted calculation: sum(score * weight * 10) for each dimension
    // With weights: emotion=0.20, utility=0.20, narrative=0.15, socialCurrency=0.10,
    // controversy=0.10, timeliness=0.05, differentiation=0.10, shareability=0.05, conversionPotential=0.05
    // All 9s gives: 9*2 + 9*2 + 9*1.5 + 9*1 + 9*1 + 9*0.5 + 9*1 + 9*0.5 + 9*0.5 = 18+18+13.5+9+9+4.5+9+4.5+4.5 = 90
    const scores = {
      emotion: 9, utility: 9, narrative: 9, socialCurrency: 9,
      controversy: 9, timeliness: 9, differentiation: 9, shareability: 9, conversionPotential: 9,
    };
    const result = gate.evaluate(scores, 'wechat');
    expect(result.passed).toBe(true);
    expect(result.hasVeto).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('should veto when any score < 5', () => {
    const scores = {
      emotion: 8, utility: 8, narrative: 7, socialCurrency: 7,
      controversy: 4, timeliness: 7, differentiation: 7, shareability: 6, conversionPotential: 7,
    };
    const result = gate.evaluate(scores, 'wechat');
    expect(result.passed).toBe(false);
    expect(result.hasVeto).toBe(true);
    expect(result.vetoDimensions).toContain('controversy');
  });

  it('should fail when score < 85', () => {
    const scores = {
      emotion: 6, utility: 6, narrative: 6, socialCurrency: 5,
      controversy: 5, timeliness: 6, differentiation: 5, shareability: 5, conversionPotential: 6,
    };
    const result = gate.evaluate(scores, 'wechat');
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(85);
  });

  it('should generate suggestions', () => {
    const scores = {
      emotion: 5, utility: 8, narrative: 7, socialCurrency: 7,
      controversy: 6, timeliness: 7, differentiation: 7, shareability: 6, conversionPotential: 7,
    };
    const result = gate.evaluate(scores, 'wechat');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toContain('情绪');
  });
});

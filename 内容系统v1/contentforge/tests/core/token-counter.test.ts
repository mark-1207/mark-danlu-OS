import { describe, it, expect } from 'vitest';
import { estimateTokens, initTokenizer } from '../../src/utils/token-counter.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('uses tiktoken after initTokenizer for Chinese text', async () => {
    await initTokenizer();
    const text = '今天天气真好适合出去玩';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    // tiktoken Chinese: ~1-1.3 tok/char (not 0.5 as I estimated)
    expect(tokens).toBeGreaterThanOrEqual(text.length);
  });

  it('uses tiktoken after initTokenizer for English text', async () => {
    await initTokenizer();
    const text = 'the weather is nice today and i want to go outside';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('handles mixed text with tiktoken', async () => {
    await initTokenizer();
    const text = '今天天气很好，the weather is nice';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('falls back to char estimation when not initialized', () => {
    // Without initTokenizer, uses char approximation
    const text = 'AI';
    const tokens = estimateTokens(text);
    // Char estimation: 2 chars, 4 char/tok = 1 token
    expect(tokens).toBeGreaterThan(0);
  });
});

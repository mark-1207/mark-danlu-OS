import { describe, it, expect } from 'vitest';
import { cosineSimilarity, SIMILARITY_THRESHOLD } from '../../../src/utils/embedding.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = [0.1, 0.2, 0.3];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it('returns negative for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('handles different length vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1])).toBe(0);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('SIMILARITY_THRESHOLD', () => {
  it('is 0.85', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.85);
  });
});
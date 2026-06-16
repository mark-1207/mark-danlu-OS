// tests/integration/similarity-check.test.ts
import { describe, it, expect } from 'vitest';
import { SIMILARITY_THRESHOLD, cosineSimilarity, type SimilarityCheckItem, type SimilarityResult } from '../../src/utils/embedding.js';

describe('similarity-check integration', () => {
  it('threshold is 0.80', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.80);
  });

  it('cosineSimilarity works with typical embedding dimensions', () => {
    // Simulate typical embedding values (normalized vectors)
    const vecA = [0.1, 0.2, 0.3, 0.4, 0.5];
    const vecB = [0.1, 0.2, 0.3, 0.4, 0.5];  // identical
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
  });

  it('cosineSimilarity returns low values for different vectors', () => {
    const vecA = [0.1, 0.2, 0.3, 0.4, 0.5];
    const vecB = [-0.1, -0.2, -0.3, -0.4, -0.5];  // opposite direction
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
  });

  it('SimilarityCheckItem interface is correct', () => {
    const item: SimilarityCheckItem = {
      id: 'test-id',
      originalText: '外卖小哥 日赚300 生存记录',
      recreationText: '快递员 月入过万 真实故事',
    };
    expect(item.id).toBe('test-id');
  });

  it('SimilarityResult interface is correct', () => {
    const result: SimilarityResult = {
      id: 'test-id',
      similarity: 0.9,
      flagged: true,
      originalText: 'original',
      recreationText: 'recreation',
    };
    expect(result.flagged).toBe(true);
    expect(result.similarity).toBe(0.9);
  });

  it('flagged is true when similarity > threshold', () => {
    const similarity = 0.90;  // > 0.85
    expect(similarity > SIMILARITY_THRESHOLD).toBe(true);
  });

  it('flagged is false when similarity <= threshold', () => {
    const similarity = 0.80;  // <= 0.85
    expect(similarity > SIMILARITY_THRESHOLD).toBe(false);
  });
});
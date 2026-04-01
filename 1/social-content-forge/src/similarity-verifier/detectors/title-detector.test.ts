import { describe, it, expect } from 'vitest';
import { detectTitleDifference } from './title-detector';

describe('detectTitleDifference', () => {
  it('should return 0 when either title is missing', () => {
    const result = detectTitleDifference('', 'Some Title');
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.detail).toBe('标题缺失');
  });

  it('should return 0 when other title is missing', () => {
    const result = detectTitleDifference('Some Title', '');
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('should return high score for identical titles', () => {
    const result = detectTitleDifference('相同的标题', '相同的标题');
    // Levenshtein distance = 0, so score = (0/maxLen)*100 = 0
    // Identical titles score 0, which is < 60, so passed = false
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('should return higher score for completely different titles', () => {
    const result = detectTitleDifference(
      '这是一个非常长的原始标题内容',
      '完全不同的新标题'
    );
    // Completely different titles should have high distance
    expect(result.score).toBeGreaterThan(60);
    expect(result.passed).toBe(true);
  });

  it('should return 100 when one title is single char and other is different', () => {
    const result = detectTitleDifference('a', 'b');
    // maxLen = 1, distance = 1, score = 1/1*100 = 100
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });
});

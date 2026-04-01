import { describe, it, expect } from 'vitest';
import { detectOpeningEndingDifference } from './opening-ending-detector';

describe('detectOpeningEndingDifference', () => {
  it('should return high difference for completely new opening/ending', () => {
    const original = '这是原文的开头段落，内容较长。\n\n中间内容。\n\n这是原文的结尾段落。';
    const rewritten = '这是全新的改写开头，内容完全不同。\n\n其他内容。\n\n全新的结尾。';
    const result = detectOpeningEndingDifference(original, rewritten);
    expect(result.score).toBeGreaterThan(50);
    expect(result.passed).toBe(true);
  });

  it('should return low difference when opening/ending are truly the same', () => {
    // Use identical opening and ending texts (must be >20 chars each)
    const sameOpening = '这是完全相同的开头段落内容超过二十字符的限制';
    const sameEnding = '这是完全相同的结尾段落内容也超过二十字符';
    const original = `${sameOpening}\n\n中间内容。\n\n${sameEnding}`;
    const rewritten = `${sameOpening}\n\n不同的中间内容。\n\n${sameEnding}`;
    const result = detectOpeningEndingDifference(original, rewritten);
    // Same opening and ending (different middle) should give low difference score
    expect(result.score).toBeLessThan(50);
    expect(result.passed).toBe(false);
  });

  it('should return high score when no valid paragraphs can be extracted', () => {
    // Paragraphs must be > 20 chars to be extracted
    // "短" is only 1 char, so no valid paragraphs are extracted
    // This results in 0 overlap, scoring 100
    const original = '短';
    const rewritten = '不同的短';
    const result = detectOpeningEndingDifference(original, rewritten);
    // No valid paragraphs extracted leads to 100 score (0 overlap)
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });
});

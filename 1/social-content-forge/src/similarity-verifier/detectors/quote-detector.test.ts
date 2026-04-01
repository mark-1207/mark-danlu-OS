import { describe, it, expect } from 'vitest';
import { detectQuoteSimilarity } from './quote-detector';

describe('detectQuoteSimilarity', () => {
  it('should return 0 when original has no quotes', () => {
    const result = detectQuoteSimilarity('这是一段没有引号的文字', '改写后的内容');
    expect(result.score).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.detail).toBe('原文无引号内容');
  });

  it('should detect copied quotes >=15 chars', () => {
    // Original has a quote that is >=15 chars (extracted with >=10 chars, flagged if >=15)
    const original = '他说："这是一个确实超过十五个中文字符的引用内容"然后继续。';
    // Rewritten contains the full quote (with quotes intact)
    const rewritten = '改写版本："这是一个确实超过十五个中文字符的引用内容"出现在这里';
    const result = detectQuoteSimilarity(original, rewritten);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(false);
  });

  it('should pass when copied quotes <15 chars', () => {
    // Quote is only 10 chars - below the 15 char threshold for "copied" flagging
    const original = '他说了句"好的"';
    const rewritten = '改写版本，好的';
    const result = detectQuoteSimilarity(original, rewritten);
    expect(result.passed).toBe(true);
  });

  it('should calculate correct percentage for partial copy', () => {
    // Original has 2 quotes >=15 chars
    const original = '他说："第一个确实超过十五个中文字符的引用"然后说："第二个也超过十五个字符"';
    // Only the first quote is copied (with quotes intact)
    const rewritten = '改写版本："第一个确实超过十五个中文字符的引用"，没有第二个';
    const result = detectQuoteSimilarity(original, rewritten);
    // 1 out of 2 quotes copied = 50%
    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });
});

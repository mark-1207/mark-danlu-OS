import { describe, it, expect } from 'vitest';
import { cacheKey } from './competitor-cache.js';

describe('competitor-cache', () => {
  it('cacheKey returns consistent MD5 for same keyword', () => {
    expect(cacheKey('AI')).toBe(cacheKey('AI'));
    expect(cacheKey('AI')).not.toBe(cacheKey('成长'));
  });
});
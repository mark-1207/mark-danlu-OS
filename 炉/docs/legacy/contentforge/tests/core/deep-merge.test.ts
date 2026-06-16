import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../src/utils/deep-merge.js';

describe('deepMerge', () => {
  it('merges simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('deep merges nested objects', () => {
    const target = { outer: { a: 1, b: 2 } };
    const source = { outer: { b: 3, c: 4 } };
    expect(deepMerge(target, source)).toEqual({ outer: { a: 1, b: 3, c: 4 } });
  });

  it('replaces arrays (does not merge)', () => {
    const target = { arr: [1, 2] };
    const source = { arr: [3, 4, 5] };
    expect(deepMerge(target, source)).toEqual({ arr: [3, 4, 5] });
  });

  it('does not mutate original objects', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    deepMerge(target, source);
    expect(target).toEqual({ a: 1 });
    expect(source).toEqual({ b: 2 });
  });

  it('handles undefined source values', () => {
    const target = { a: 1 };
    const source = { b: undefined };
    expect(deepMerge(target, source)).toEqual({ a: 1 });
  });
});

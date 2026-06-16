import { describe, it, expect } from 'vitest';
import { safeJsonParse } from '../../src/utils/json-parser.js';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const input = '{"name": "test", "value": 123}';
    const result = safeJsonParse<{ name: string; value: number }>(input);
    expect(result.name).toBe('test');
    expect(result.value).toBe(123);
  });

  it('extracts JSON from ```json code block', () => {
    const input = 'Here is the result:\n```json\n{"name": "test"}\n```\nDone.';
    const result = safeJsonParse<{ name: string }>(input);
    expect(result.name).toBe('test');
  });

  it('extracts JSON from bare ``` code block', () => {
    const input = '```\n{"name": "test"}\n```';
    const result = safeJsonParse<{ name: string }>(input);
    expect(result.name).toBe('test');
  });

  it('extracts JSON from trailing text with braces', () => {
    const input = 'The result is {"name": "test"} and thats it.';
    const result = safeJsonParse<{ name: string }>(input);
    expect(result.name).toBe('test');
  });

  it('extracts nested JSON', () => {
    const input = '```json\n{"nested": {"key": "value"}, "arr": [1, 2, 3]}\n```';
    const result = safeJsonParse<{ nested: { key: string }; arr: number[] }>(input);
    expect(result.nested.key).toBe('value');
    expect(result.arr).toEqual([1, 2, 3]);
  });

  it('throws on completely invalid input', () => {
    expect(() => safeJsonParse('not json at all')).toThrow();
  });
});

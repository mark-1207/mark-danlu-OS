import { describe, it, expect } from 'vitest';

describe('v2 Pipeline Integration', () => {
  it('should export generateContent function', async () => {
    const { generateContent } = await import('../../src/index');
    expect(typeof generateContent).toBe('function');
  });

  it('should have correct function signature', async () => {
    const { generateContent } = await import('../../src/index');
    // The function should accept input string and options object
    expect(generateContent.length).toBeGreaterThanOrEqual(1);
  });
});

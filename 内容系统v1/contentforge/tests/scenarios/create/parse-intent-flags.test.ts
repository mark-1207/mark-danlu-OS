import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../../src/cli/commands/skill.js';

// ─── Phase 1: parseIntent flags 结构存在 (无行为变化) ─────────────

describe('parseIntent flags structure (Phase 1 infra)', () => {
  it('T1: create result has flags field', () => {
    const result = parseIntent('帮我写一篇关于AI的文章');
    expect(result.flags).toBeDefined();
  });

  it('T2: flags has opinion property (default false)', () => {
    const result = parseIntent('帮我写一篇关于AI的文章');
    expect(result.flags.opinion).toBe(false);
  });

  it('T3: flags has short property (default false)', () => {
    const result = parseIntent('帮我写一篇关于AI的文章');
    expect(result.flags.short).toBe(false);
  });

  it('T4: recreate result has flags field', () => {
    const result = parseIntent('帮我二创这篇文章');
    expect(result.flags).toBeDefined();
    expect(result.flags.opinion).toBe(false);
    expect(result.flags.short).toBe(false);
  });

  it('T5: recreate with file path has flags', () => {
    const result = parseIntent('改写：d:/work/爆款.md');
    expect(result.flags).toBeDefined();
    expect(result.flags.opinion).toBe(false);
    expect(result.flags.short).toBe(false);
  });

  it('T6: create with platform keyword has flags', () => {
    const result = parseIntent('写一篇AI文章 发公众号');
    expect(result.flags).toBeDefined();
    expect(result.flags.opinion).toBe(false);
    expect(result.flags.short).toBe(false);
  });

  it('T7: opinion-like input now returns type=create (Phase 4: opinion detection removed)', () => {
    // Phase 4: opinion auto-detection removed from parseIntent.
    // Opinion path is now triggered by --opinion flag or interactive disambiguation in create flow.
    const result = parseIntent('AI让谁变富了？发公众号');
    expect(result.type).toBe('create');
    expect(result.platforms).toContain('wechat');
    expect(result.flags).toBeDefined();
    expect(result.flags.opinion).toBe(false);
  });
});

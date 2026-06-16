import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/config/schema.js';

describe('ConfigSchema', () => {
  it('parses valid full config', () => {
    const valid = {
      providers: {
        kimi: { type: 'kimi', defaultModel: 'claude-sonnet-4-6', baseUrl: 'https://yunwu.ai/v1' },
      },
      defaultProvider: 'kimi',
      scenarios: { create: { steps: { 'topic-analysis': { temperature: 0.7 } } } },
      concurrency: { maxParallel: 3, batchSize: 5 },
      output: { dir: './output', saveIntermediateArtifacts: true },
      search: { enabled: false },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.defaultProvider).toBe('kimi');
    expect(result.providers.kimi.type).toBe('kimi');
  });

  it('parses minimal config with defaults', () => {
    const minimal = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
    };
    const result = ConfigSchema.parse(minimal);
    // Zod .default() only applies when field exists but is undefined,
    // not when parent object is absent — deepMerge (in loader) handles that
    expect(result.defaultProvider).toBe('anthropic');
  });

  it('rejects invalid provider type', () => {
    const invalid = {
      providers: { test: { type: 'unknown' as any, defaultModel: 'test' } },
      defaultProvider: 'test',
    };
    expect(() => ConfigSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid search provider', () => {
    const invalid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'unknown' as any, apiKey: 'key' },
    };
    expect(() => ConfigSchema.parse(invalid)).toThrow();
  });

  it('accepts valid search config with tavily', () => {
    const valid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'tavily', apiKey: 'test-key' },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.search?.provider).toBe('tavily');
  });

  it('accepts valid search config with serper', () => {
    const valid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'serper', apiKey: 'test-key' },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.search?.provider).toBe('serper');
  });

  it('accepts valid search config with bing', () => {
    const valid = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      search: { enabled: true, provider: 'bing', apiKey: 'test-key' },
    };
    const result = ConfigSchema.parse(valid);
    expect(result.search?.provider).toBe('bing');
  });

  it('strips unknown step override keys (Zod strips, not rejects)', () => {
    const withUnknown = {
      providers: { anthropic: { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' } },
      defaultProvider: 'anthropic',
      scenarios: { create: { steps: { 'topic-analysis': { temperature: 0.7, invalidKey: 123 } } } },
    };
    const result = ConfigSchema.parse(withUnknown);
    // Zod strips unknown keys, so invalidKey should not be present
    expect((result.scenarios?.create?.steps?.['topic-analysis'] as any)?.invalidKey).toBeUndefined();
    expect(result.scenarios?.create?.steps?.['topic-analysis']?.temperature).toBe(0.7);
  });
});

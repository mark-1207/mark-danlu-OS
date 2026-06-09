import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline } from '../../../src/core/pipeline.js';
import type { Config } from '../../../src/config/schema.js';
import { llmFactory } from '../../../src/llm/factory.js';
import { buildShortPipeline } from '../../../src/scenarios/create/index.js';

// ─── buildShortPipeline ───────────────────────────────────────────

describe('buildShortPipeline', () => {
  const fakeConfig: Config = {
    providers: {
      xiaomi: {
        type: 'openai',
        apiKey: 'fake-key',
        baseUrl: 'https://fake.api',
        defaultModel: 'mimo-v2-flash',
        models: {},
      } as any,
    },
    defaultProvider: 'xiaomi',
    obsidian: { vaultPath: '', readDirs: [], writeDir: '' },
    output: { dir: './output', saveIntermediateArtifacts: false },
  };

  beforeEach(() => {
    // Register fake provider for each test
    for (const [name, providerConfig] of Object.entries(fakeConfig.providers)) {
      llmFactory.register(name, providerConfig as any);
    }
  });

  it('T1: exists in scenarios/create/index.ts', () => {
    expect(typeof buildShortPipeline).toBe('function');
  });

  it('T2: returns a Pipeline instance', () => {
    const pipeline = buildShortPipeline(fakeConfig);
    expect(pipeline).toBeInstanceOf(Pipeline);
  });

  it('T3: pipeline name is "short"', () => {
    const pipeline = buildShortPipeline(fakeConfig);
    expect(pipeline.name).toBe('short');
  });

  it('T4: pipeline has 4 steps: topic-analysis, short-angle-selection, short-content, short-review', () => {
    const pipeline = buildShortPipeline(fakeConfig);
    const stepNames = ((pipeline as any).config.steps as any[]).map((s: any) => s.config.name);
    expect(stepNames).toEqual([
      'topic-analysis',
      'short-angle-selection',
      'short-content',
      'short-review',
    ]);
  });
});

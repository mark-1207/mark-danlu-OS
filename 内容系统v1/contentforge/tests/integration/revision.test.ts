// tests/integration/revision.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

describe('revision integration', () => {
  const testOutputDir = path.join(process.cwd(), 'data', 'output', `test-revision-${nanoid(6)}`);

  // Override output dir for testing
  const originalOutputDir = process.env.OUTPUT_DIR;
  beforeAll(async () => {
    process.env.OUTPUT_DIR = testOutputDir;
    // Ensure data/output directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    process.env.OUTPUT_DIR = originalOutputDir;
    // Clean up test output
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {}
  });

  it('non-TTY path: selectRevisionElements returns empty selections', async () => {
    // Test the element selector's non-TTY fallback returns empty selections
    const { selectRevisionElements } = await import('../../src/scenarios/revision/steps/element-selector.js');

    // In non-TTY, it should return empty selections
    const result = await selectRevisionElements();
    expect(result.selections).toEqual([]);
    expect(result.userInstruction).toBe('');
  });

  it('RevisionPipeline: instantiation with options', async () => {
    const { RevisionPipeline } = await import('../../src/scenarios/revision/index.js');
    const { llmFactory } = await import('../../src/llm/factory.js');
    const { loadConfig } = await import('../../src/config/index.js');

    const config = await loadConfig();
    const providerName = config.defaultProvider;
    const providerConfig = config.providers[providerName];

    if (!providerConfig) {
      // Skip if no provider is configured
      expect(true).toBe(true);
      return;
    }

    // Try to register the provider (may fail silently if no API key)
    llmFactory.register(providerName, providerConfig);

    // Check if provider was actually registered
    let provider;
    try {
      provider = llmFactory.get(providerName);
    } catch {
      // Provider not registered (e.g., missing API key)
      expect(true).toBe(true);
      return;
    }

    const pipeline = new RevisionPipeline({
      parentRunId: 'test-parent-id',
      provider,
      defaultModel: providerConfig.defaultModel,
      outputDir: testOutputDir,
    });

    expect(pipeline).toBeDefined();
  });

  it('RevisionStore: loadManifest returns null for non-existent run', async () => {
    const { RevisionStore } = await import('../../src/storage/revision-store.js');

    const store = new RevisionStore(testOutputDir);
    const manifest = await store.loadManifest('non-existent-run');

    expect(manifest).toBeNull();
  });

  it('RevisionStore: revertToVersion returns error for non-existent run', async () => {
    const { RevisionStore } = await import('../../src/storage/revision-store.js');

    const store = new RevisionStore(testOutputDir);
    const result = await store.revertToVersion('non-existent', 'v1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到修订历史');
  });
});
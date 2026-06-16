import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineContext } from '../../src/core/context.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('PipelineContext', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'));
  });

  it('stores and retrieves artifacts', () => {
    const ctx = new PipelineContext('create', tmpDir, 'test-run');
    ctx.set('step1', { result: 'data' });
    expect(ctx.get<{ result: string }>('step1')?.result).toBe('data');
  });

  it('stores step results with token usage', () => {
    const ctx = new PipelineContext('create', tmpDir, 'test-run');
    ctx.setStepResult('step1', {
      success: true,
      data: { result: 'ok' },
      tokenUsage: { input: 100, output: 200 },
      durationMs: 500,
    });

    const result = ctx.getStepResult('step1');
    expect(result?.success).toBe(true);
    expect(result?.tokenUsage.output).toBe(200);
  });

  it('calculates total token usage', () => {
    const ctx = new PipelineContext('create', tmpDir, 'test-run');
    ctx.setStepResult('step1', { success: true, tokenUsage: { input: 100, output: 50 }, durationMs: 100 });
    ctx.setStepResult('step2', { success: true, tokenUsage: { input: 200, output: 80 }, durationMs: 100 });

    const usage = ctx.getTotalTokenUsage();
    expect(usage.input).toBe(300);
    expect(usage.output).toBe(130);
    expect(usage.estimatedCost).toBeGreaterThan(0);
  });

  it('returns undefined for non-existent artifacts', () => {
    const ctx = new PipelineContext('create', tmpDir, 'test-run');
    expect(ctx.get('nonexistent')).toBeUndefined();
  });

  it('runId and scenario are exposed', () => {
    const ctx = new PipelineContext('recreate', tmpDir, 'my-run-id');
    expect(ctx.runId).toBe('my-run-id');
    expect(ctx.scenario).toBe('recreate');
  });
});

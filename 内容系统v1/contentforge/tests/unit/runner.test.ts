import { describe, it, expect } from 'vitest';
import { Runner } from '../../src/core/runner.js';
import { PipelineContext } from '../../src/core/context.js';

describe('Runner', () => {
  it('runOne generates unique runId each call', async () => {
    const runner = new Runner({ outputDir: '/tmp/test-runner', maxParallel: 3 });

    const mockPipeline = {
      name: 'create',
      run: async (input: unknown, ctx: PipelineContext) => {
        // Simulate a successful pipeline run — runOne uses finalContext returned here
        const resultCtx = new PipelineContext('create', ctx.getOutputDir(), ctx.runId + '_suffix');
        return { context: resultCtx, success: true };
      },
    } as any;

    const id1 = await runner.runOne(mockPipeline, {});
    const id2 = await runner.runOne(mockPipeline, {});

    expect(id1.runId).toBeTruthy();
    expect(id2.runId).toBeTruthy();
    expect(id1.runId).not.toBe(id2.runId);
  });
});

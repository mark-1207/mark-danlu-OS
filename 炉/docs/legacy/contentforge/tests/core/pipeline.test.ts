import { describe, it, expect, vi } from 'vitest';
import { Pipeline } from '../../src/core/pipeline.js';
import { PipelineContext } from '../../src/core/context.js';
import { PipelineStep } from '../../src/core/step.js';
import { z } from 'zod';

const mockProvider = {
  name: 'test',
  chat: vi.fn(),
};

class SuccessStep extends PipelineStep<{ input: string }, { output: string }> {
  config = { name: 'success-step', description: 'always succeeds' };
  inputSchema = z.object({ input: z.string() });
  outputSchema = z.object({ output: z.string() });

  constructor() {
    super(mockProvider as any, 'test-model');
  }

  protected async doExecute(input: { input: string }, _context: PipelineContext) {
    return { output: `processed: ${input.input}` };
  }
}

class FailStep extends PipelineStep<unknown, unknown> {
  config = { name: 'fail-step', description: 'always fails', optional: false };
  inputSchema = z.unknown();
  outputSchema = z.unknown();

  constructor() {
    super(mockProvider as any, 'test-model');
  }

  protected async doExecute(_input: unknown, _context: PipelineContext) {
    throw new Error('intentional failure');
  }
}

describe('Pipeline', () => {
  it('runs a single step successfully', async () => {
    const step = new SuccessStep();
    const pipeline = new Pipeline({ name: 'test', description: '', steps: [step] });
    const context = new PipelineContext('test', '/tmp/test', 'test-run');

    const { context: resultCtx, success } = await pipeline.run({ input: 'hello' }, context);
    expect(success).toBe(true);
    expect(resultCtx.getStepResult('success-step')?.data).toEqual({ output: 'processed: hello' });
  });

  it('stops on non-optional step failure', async () => {
    const fail = new FailStep();
    const success = new SuccessStep();
    const pipeline = new Pipeline({ name: 'test', description: '', steps: [fail, success] });
    const context = new PipelineContext('test', '/tmp/test', 'test-run');

    const { success: failed } = await pipeline.run({}, context);
    expect(failed).toBe(false);
  });

  it('continues when optional step fails', async () => {
    class OptionalFail extends PipelineStep<unknown, unknown> {
      config = { name: 'optional-fail', description: '', optional: true };
      inputSchema = z.unknown();
      outputSchema = z.unknown();
      constructor() { super(mockProvider as any, 'test-model'); }
      protected async doExecute() { throw new Error('optional fail'); }
    }

    const optionalFail = new OptionalFail();
    const success = new SuccessStep();
    const pipeline = new Pipeline({ name: 'test', description: '', steps: [optionalFail, success] });
    const context = new PipelineContext('test', '/tmp/test', 'test-run');

    const { success: ok } = await pipeline.run({ input: 'hello' }, context);
    expect(ok).toBe(true);
  });

  it('calls onStepComplete callback', async () => {
    const step = new SuccessStep();
    const pipeline = new Pipeline({ name: 'test', description: '', steps: [step] });
    const context = new PipelineContext('test', '/tmp/test', 'test-run');

    const callback = vi.fn();
    pipeline.onStepComplete(callback);

    await pipeline.run({ input: 'x' }, context);
    expect(callback).toHaveBeenCalledWith('success-step', expect.objectContaining({ success: true }));
  });

  it('skips already-completed steps on resume', async () => {
    const step = new SuccessStep();
    const pipeline = new Pipeline({ name: 'test', description: '', steps: [step] });
    const context = new PipelineContext('test', '/tmp/test', 'test-run');
    context.setStepResult('success-step', { success: true, tokenUsage: { input: 0, output: 0 }, durationMs: 100 });

    const callback = vi.fn();
    pipeline.onStepComplete(callback);

    const { success } = await pipeline.resumeFrom('success-step', context);
    expect(success).toBe(true);
    expect(callback).not.toHaveBeenCalled(); // skipped
  });
});

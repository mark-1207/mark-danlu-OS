import pLimit from 'p-limit';
import type { PipelineContext, StepResult } from './context.js';
import type { PipelineStep } from './step.js';
import { logger } from '../utils/logger.js';

export interface ParallelGroup {
  stepNames: string[];
  concurrency?: number;
}

export interface PipelineConfig {
  name: string;
  description: string;
  steps: PipelineStep[];
  parallelGroups?: ParallelGroup[];
}

/**
 * Pipeline executes a sequence (or parallel groups) of steps.
 */
export class Pipeline {
  private stepCallbacks: Array<(stepName: string, result: StepResult) => void> = [];

  constructor(private config: PipelineConfig) {}

  get name(): string {
    return this.config.name;
  }

  /** Register a callback for step completion (used by CLI for progress display) */
  onStepComplete(callback: (stepName: string, result: StepResult) => void): void {
    this.stepCallbacks.push(callback);
  }

  private notifyStepComplete(stepName: string, result: StepResult): void {
    for (const cb of this.stepCallbacks) {
      cb(stepName, result);
    }
  }

  /**
   * Run the pipeline from scratch.
   */
  async run(input: unknown, context: PipelineContext): Promise<{ context: PipelineContext; success: boolean }> {
    logger.info(`[Pipeline:${this.config.name}] starting`, { stepCount: this.config.steps.length });

    // Build a name→step map
    const stepMap = new Map(this.config.steps.map((s) => [s.config.name, s]));

    // Determine execution order: parallel groups first, then remaining sequential steps
    const parallelGroupNames = new Set(this.config.parallelGroups?.flatMap((g) => g.stepNames) ?? []);
    const sequentialSteps = this.config.steps.filter((s) => !parallelGroupNames.has(s.config.name));
    const parallelGroups = this.config.parallelGroups ?? [];

    // Run sequential steps
    for (const step of sequentialSteps) {
      const result = await this.runStep(step, input, context);
      context.setStepResult(step.config.name, result);
      if (result.success && result.data !== undefined) {
        context.set(step.config.name, result.data);
      }

      if (!result.success && !step.config.optional) {
        logger.error(`[Pipeline:${this.config.name}] step ${step.config.name} failed, halting`);
        return { context, success: false };
      }

      // Persist after each step
      await context.persist();
    }

    // Run parallel groups
    for (const group of parallelGroups) {
      const groupSteps = group.stepNames.map((name) => stepMap.get(name)).filter(Boolean) as PipelineStep[];
      const limit = pLimit(group.concurrency ?? 3);

      const results = await Promise.all(
        groupSteps.map((step) =>
          limit(async () => {
            const result = await this.runStep(step, input, context);
            context.setStepResult(step.config.name, result);
            if (result.success && result.data !== undefined) {
              context.set(step.config.name, result.data);
            }
            return result;
          }),
        ),
      );

      // Persist after parallel group
      await context.persist();

      // Check for failures
      const failedStep = results.find((r, i) => !r.success && !groupSteps[i].config.optional);
      if (failedStep) {
        logger.error(`[Pipeline:${this.config.name}] parallel group failed at step ${failedStep}`);
        return { context, success: false };
      }
    }

    logger.info(`[Pipeline:${this.config.name}] completed`);
    return { context, success: true };
  }

  /**
   * Resume from a specific step.
   * Assumes context already has all prior artifacts loaded.
   * Respects parallel group concurrency — steps in the same group run together.
   */
  async resumeFrom(stepName: string, context: PipelineContext): Promise<{ context: PipelineContext; success: boolean }> {
    const stepIndex = this.config.steps.findIndex((s) => s.config.name === stepName);
    if (stepIndex === -1) {
      throw new Error(`Step '${stepName}' not found in pipeline`);
    }

    // Find if this step belongs to a parallel group — if so, resume the whole group
    const parallelGroup = this.config.parallelGroups?.find((g) => g.stepNames.includes(stepName));
    const stepsInGroup = parallelGroup?.stepNames ?? [stepName];

    const stepMap = new Map(this.config.steps.map((s) => [s.config.name, s]));
    const stepsToRun = stepsInGroup
      .map((name) => stepMap.get(name))
      .filter(Boolean) as PipelineStep[];

    logger.info(`[Pipeline:${this.config.name}] resuming from ${stepName}`, {
      stepsToRun: stepsToRun.map((s) => s.config.name),
      group: parallelGroup?.stepNames ?? [],
    });

    if (parallelGroup) {
      // Run parallel group with concurrency limit
      const limit = pLimit(parallelGroup.concurrency ?? 3);
      const results = await Promise.all(
        stepsToRun.map((step) =>
          limit(async () => {
            const existing = context.getStepResult(step.config.name);
            if (existing?.success) {
              logger.info(`[Pipeline:${this.config.name}] skipping already-completed step: ${step.config.name}`);
              return existing;
            }
            const result = await this.runStep(step, context.get(step.config.name) ?? {}, context);
            context.setStepResult(step.config.name, result);
            if (result.success && result.data !== undefined) {
              context.set(step.config.name, result.data);
            }
            return result;
          }),
        ),
      );
      await context.persist();

      const failedStep = results.find((r, i) => !r.success && !stepsToRun[i].config.optional);
      if (failedStep) {
        logger.error(`[Pipeline:${this.config.name}] parallel group resume failed`);
        return { context, success: false };
      }
    } else {
      // Sequential resume
      for (const step of stepsToRun) {
        const existing = context.getStepResult(step.config.name);
        if (existing?.success) {
          logger.info(`[Pipeline:${this.config.name}] skipping already-completed step: ${step.config.name}`);
          continue;
        }

        const result = await this.runStep(step, context.get(step.config.name) ?? {}, context);
        context.setStepResult(step.config.name, result);
        if (result.success && result.data !== undefined) {
          context.set(step.config.name, result.data);
        }

        if (!result.success && !step.config.optional) {
          logger.error(`[Pipeline:${this.config.name}] step ${step.config.name} failed on resume`);
          return { context, success: false };
        }

        await context.persist();
      }
    }

    return { context, success: true };
  }

  private async runStep(step: PipelineStep, input: unknown, context: PipelineContext): Promise<StepResult> {
    const stepStart = Date.now();
    logger.info(`[Pipeline:${this.config.name}] running step: ${step.config.name}`);

    try {
      const result = await step.execute(input, context);
      const durationMs = Date.now() - stepStart;

      if (result.success) {
        logger.info(`[Pipeline:${this.config.name}] step ${step.config.name} OK (${durationMs}ms)`, {
          tokens: result.tokenUsage,
        });
      } else {
        logger.error(`[Pipeline:${this.config.name}] step ${step.config.name} FAILED: ${result.error}`);
      }

      this.notifyStepComplete(step.config.name, result);
      return result;
    } catch (error) {
      const durationMs = Date.now() - stepStart;
      logger.error(`[Pipeline:${this.config.name}] step ${step.config.name} exception: ${error}`);
      return {
        success: false,
        error: String(error),
        tokenUsage: { input: 0, output: 0 },
        durationMs,
      };
    }
  }
}

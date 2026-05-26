import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { estimateCost } from '../utils/token-counter.js';

export interface StepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
  tokenUsage: {
    input: number;
    output: number;
  };
  durationMs: number;
}

export interface RunMeta {
  runId: string;
  scenario: string;
  input: unknown;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  completedSteps: string[];
  tokenUsage: {
    input: number;
    output: number;
    estimatedCost: number;
  };
}

/**
 * PipelineContext holds all intermediate artifacts for a single pipeline run.
 * It supports persistence to disk for resume/recovery.
 */
export class PipelineContext {
  readonly runId: string;
  readonly scenario: string;
  readonly startedAt: Date;

  private artifacts = new Map<string, unknown>();
  private stepResults = new Map<string, StepResult>();
  private outputDir: string;

  constructor(scenario: string, outputDir: string, runId?: string) {
    this.runId = runId ?? nanoid(10);
    this.scenario = scenario;
    this.startedAt = new Date();
    this.outputDir = outputDir;
  }

  /** Store an intermediate artifact */
  set(key: string, value: unknown): void {
    this.artifacts.set(key, value);
  }

  /** Retrieve an intermediate artifact */
  get<T>(key: string): T | undefined {
    return this.artifacts.get(key) as T | undefined;
  }

  /** Store a step result (including token usage) */
  setStepResult(name: string, result: StepResult): void {
    this.stepResults.set(name, result);
  }

  /** Get a step result */
  getStepResult(name: string): StepResult | undefined {
    return this.stepResults.get(name);
  }

  /** Get all step results */
  getAllStepResults(): Map<string, StepResult> {
    return this.stepResults;
  }

  /** Get total token usage and estimated cost */
  getTotalTokenUsage(): { input: number; output: number; estimatedCost: number } {
    let totalInput = 0;
    let totalOutput = 0;

    for (const result of this.stepResults.values()) {
      totalInput += result.tokenUsage.input;
      totalOutput += result.tokenUsage.output;
    }

    return {
      input: totalInput,
      output: totalOutput,
      estimatedCost: estimateCost(totalInput, totalOutput),
    };
  }

  /** Get the output directory for this run */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Persist context and all artifacts to disk.
   * Called after each step completes.
   */
  async persist(): Promise<void> {
    const dir = this.outputDir;
    await fs.mkdir(dir, { recursive: true });

    // Write run-meta.json
    const meta = this.buildMeta();
    await fs.writeFile(path.join(dir, 'run-meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

    // Write each artifact
    for (const [key, value] of this.artifacts) {
      const fileName = `${key}.json`;
      await fs.writeFile(path.join(dir, fileName), JSON.stringify(value, null, 2), 'utf-8');
    }

    logger.info(`Persisted context for run ${this.runId}`, { stepCount: this.artifacts.size });
  }

  /**
   * Restore a context from disk by runId.
   */
  static async restore(runId: string, baseDir: string): Promise<PipelineContext> {
    const dir = path.join(baseDir, runId);
    const metaPath = path.join(dir, 'run-meta.json');

    let meta: RunMeta;
    try {
      const content = await fs.readFile(metaPath, 'utf-8');
      meta = JSON.parse(content) as RunMeta;
    } catch {
      throw new Error(`Cannot restore run ${runId}: run-meta.json not found`);
    }

    const context = new PipelineContext(meta.scenario, dir, runId);
    const completedSet = new Set(meta.completedSteps);

    // Read ALL .json artifact files (not just completedSteps)
    // This preserves non-step keys like confirmed-outline-*, outline-seed-material-*, etc.
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      files = [];
    }

    for (const file of files) {
      if (file === 'run-meta.json' || file === 'run.log' || !file.endsWith('.json')) continue;
      const key = file.replace(/\.json$/, '');
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const data = JSON.parse(content);
        context.set(key, data);
        if (completedSet.has(key)) {
          context.setStepResult(key, {
            success: true,
            data,
            tokenUsage: { input: 0, output: 0 },
            durationMs: 0,
          });
        }
      } catch {
        // skip corrupt or unreadable files
      }
    }

    logger.info(`Restored context for run ${runId}`, {
      artifacts: files.filter(f => f.endsWith('.json') && f !== 'run-meta.json').length,
      completedSteps: meta.completedSteps,
    });
    return context;
  }

  /** Build run metadata */
  private buildMeta(): RunMeta {
    const tokenUsage = this.getTotalTokenUsage();
    const completedSteps = Array.from(this.stepResults.keys()).filter(
      (name) => this.stepResults.get(name)?.success,
    );

    return {
      runId: this.runId,
      scenario: this.scenario,
      input: {}, // input stored separately
      startedAt: this.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed',
      completedSteps,
      tokenUsage,
    };
  }
}

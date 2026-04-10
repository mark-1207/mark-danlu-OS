import pLimit from 'p-limit';
import path from 'path';
import fs from 'fs/promises';
import { nanoid } from 'nanoid';
import { PipelineContext } from './context.js';
import type { Pipeline } from './pipeline.js';
import { logger } from '../utils/logger.js';
import { setupRunLogger } from '../utils/logger.js';

export interface RunnerConfig {
  outputDir: string;
  maxParallel?: number;
  batchSize?: number;
}

/**
 * Runner handles batch execution and concurrency control for pipelines.
 */
export class Runner {
  constructor(private config: RunnerConfig) {}

  /**
   * Run a single pipeline instance.
   */
  async runOne(pipeline: Pipeline, input: unknown): Promise<PipelineContext> {
    const runId = nanoid(10);
    const runDir = path.join(this.config.outputDir, `${this.formatDate()}_${runId}`);

    await fs.mkdir(runDir, { recursive: true });
    await setupRunLogger(runDir);

    const context = new PipelineContext(pipeline.name, runDir, runId);
    const { context: finalContext } = await pipeline.run(input, context);

    await finalContext.persist();
    return finalContext;
  }

  /**
   * Run multiple pipeline instances in parallel with concurrency control.
   * Supports batchSize for chunked execution.
   */
  async runBatch(
    pipelines: Array<{ pipeline: Pipeline; input: unknown }>,
    onProgress?: (index: number, total: number, runId: string, error?: string) => void,
  ): Promise<PipelineContext[]> {
    const limit = pLimit(this.config.maxParallel ?? 3);
    const batchSize = this.config.batchSize ?? 0;
    const results: PipelineContext[] = [];

    // Chunk if batchSize > 0
    const chunks: Array<Array<{ pipeline: Pipeline; input: unknown }>> = [];
    if (batchSize > 0) {
      for (let i = 0; i < pipelines.length; i += batchSize) {
        chunks.push(pipelines.slice(i, i + batchSize));
      }
    } else {
      chunks.push(pipelines);
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((item) =>
          limit(async () => {
            try {
              const context = await this.runOne(item.pipeline, item.input);
              results.push(context);
              onProgress?.(results.length, pipelines.length, context.runId);
              return context;
            } catch (err) {
              const runId = `batch_err_${results.length}`;
              onProgress?.(results.length, pipelines.length, runId, String(err));
              throw err;
            }
          }),
        ),
      );
      // If batchSize is set and there are more chunks, wait before next chunk
      if (batchSize > 0 && chunks.indexOf(chunk) < chunks.length - 1) {
        logger.info(`Batch chunk completed, waiting before next chunk`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private formatDate(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  }
}

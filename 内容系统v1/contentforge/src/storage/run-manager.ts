import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import type { RunMeta } from '../core/context.js';

/**
 * RunManager tracks all pipeline runs and their metadata.
 */
export class RunManager {
  constructor(private baseDir: string) {}

  /**
   * List all runs (sorted by date, newest first).
   */
  async listRuns(): Promise<RunMeta[]> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      const runs = await Promise.all(
        dirs.map(async (dirName) => {
          try {
            const metaPath = path.join(this.baseDir, dirName, 'run-meta.json');
            const content = await fs.readFile(metaPath, 'utf-8');
            return JSON.parse(content) as RunMeta;
          } catch {
            return null;
          }
        }),
      );

      return runs
        .filter((r): r is RunMeta => r !== null)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    } catch {
      return [];
    }
  }

  /**
   * Get metadata for a specific run.
   */
  async getRun(runId: string): Promise<RunMeta | null> {
    try {
      const metaPath = path.join(this.baseDir, runId, 'run-meta.json');
      const content = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(content) as RunMeta;
    } catch {
      return null;
    }
  }

  /**
   * Delete a run and all its artifacts.
   */
  async deleteRun(runId: string): Promise<void> {
    const runDir = path.join(this.baseDir, runId);
    try {
      await fs.rm(runDir, { recursive: true });
      logger.info(`Deleted run: ${runId}`);
    } catch (error) {
      logger.warn(`Failed to delete run ${runId}: ${error}`);
    }
  }
}

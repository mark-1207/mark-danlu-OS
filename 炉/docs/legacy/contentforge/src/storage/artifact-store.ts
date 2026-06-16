import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * ArtifactStore manages reading and writing of intermediate pipeline artifacts.
 * Each artifact is stored as a JSON file in the run directory.
 */
export class ArtifactStore {
  constructor(private runDir: string) {}

  /**
   * Save an artifact to disk.
   */
  async save(key: string, data: unknown): Promise<void> {
    const filePath = path.join(this.runDir, `${key}.json`);
    await fs.mkdir(this.runDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug(`Artifact saved: ${key}`, { path: filePath });
  }

  /**
   * Load an artifact from disk.
   */
  async load<T>(key: string): Promise<T | null> {
    const filePath = path.join(this.runDir, `${key}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Check if an artifact exists on disk.
   */
  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.runDir, `${key}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all artifact keys that exist in the run directory.
   */
  async listKeys(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.runDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }
}

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderPrompt } from './renderer.js';
import type { PromptTemplate } from './renderer.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Load and render prompt templates.
 *
 * File structure:
 *   templates/{scenario}/{stepName}.system.md
 *   templates/{scenario}/{stepName}.user.md
 *   templates/{scenario}/{stepName}-{variant}.system.md
 *   templates/{scenario}/{stepName}-{variant}.user.md
 */
export class PromptLoader {
  /**
   * Load a prompt template pair for a given scenario and step.
   * Optionally specify a variant (e.g., 'wechat', 'xiaohongshu', 'douyin').
   */
  async load(scenario: string, stepName: string, variant?: string): Promise<PromptTemplate> {
    const baseName = variant ? `${stepName}-${variant}` : stepName;

    const [systemPath, userPath] = await Promise.all([
      this.resolvePath(scenario, `${baseName}.system.md`),
      this.resolvePath(scenario, `${baseName}.user.md`),
    ]);

    const [systemContent, userContent] = await Promise.all([
      this.readFile(systemPath),
      this.readFile(userPath),
    ]);

    return { system: systemContent, user: userContent };
  }

  /**
   * Render a template with variables.
   */
  render(template: string, variables: Record<string, string | boolean | number | undefined>): string {
    return renderPrompt(template, variables);
  }

  private async resolvePath(...parts: string[]): Promise<string> {
    const filePath = path.join(TEMPLATES_DIR, ...parts);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Prompt template not found: ${filePath}`);
    }
    return filePath;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch {
      logger.warn(`Failed to read prompt template: ${filePath}`);
      return '';
    }
  }
}

/** Shared loader instance */
export const promptLoader = new PromptLoader();

export type { PromptTemplate } from './renderer.js';

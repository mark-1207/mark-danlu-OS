import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export interface WriteArticleOptions {
  /** Article title (used as filename) */
  title: string;
  /** Article content (markdown) */
  content: string;
  /** Platform: wechat / xiaohongshu / douyin */
  platform: string;
  /** Topic tags */
  topics?: string[];
  /** Original keyword that triggered generation */
  keyword?: string;
  /** Source run directory (for traceability) */
  runDir?: string;
}

export class ObsidianWriter {
  private vaultPath: string;
  private writeDir: string;

  constructor(vaultPath: string, writeDir: string) {
    this.vaultPath = path.resolve(vaultPath);
    this.writeDir = writeDir;
  }

  /**
   * Write a generated article back to Obsidian vault.
   * Returns the absolute path of the written file.
   */
  async writeArticle(options: WriteArticleOptions): Promise<string> {
    const { title, content, platform, topics = [], keyword, runDir } = options;

    // Ensure write directory exists
    const absWriteDir = path.join(this.vaultPath, this.writeDir);
    await fs.mkdir(absWriteDir, { recursive: true });

    // Build frontmatter
    const now = new Date().toISOString().slice(0, 10);
    const frontmatter = [
      '---',
      `type: article`,
      `platform: ${platform}`,
      `status: draft`,
      `topics: [${topics.join(', ')}]`,
      keyword ? `keyword: "${keyword}"` : null,
      `quality_score: 0`,
      `created: ${now}`,
      `updated: ${now}`,
      runDir ? `source_run: "${runDir}"` : null,
      '---',
    ]
      .filter(Boolean)
      .join('\n');

    // Build file content
    const fileContent = `${frontmatter}\n\n# ${title}\n\n${content}\n`;

    // Sanitize filename
    const safeName = title
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);

    const filePath = path.join(absWriteDir, `${safeName}.md`);
    await fs.writeFile(filePath, fileContent, 'utf-8');

    logger.info(`[ObsidianWriter] wrote article: ${filePath}`);
    return filePath;
  }

  /**
   * Write multiple articles (one per platform).
   * Returns map of platform → file path.
   */
  async writeArticles(articles: WriteArticleOptions[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    for (const article of articles) {
      results[article.platform] = await this.writeArticle(article);
    }
    return results;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let _writer: ObsidianWriter | null = null;

export function getObsidianWriter(vaultPath: string, writeDir: string): ObsidianWriter {
  if (!_writer) {
    _writer = new ObsidianWriter(path.resolve(vaultPath), writeDir);
  }
  return _writer;
}

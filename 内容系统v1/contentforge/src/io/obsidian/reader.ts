import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import type { ObsidianCard, ObsidianQuery, ObsidianMaterial } from './types.js';

// ── Frontmatter parser (lightweight, no dependency) ────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2].trim();
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Parse YAML arrays: [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    // Parse booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Parse numbers
    else if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
    // Strip quotes
    else if (typeof value === 'string') value = value.replace(/^["']|["']$/g, '');

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

// ── Card builder ───────────────────────────────────────────────────────

function buildCard(filePath: string, vaultPath: string, content: string, sourceDir: string): ObsidianCard {
  const { frontmatter, body } = parseFrontmatter(content);
  const relativePath = path.relative(vaultPath, filePath).replace(/\\/g, '/');
  const name = path.basename(filePath, '.md');

  return {
    path: relativePath,
    name,
    type: String(frontmatter.type ?? 'unknown'),
    subtype: frontmatter.subtype ? String(frontmatter.subtype) : undefined,
    topics: Array.isArray(frontmatter.topics) ? (frontmatter.topics as string[]) : [],
    qualityScore: typeof frontmatter.quality_score === 'number' ? frontmatter.quality_score : undefined,
    frontmatter,
    body,
    sourceDir,
  };
}

// ── Keyword relevance scoring ──────────────────────────────────────────

function computeRelevance(card: ObsidianCard, keywords: string[]): number {
  if (keywords.length === 0) return 0.5; // no keywords → neutral score

  const searchable = [
    card.name,
    card.topics.join(' '),
    card.body.slice(0, 500),
  ]
    .join(' ')
    .toLowerCase();

  let matches = 0;
  for (const kw of keywords) {
    if (searchable.includes(kw.toLowerCase())) matches++;
  }

  // Base score from keyword match
  const keywordScore = matches / Math.min(keywords.length, 5);

  // Quality bonus: high-quality cards get a slight boost
  const qualityBonus = card.qualityScore ? (card.qualityScore / 10) * 0.2 : 0;

  return Math.min(keywordScore + qualityBonus, 1);
}

// ── ObsidianReader ─────────────────────────────────────────────────────

export class ObsidianReader {
  private vaultPath: string;
  private readDirs: string[];
  private cards: ObsidianCard[] = [];
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor(vaultPath: string, readDirs: string[]) {
    this.vaultPath = path.resolve(vaultPath);
    this.readDirs = readDirs;
  }

  /**
   * Load all markdown files from configured directories.
   * Idempotent — only loads once.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = this.doLoad();
    await this.loading;
    this.loaded = true;
    this.loading = null;
  }

  private async doLoad(): Promise<void> {
    const cards: ObsidianCard[] = [];

    for (const dir of this.readDirs) {
      const absDir = path.join(this.vaultPath, dir);
      const sourceDirName = path.basename(dir);

      try {
        const files = await this.walkMd(absDir);
        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            cards.push(buildCard(file, this.vaultPath, content, sourceDirName));
          } catch (err) {
            logger.warn(`[ObsidianReader] failed to read ${file}: ${String(err)}`);
          }
        }
      } catch (err) {
        logger.warn(`[ObsidianReader] directory not found: ${absDir}`);
      }
    }

    this.cards = cards;
    logger.info(`[ObsidianReader] loaded ${cards.length} cards from ${this.readDirs.length} directories`);
  }

  /** Recursively find all .md files in a directory */
  private async walkMd(dir: string): Promise<string[]> {
    const results: string[] = [];
    let entries: import('fs/promises').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...(await this.walkMd(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Query cards by filters. Returns all matching cards (no scoring).
   */
  query(options: ObsidianQuery = {}): ObsidianCard[] {
    let results = this.cards;

    if (options.types?.length) {
      results = results.filter((c) => options.types!.includes(c.type));
    }
    if (options.sourceDirs?.length) {
      results = results.filter((c) => options.sourceDirs!.includes(c.sourceDir));
    }
    if (options.topics?.length) {
      const topicSet = new Set(options.topics);
      results = results.filter((c) => c.topics.some((t) => topicSet.has(t)));
    }
    if (options.minQuality !== undefined) {
      results = results.filter((c) => (c.qualityScore ?? 0) >= options.minQuality!);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Search cards by keywords with relevance scoring.
   * Returns sorted by relevance (highest first).
   */
  search(keywords: string[], options: ObsidianQuery = {}): ObsidianMaterial[] {
    const candidates = this.query(options);

    const scored = candidates
      .map((card) => ({
        card,
        relevanceScore: computeRelevance(card, keywords),
      }))
      .filter((m) => m.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored;
  }

  /**
   * Format materials for prompt injection.
   */
  formatForPrompt(materials: ObsidianMaterial[]): string {
    if (materials.length === 0) return '';

    const parts: string[] = ['## 知识库素材（可参考）\n'];

    // Group by source directory
    const byDir = new Map<string, ObsidianMaterial[]>();
    for (const m of materials) {
      const dir = m.card.sourceDir;
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(m);
    }

    for (const [dir, items] of byDir) {
      parts.push(`### ${dir}`);
      for (const { card, relevanceScore } of items) {
        const tag = `[${card.type}${card.subtype ? '/' + card.subtype : ''}]`;
        const scoreTag = ` [相关度:${relevanceScore.toFixed(2)}]`;
        parts.push(`- ${tag} **${card.name}**${scoreTag}`);

        // Include a brief excerpt (first 200 chars of body)
        const excerpt = card.body.replace(/\n+/g, ' ').slice(0, 200);
        parts.push(`  ${excerpt}${card.body.length > 200 ? '...' : ''}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Get a single card by name (exact match).
   */
  getByName(name: string): ObsidianCard | undefined {
    return this.cards.find((c) => c.name === name);
  }

  /**
   * Get total card count.
   */
  get count(): number {
    return this.cards.length;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

const readers = new Map<string, ObsidianReader>();

/**
 * Get or create an ObsidianReader singleton for the given vault path.
 */
export function getObsidianReader(vaultPath: string, readDirs: string[]): ObsidianReader {
  const key = path.resolve(vaultPath);
  if (!readers.has(key)) {
    readers.set(key, new ObsidianReader(key, readDirs));
  }
  return readers.get(key)!;
}

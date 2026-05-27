import fs from 'fs/promises';
import { readdirSync } from 'fs';
import path from 'path';
import { logger } from '../../../utils/logger.js';
import { computeEmbedding, cosineSimilarity, SIMILARITY_THRESHOLD } from '../../../utils/embedding.js';

export interface MaterialDoc {
  id: string;
  filePath: string;
  tags: string[];
  platform?: 'wechat' | 'xiaohongshu' | 'douyin';
  content: string; // first 200 chars
  embedding: number[];
  lastUpdated: string;
}

interface MaterialIndex {
  version: number;
  builtAt: string;
  docs: MaterialDoc[];
}

const INDEX_PATH = path.join(process.cwd(), 'output', 'corpus', 'material-embeddings.json');
const INDEX_VERSION = 1;

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter: Record<string, unknown> = {};
  const fmLines = match[1].split(/\r?\n/);
  let currentKey = '';
  let currentValue: string | string[] = '';

  for (const line of fmLines) {
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey) frontmatter[currentKey] = currentValue;
      currentKey = kvMatch[1];
      currentValue = kvMatch[2];
    } else if (line.match(/^\s+-\s+(.+)$/)) {
      const item = line.replace(/^\s+-\s+/, '');
      if (Array.isArray(currentValue)) currentValue.push(item);
      else currentValue = [currentValue, item];
    }
  }
  if (currentKey) frontmatter[currentKey] = currentValue;

  return { frontmatter, body: match[2] };
}

function scanCorpusDir(dir: string): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

export class ObsidianMaterialStore {
  private index: MaterialDoc[] = [];
  private indexLoaded = false;

  async loadIndex(): Promise<void> {
    if (this.indexLoaded) return;
    try {
      const content = await fs.readFile(INDEX_PATH, 'utf-8');
      const data = JSON.parse(content) as MaterialIndex;
      if (data.version !== INDEX_VERSION) {
        logger.warn('[ObsidianMaterialStore] index version mismatch, rebuilding...');
        return;
      }
      this.index = data.docs;
      this.indexLoaded = true;
      logger.info(`[ObsidianMaterialStore] loaded ${this.index.length} docs from index`);
    } catch {
      // File doesn't exist — will rebuild
      this.index = [];
      this.indexLoaded = true;
    }
  }

  async buildIndex(): Promise<number> {
    const corpusDir = path.join(process.cwd(), 'output', 'corpus');
    const dirs = [corpusDir, path.join(corpusDir, 'case-library'), path.join(corpusDir, 'insight-library'), path.join(corpusDir, 'atom-library')];

    const files: string[] = [];
    for (const dir of dirs) {
      files.push(...scanCorpusDir(dir));
    }

    const docs: MaterialDoc[] = [];
    const batchSize = 10;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, body } = parseFrontmatter(content);
            const id = String(frontmatter['id'] ?? path.basename(filePath, '.md'));
            const tags = Array.isArray(frontmatter['tags']) ? (frontmatter['tags'] as string[]) : [];
            const platform = frontmatter['platform'] as 'wechat' | 'xiaohongshu' | 'douyin' | undefined;
            const contentPreview = body.trim().slice(0, 200);
            let embedding: number[] = [];
            try {
              const result = await computeEmbedding({ text: contentPreview });
              embedding = result.embedding;
            } catch {
              // No embedding provider (network/API unavailable) — continue without vector
            }

            return {
              id,
              filePath,
              tags,
              platform,
              content: contentPreview,
              embedding,
              lastUpdated: String(frontmatter['createdAt'] ?? new Date().toISOString().slice(0, 10)),
            } satisfies MaterialDoc;
          } catch (err) {
            logger.warn(`[ObsidianMaterialStore] failed to index ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        })
      );

      for (const doc of results) {
        if (doc) docs.push(doc);
      }
    }

    this.index = docs;
    this.indexLoaded = true;

    const indexData: MaterialIndex = { version: INDEX_VERSION, builtAt: new Date().toISOString(), docs };
    await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
    await fs.writeFile(INDEX_PATH, JSON.stringify(indexData, null, 2), 'utf-8');
    logger.info(`[ObsidianMaterialStore] indexed ${docs.length} files`);

    return docs.length;
  }

  async search(query: string, topK = 3): Promise<Array<MaterialDoc & { similarity: number }>> {
    await this.loadIndex();
    if (this.index.length === 0) return [];

    const queryEmb = (await computeEmbedding({ text: query })).embedding;
    return this.index
      .map((doc) => ({ ...doc, similarity: cosineSimilarity(queryEmb, doc.embedding) }))
      .filter((d) => d.similarity > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async searchByTag(tag: string, topK = 3): Promise<MaterialDoc[]> {
    await this.loadIndex();
    return this.index.filter((d) => d.tags.includes(tag)).slice(0, topK);
  }
}
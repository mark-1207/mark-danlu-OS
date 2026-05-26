/**
 * Obsidian knowledge card — parsed from a markdown file with YAML frontmatter.
 */
export interface ObsidianCard {
  /** File path relative to vault root */
  path: string;
  /** Filename without extension */
  name: string;
  /** Frontmatter type: atom, case, insight, golden, etc. */
  type: string;
  /** Subtype: viewpoint, case, quote, principle, method, etc. */
  subtype?: string;
  /** Topic tags from frontmatter */
  topics: string[];
  /** Quality score (1-10) */
  qualityScore?: number;
  /** Raw frontmatter object */
  frontmatter: Record<string, unknown>;
  /** Body content (markdown without frontmatter) */
  body: string;
  /** Which subdirectory this came from (e.g. "原子库", "洞察库") */
  sourceDir: string;
}

/**
 * Query options for searching Obsidian knowledge base.
 */
export interface ObsidianQuery {
  /** Filter by frontmatter type (e.g. "atom", "insight") */
  types?: string[];
  /** Filter by topic tags (OR match — any tag matches) */
  topics?: string[];
  /** Filter by source directory name (e.g. "原子库", "金句库") */
  sourceDirs?: string[];
  /** Minimum quality score (inclusive) */
  minQuality?: number;
  /** Max number of results */
  limit?: number;
}

/**
 * Formatted material ready for prompt injection.
 */
export interface ObsidianMaterial {
  card: ObsidianCard;
  /** Relevance score 0-1 based on keyword/topic match */
  relevanceScore: number;
  /** Semantic similarity 0-1 from embedding (added by semanticSearch) */
  semanticScore?: number;
  /** Combined score if both keyword and semantic used */
  combinedScore?: number;
}

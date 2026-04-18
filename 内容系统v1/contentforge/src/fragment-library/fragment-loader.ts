import path from 'path';
import {
  type SentenceFragment,
  type ParagraphFragment,
} from './types.js';
import { getFragmentStore } from './fragment-store.js';

/**
 * Compute keyword overlap score between a fragment and a list of context keywords.
 * Returns a score 0-1 based on overlap ratio.
 */
function computeKeywordScore(
  fragmentTags: string[],
  fragmentStructure: string,
  narrativeStructure: string,
  keywords: string[],
): number {
  if (keywords.length === 0) return 0;

  // Combine all fragment text fields into a searchable string
  const fragmentText = [
    ...fragmentTags,
    fragmentStructure,
    narrativeStructure,
  ].join(' ').toLowerCase();

  // Count how many keywords appear in the fragment text
  let matchCount = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (fragmentText.includes(kwLower)) {
      matchCount++;
    }
  }

  // Score = match ratio normalized to 0-1
  // Cap denominator at 5 to avoid overly harsh penalties when many keywords
  return matchCount / Math.min(keywords.length, 5);
}

/**
 * FragmentLoader retrieves relevant fragments for a given platform + content context.
 * Used during prompt injection in recreate/create pipelines.
 *
 * Enhancement: keyword-based relevance scoring + weighted ordering.
 * When contextKeywords are provided, fragments are ranked by semantic overlap.
 * When contextKeywords are absent, falls back to type+platform filtering.
 *
 * After fragments are selected for injection, call markUsed() to update decay tracking.
 */
export class FragmentLoader {
  constructor(private corpusDir: string) {}

  /**
   * Mark fragments as used (update useCount + lastUsedAt for decay tracking).
   * Called by new-outline after fragments are injected into prompt.
   */
  markUsed(fragments: Array<{ id: string }>): void {
    const store = getFragmentStore(this.corpusDir);
    store.ensureLoaded().catch(() => {});
    for (const f of fragments) {
      store.markFragmentUsed(f.id);
    }
  }

  /**
   * Get sentence fragments for injection, optionally ranked by keyword relevance.
   * @param types Which types to include (default: all)
   * @param platform Target platform (default: universal)
   * @param limit Max fragments total to return (default: 5)
   * @param contextKeywords Keywords extracted from viralGenome / original article
   */
  getSentenceFragments(
    types?: SentenceFragment['type'][],
    platform: SentenceFragment['platform'] = 'universal',
    limit = 5,
    contextKeywords?: string[],
  ): SentenceFragment[] {
    const store = getFragmentStore(this.corpusDir);
    store.ensureLoaded().catch(() => {}); // fire-and-forget; returns empty if not ready
    const all = store.getAllSentences();

    const filtered = all.filter(f => {
      if (types && types.length > 0 && !types.includes(f.type)) return false;
      if (f.platform !== 'universal' && f.platform !== platform) return false;
      return true;
    });

    // Score and sort by keyword relevance
    if (contextKeywords && contextKeywords.length > 0) {
      const scored = filtered.map(f => ({
        fragment: f,
        score: computeKeywordScore(f.tags, f.structure, '', contextKeywords),
      }));

      // Sort by score descending, then by source (edited first)
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.fragment.source === 'edited' ? -1 : 1;
      });

      // De-duplicate by type: keep highest-scoring per type
      const seen = new Set<SentenceFragment['type']>();
      const result: SentenceFragment[] = [];
      for (const { fragment, score } of scored) {
        if (!seen.has(fragment.type)) {
          seen.add(fragment.type);
          result.push({ ...fragment, relevanceScore: score });
          if (result.length >= limit) break;
        }
      }
      return result;
    }

    // Fallback: type + platform filter, no keyword ranking
    const byType = new Map<SentenceFragment['type'], SentenceFragment[]>();
    for (const f of filtered) {
      if (!byType.has(f.type)) byType.set(f.type, []);
      if (byType.get(f.type)!.length < limit) byType.get(f.type)!.push(f);
    }
    return Array.from(byType.values()).flat().slice(0, limit);
  }

  /**
   * Get paragraph fragments for injection, optionally ranked by keyword relevance.
   * @param types Which types to include (default: all)
   * @param platform Target platform (default: universal)
   * @param limit Max fragments total to return (default: 3)
   * @param contextKeywords Keywords extracted from viralGenome / original article
   */
  getParagraphFragments(
    types?: ParagraphFragment['type'][],
    platform: ParagraphFragment['platform'] = 'universal',
    limit = 3,
    contextKeywords?: string[],
  ): ParagraphFragment[] {
    const store = getFragmentStore(this.corpusDir);
    store.ensureLoaded().catch(() => {}); // fire-and-forget
    const all = store.getAllParagraphs();

    const filtered = all.filter(f => {
      if (types && types.length > 0 && !types.includes(f.type)) return false;
      if (f.platform !== 'universal' && f.platform !== platform) return false;
      return true;
    });

    if (contextKeywords && contextKeywords.length > 0) {
      const scored = filtered.map(f => ({
        fragment: f,
        score: computeKeywordScore(f.tags, f.narrativeStructure, f.emotionalArc, contextKeywords),
      }));

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.fragment.source === 'edited' ? -1 : 1;
      });

      const seen = new Set<ParagraphFragment['type']>();
      const result: ParagraphFragment[] = [];
      for (const { fragment, score } of scored) {
        if (!seen.has(fragment.type)) {
          seen.add(fragment.type);
          result.push({ ...fragment, relevanceScore: score });
          if (result.length >= limit) break;
        }
      }
      return result;
    }

    // Fallback: type + platform filter
    const byType = new Map<ParagraphFragment['type'], ParagraphFragment[]>();
    for (const f of filtered) {
      if (!byType.has(f.type)) byType.set(f.type, []);
      if (byType.get(f.type)!.length < limit) byType.get(f.type)!.push(f);
    }
    return Array.from(byType.values()).flat().slice(0, limit);
  }

  /**
   * Format fragments for prompt injection.
   */
  formatForPrompt(
    sentences: SentenceFragment[],
    paragraphs: ParagraphFragment[],
  ): string {
    const parts: string[] = [];

    if (sentences.length > 0) {
      parts.push('## 句式碎片（可参考）');
      for (const s of sentences) {
        const tag = s.source === 'edited' ? '[我的改写偏好]' : '[外部参考]';
        const scoreTag = s.relevanceScore !== undefined ? ` [相关度:${s.relevanceScore.toFixed(2)}]` : '';
        parts.push(`- ${tag} ${s.type}: "${s.text}" (${s.structure})${scoreTag}`);
      }
    }

    if (paragraphs.length > 0) {
      parts.push('\n## 段落结构碎片（可参考）');
      for (const p of paragraphs) {
        const tag = p.source === 'edited' ? '[我的改写偏好]' : '[外部参考]';
        const scoreTag = p.relevanceScore !== undefined ? ` [相关度:${p.relevanceScore.toFixed(2)}]` : '';
        parts.push(`- ${tag} ${p.type}: "${p.content.slice(0, 80)}..."${scoreTag}`);
        parts.push(`  结构: ${p.narrativeStructure} | 情绪: ${p.emotionalArc}`);
      }
    }

    return parts.join('\n');
  }
}

const loaders = new Map<string, FragmentLoader>();

export function getFragmentLoader(corpusDir: string): FragmentLoader {
  const resolved = path.resolve(corpusDir);
  if (!loaders.has(resolved)) {
    loaders.set(resolved, new FragmentLoader(resolved));
  }
  return loaders.get(resolved)!;
}

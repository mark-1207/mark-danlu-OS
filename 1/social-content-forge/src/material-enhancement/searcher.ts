import * as fs from 'fs';
import * as path from 'path';
import { StyleExample } from '../../types';

const STYLE_LIBRARY_PATH = 'docs/style-library';

/**
 * Search for related content in the style library
 */
export class StyleLibrarySearcher {
  constructor(private projectRoot: string) {}

  /**
   * Search for content related to a query
   */
  search(query: string, maxResults: number = 3): StyleExample[] {
    const results: StyleExample[] = [];
    const goodDir = path.join(this.projectRoot, STYLE_LIBRARY_PATH, 'good');

    if (!fs.existsSync(goodDir)) {
      return results;
    }

    const files = fs.readdirSync(goodDir).filter(f => f.endsWith('.md'));
    const queryLower = query.toLowerCase();

    for (const file of files) {
      const content = fs.readFileSync(path.join(goodDir, file), 'utf-8');
      const contentLower = content.toLowerCase();

      // Simple relevance scoring
      const queryWords = queryLower.split(/[\s,，、]+/).filter(w => w.length > 1);
      let score = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += word.length;
        }
      }

      if (score > 0) {
        results.push({
          type: 'good',
          content: this.extractRelevantSnippet(content, queryLower),
          whatWorks: `Related to "${query}" (relevance score: ${score})`,
        });
      }

      if (results.length >= maxResults) break;
    }

    // Sort by relevance score
    return results.sort((a, b) => {
      const scoreA = (a.whatWorks?.match(/\d+/) || ['0'])[0];
      const scoreB = (b.whatWorks?.match(/\d+/) || ['0'])[0];
      return parseInt(scoreB) - parseInt(scoreA);
    });
  }

  /**
   * Extract a relevant snippet from content
   */
  private extractRelevantSnippet(content: string, query: string): string {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const queryWords = query.split(/[\s,，、]+/).filter(w => w.length > 1);

    // Find lines that mention query words
    const relevantLines = lines.filter(line => {
      const lineLower = line.toLowerCase();
      return queryWords.some(w => lineLower.includes(w));
    });

    if (relevantLines.length > 0) {
      // Return first relevant line(s) up to ~200 chars
      const snippet = relevantLines.slice(0, 3).join(' ');
      return snippet.length > 200 ? snippet.substring(0, 200) + '...' : snippet;
    }

    // Fallback: return first non-empty line
    return lines[0]?.substring(0, 200) || '';
  }
}
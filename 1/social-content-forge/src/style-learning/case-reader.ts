import * as fs from 'fs';
import * as path from 'path';

const STYLE_LIBRARY_PATH = 'docs/style-library';

export class CaseReader {
  constructor(private projectRoot: string) {}

  /**
   * Read all case files from the style library
   */
  readAllCases(): CaseFile[] {
    const cases: CaseFile[] = [];

    // Read good cases
    const goodDir = path.join(this.projectRoot, STYLE_LIBRARY_PATH, 'good');
    if (fs.existsSync(goodDir)) {
      const goodFiles = fs.readdirSync(goodDir).filter(f => f.endsWith('.md'));
      for (const file of goodFiles) {
        const caseFile = this.readCaseFile(path.join(goodDir, file), 'good');
        if (caseFile) cases.push(caseFile);
      }
    }

    // Read bad cases
    const badDir = path.join(this.projectRoot, STYLE_LIBRARY_PATH, 'bad');
    if (fs.existsSync(badDir)) {
      const badFiles = fs.readdirSync(badDir).filter(f => f.endsWith('.md'));
      for (const file of badFiles) {
        const caseFile = this.readCaseFile(path.join(badDir, file), 'bad');
        if (caseFile) cases.push(caseFile);
      }
    }

    return cases;
  }

  /**
   * Read a single case file
   */
  readCaseFile(filePath: string, type: 'good' | 'bad'): CaseFile | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath);

      // Extract frontmatter
      const frontmatter = this.parseFrontmatter(content);
      const bodyContent = this.extractBody(content);

      return {
        path: filePath,
        filename,
        type,
        content: bodyContent,
        addedAt: frontmatter.addedAt || new Date().toISOString().split('T')[0],
        tags: frontmatter.tags || [],
      };
    } catch (error) {
      console.error(`Failed to read case file: ${filePath}`, error);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter
   */
  private parseFrontmatter(content: string): { addedAt?: string; tags?: string[] } {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontmatter = match[1];
    const result: { addedAt?: string; tags?: string[] } = {};

    const addedAtMatch = frontmatter.match(/addedAt:\s*"?([^"\n]+)"?/);
    if (addedAtMatch) result.addedAt = addedAtMatch[1].trim();

    const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      result.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
    }

    return result;
  }

  /**
   * Extract body content (without frontmatter)
   */
  private extractBody(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  }

  /**
   * Get cases added after a certain date
   */
  getCasesAfter(date: string): CaseFile[] {
    const allCases = this.readAllCases();
    return allCases.filter(c => c.addedAt > date);
  }

  /**
   * Get the latest case file
   */
  getLatestCase(): CaseFile | null {
    const cases = this.readAllCases();
    if (cases.length === 0) return null;
    return cases.sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];
  }
}
import { CaseReader } from './case-reader';
import { InsightGenerator } from './insight-generator';
import { LibraryIndexer } from './library-indexer';
import { StyleLearningChecker, StartupCheckResult } from './checker';
import { LearnedInsight, CaseFile } from './types';
import { LLMCall } from '../../types';

export { CaseReader } from './case-reader';
export { InsightGenerator } from './insight-generator';
export { LibraryIndexer } from './library-indexer';
export { StyleLearningChecker } from './checker';
export type { CaseFile, LearnedInsight, LibraryIndex } from './types';

export class StyleLearningService {
  constructor(
    private projectRoot: string,
    private llmCall: LLMCall
  ) {}

  /**
   * Create a checker for startup use
   */
  createChecker(): StyleLearningChecker {
    return new StyleLearningChecker(this.projectRoot, this.llmCall);
  }

  /**
   * Read all cases from the library
   */
  readAllCases(): CaseFile[] {
    const reader = new CaseReader(this.projectRoot);
    return reader.readAllCases();
  }

  /**
   * Generate insights from cases
   */
  async generateInsights(cases: CaseFile[]): Promise<LearnedInsight[]> {
    const generator = new InsightGenerator(this.llmCall);
    return generator.generateInsights(cases);
  }

  /**
   * Update content quality standards with insights
   */
  updateQualityStandards(insights: LearnedInsight[]): void {
    const contentQualityPath = `${this.projectRoot}/docs/memory/content-quality.md`;

    // Read existing file
    let existing = '';
    try {
      const fs = require('fs');
      if (fs.existsSync(contentQualityPath)) {
        existing = fs.readFileSync(contentQualityPath, 'utf-8');
      }
    } catch (e) {
      // File doesn't exist, start fresh
    }

    // Append new insights
    let newContent = existing;
    newContent += '\n\n---\n\n## 学习洞察更新\n\n';
    newContent += `更新时间：${new Date().toISOString().split('T')[0]}\n\n`;

    for (const insight of insights) {
      const typeLabel = insight.type === 'good' ? '✅ 爆款' : '❌ 差案例';
      newContent += `### ${typeLabel}: ${insight.sourceFile}\n`;
      newContent += `${insight.insight}\n\n`;
    }

    // Write back
    try {
      const fs = require('fs');
      fs.writeFileSync(contentQualityPath, newContent, 'utf-8');
    } catch (e) {
      console.error('Failed to update quality standards:', e);
    }
  }
}

/**
 * Check for new style library cases (standalone function for memory module)
 */
export function checkForNewStyleCases(projectRoot: string): string[] {
  try {
    const reader = new CaseReader(projectRoot);
    const indexer = new LibraryIndexer(projectRoot);
    const lastChecked = indexer.getLastCheckedFile();
    const allCases = reader.readAllCases();

    if (lastChecked === '') {
      // First run, return all cases
      return allCases.map(c => c.filename);
    }

    return allCases
      .filter(c => c.filename !== lastChecked)
      .map(c => c.filename);
  } catch (e) {
    return [];
  }
}
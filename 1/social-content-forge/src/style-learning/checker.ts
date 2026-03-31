import * as fs from 'fs';
import * as path from 'path';
import { StyleLearningService } from './index';
import { CaseReader } from './case-reader';
import { InsightGenerator } from './insight-generator';
import { LibraryIndexer } from './library-indexer';
import { LearnedInsight, CaseFile } from './types';
import { LLMCall } from '../../types';

export interface StartupCheckResult {
  hasNewCases: boolean;
  newCases: CaseFile[];
  newInsights: LearnedInsight[];
}

export class StyleLearningChecker {
  constructor(
    private projectRoot: string,
    private llmCall: LLMCall
  ) {
    this.reader = new CaseReader(projectRoot);
    this.generator = new InsightGenerator(llmCall);
    this.indexer = new LibraryIndexer(projectRoot);
  }

  private reader: CaseReader;
  private generator: InsightGenerator;
  private indexer: LibraryIndexer;

  /**
   * Check for new cases on startup
   */
  async checkForNewCases(): Promise<StartupCheckResult> {
    const lastChecked = this.indexer.getLastCheckedFile();
    const latestCase = this.reader.getLatestCase();

    if (!latestCase) {
      return { hasNewCases: false, newCases: [], newInsights: [] };
    }

    // If there's a newer case than last checked
    if (latestCase.filename !== lastChecked) {
      const allCases = this.reader.readAllCases();
      const newCases = allCases.filter(c => {
        if (c.filename === lastChecked) return false;
        if (lastChecked === '') return true; // First check
        return c.addedAt > this.getCaseAddedAt(lastChecked);
      });

      if (newCases.length > 0) {
        const insights = await this.generator.generateInsights(newCases);

        // Update last checked
        this.indexer.setLastCheckedFile(latestCase.filename);

        return {
          hasNewCases: true,
          newCases,
          newInsights: insights,
        };
      }
    }

    return { hasNewCases: false, newCases: [], newInsights: [] };
  }

  /**
   * Get addedAt date for a case file
   */
  private getCaseAddedAt(filename: string): string {
    const allCases = this.reader.readAllCases();
    const found = allCases.find(c => c.filename === filename);
    return found?.addedAt || '1970-01-01';
  }

  /**
   * Format insights for user confirmation
   */
  formatInsightsForConfirmation(insights: LearnedInsight[]): string {
    if (insights.length === 0) return '';

    let report = '## 检测到新案例，学习洞察如下：\n\n';

    for (const insight of insights) {
      const typeLabel = insight.type === 'good' ? '✅ 爆款' : '❌ 差案例';
      report += `### ${typeLabel}: ${insight.sourceFile}\n`;
      report += `**洞察：** ${insight.insight}\n`;
      report += `**适用维度：** ${insight.applicableDimensions.join('、')}\n`;

      if (insight.extractedQuotes && insight.extractedQuotes.length > 0) {
        report += `\n**提取金句：**\n`;
        for (const quote of insight.extractedQuotes) {
          report += `- ${quote}\n`;
        }
      }

      if (insight.extractedCases && insight.extractedCases.length > 0) {
        report += `\n**提取案例：**\n`;
        for (const c of insight.extractedCases) {
          report += `- ${c}\n`;
        }
      }

      report += '\n---\n\n';
    }

    report += '是否将以上洞察更新到内容质量标准？';

    return report;
  }
}
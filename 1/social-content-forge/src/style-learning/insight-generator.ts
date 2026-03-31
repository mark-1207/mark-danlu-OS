import { CaseFile, LearnedInsight } from './types';
import { LLMCall } from '../../types';

export interface InsightGeneratorConfig {
  maxQuotesPerCase: number;
  maxCasesPerInsight: number;
}

export class InsightGenerator {
  constructor(
    private llmCall: LLMCall,
    config?: Partial<InsightGeneratorConfig>
  ) {
    this.maxQuotesPerCase = config?.maxQuotesPerCase || 3;
    this.maxCasesPerInsight = config?.maxCasesPerInsight || 5;
  }

  private maxQuotesPerCase: number;
  private maxCasesPerInsight: number;

  /**
   * Generate insight from a single case
   */
  async generateInsight(caseFile: CaseFile): Promise<LearnedInsight> {
    const typeLabel = caseFile.type === 'good' ? '爆款' : '差案例';

    const prompt = `【风格学习分析】
分析以下${typeLabel}，提取可复用的写作手法：

文件：${caseFile.filename}
标签：${caseFile.tags.join('、')}

内容：
${caseFile.content.substring(0, 2000)}${caseFile.content.length > 2000 ? '...(截断)' : ''}

请分析并返回JSON格式：
{
  "insight": "这个${typeLabel}好在/差在哪...（一句话总结核心洞察）",
  "applicableDimensions": ["叙事结构", "情绪激发度", ...],  // 适用于哪些质量维度
  "extractedQuotes": ["可复用的金句1", "可复用的金句2"],  // 提取的高光片段
  "extractedCases": ["可复用的案例1", "可复用的案例2"]  // 提取的案例
}`;

    try {
      const response = await this.llmCall('claude', prompt);
      const parsed = this.parseInsight(response);

      return {
        id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceFile: caseFile.filename,
        type: caseFile.type,
        insight: parsed.insight,
        applicableDimensions: parsed.dimensions,
        extractedQuotes: parsed.quotes.slice(0, this.maxQuotesPerCase),
        extractedCases: parsed.cases.slice(0, this.maxCasesPerInsight),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to generate insight:', error);
      return {
        id: `insight-${Date.now()}`,
        sourceFile: caseFile.filename,
        type: caseFile.type,
        insight: '分析失败',
        applicableDimensions: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate insights from multiple cases
   */
  async generateInsights(cases: CaseFile[]): Promise<LearnedInsight[]> {
    const insights: LearnedInsight[] = [];

    for (const c of cases) {
      const insight = await this.generateInsight(c);
      insights.push(insight);
    }

    return insights;
  }

  /**
   * Parse LLM response into insight
   */
  private parseInsight(response: string): { insight: string; dimensions: string[]; quotes: string[]; cases: string[] } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insight: parsed.insight || '无洞察',
          dimensions: parsed.applicableDimensions || [],
          quotes: parsed.extractedQuotes || [],
          cases: parsed.extractedCases || [],
        };
      }
    } catch (e) {
      // Fall through
    }

    // Fallback parsing
    return {
      insight: this.extractInsightFallback(response),
      dimensions: [],
      quotes: [],
      cases: [],
    };
  }

  /**
   * Fallback extraction if JSON parsing fails
   */
  private extractInsightFallback(response: string): string {
    const lines = response.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      if (line.includes('洞察') || line.includes('好在') || line.includes('差在')) {
        return line.replace(/^[^']*/, '').trim();
      }
    }
    return lines[0] || '无洞察';
  }
}
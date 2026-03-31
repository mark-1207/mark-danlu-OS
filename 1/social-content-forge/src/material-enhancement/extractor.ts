import { MaterialPackage, StyleExample } from '../../types';

/**
 * Extract viral elements from content
 */
export class MaterialExtractor {
  /**
   * Extract viral quotes, case studies, and counter-arguments from content
   */
  extract(content: string): MaterialPackage {
    return {
      viralQuotes: this.extractViralQuotes(content),
      caseStudies: this.extractCaseStudies(content),
      counterArguments: this.extractCounterArguments(content),
    };
  }

  /**
   * Extract short, punchy quotes that could be shared
   */
  private extractViralQuotes(content: string): string[] {
    const quotes: string[] = [];

    // Pattern 1: Quoted text
    const quoteMatches = content.match(/"([^"]{5,50})"/g);
    if (quoteMatches) {
      quotes.push(...quoteMatches.map(q => q.replace(/"/g, '')));
    }

    // Pattern 2: Bold/highlighted key points
    const boldMatches = content.match(/\*\*([^*]{5,50})\*\*/g);
    if (boldMatches) {
      quotes.push(...boldMatches.map(b => b.replace(/\*\*/g, '')));
    }

    // Pattern 3: Short declarative sentences (key insights)
    const sentences = content.split(/[.!?。]/).filter(s => s.trim().length >= 5 && s.trim().length < 100);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Check if it looks like a key insight (contains actionable or provocative words)
      if (this.looksLikeViralQuote(trimmed)) {
        quotes.push(trimmed);
      }
    }

    // Deduplicate and limit
    return [...new Set(quotes)].slice(0, 5);
  }

  /**
   * Extract case studies, examples, and data points
   */
  private extractCaseStudies(content: string): string[] {
    const cases: string[] = [];

    // Pattern 1: "像X一样" or "如X一样" examples - allow 0-8 Chinese chars before the comparison word
    const examplePatterns = [
      /([\u4e00-\u9fa5]{0,8}(?:像|如|类似|跟)[^,，。！]{5,30})/g,
      /((?:冯小刚|贝索斯|张一鸣|亚马逊|苹果|谷歌|特斯拉)[^,，。！]{5,50})/g,
    ];

    for (const pattern of examplePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        cases.push(...matches);
      }
    }

    // Pattern 2: Data points (numbers with context)
    const dataPattern = /([\u4e00-\u9fa5]{0,10}\d+[\u4e00-\u9fa5]*[^,，。！]{5,30})/g;
    const dataMatches = content.match(dataPattern);
    if (dataMatches) {
      cases.push(...dataMatches.filter(d => d.length > 15));
    }

    return [...new Set(cases)].slice(0, 3);
  }

  /**
   * Extract counter-intuitive or controversial points
   */
  private extractCounterArguments(content: string): string[] {
    const counters: string[] = [];

    // Pattern 1: "不是...而是..." construction - use non-greedy to handle comma between parts
    const notButPattern = /不是(.+?)而是(.+?)。/g;
    const notButMatches = content.match(notButPattern);
    if (notButMatches) {
      for (const match of notButMatches) {
        // Remove trailing comma from first group if present
        const cleaned = match.replace(/，$/, '');
        counters.push(cleaned);
      }
    }

    // Pattern 2: "很多人认为X，但其实Y" construction
    const butActuallyPattern = /认为(.+?)但(其实|实际上|实际上)(.+?)。/g;
    const butActuallyMatches = content.match(butActuallyPattern);
    if (butActuallyMatches) {
      for (const match of butActuallyMatches) {
        counters.push(match);
      }
    }

    return [...new Set(counters)].slice(0, 3);
  }

  /**
   * Check if a sentence looks like a viral quote
   */
  private looksLikeViralQuote(sentence: string): boolean {
    const viralKeywords = [
      '赚钱', '认知', '思维', '成长', '突破', '真相', '秘密',
      '核心', '关键', '本质', '定律', '法则', '秘密',
      '不是因为', '而是', '其实', '只有', '必须', '最重要',
    ];
    const lowerSentence = sentence.toLowerCase();
    return viralKeywords.some(k => lowerSentence.includes(k));
  }
}
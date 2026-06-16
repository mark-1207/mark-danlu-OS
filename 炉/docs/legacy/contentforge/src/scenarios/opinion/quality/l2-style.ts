/**
 * L2 风格检查器（卡兹克质检）
 * 检查文章是否具有"活人感"——具体场景、节奏、口语化、断裂感。
 */

export interface L2Flag {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface L2CheckResult {
  flags: L2Flag[];
  score: number; // 0-100, higher = better
  rhythmAnalysis: {
    shortSentences: number;  // < 15字
    longSentences: number;   // > 50字
    avgSentenceLength: number;
  };
}

// 教科书式开头
const TEXTBOOK_OPENING_PATTERNS = [
  /^在当今.*的时代/,
  /^随着.*的发展/,
  /^众所周知/,
  /^不可否认/,
];

// LLM 标志性套话
const LLM_PUNCTUATION_PATTERNS = [
  /首先.*?其次.*?最后/,
  /让我们来/,
  /接下来让我们/,
  /综上所述/,
];

export class L2StyleChecker {
  /**
   * Check article style and return flags + score.
   */
  check(text: string): L2CheckResult {
    const flags: L2Flag[] = [];

    // Check textbook opening
    for (const pattern of TEXTBOOK_OPENING_PATTERNS) {
      if (pattern.test(text)) {
        flags.push({
          code: 'textbook_opening',
          message: '开头过于教科书化，缺少具体场景感',
          severity: 'high',
        });
        break;
      }
    }

    // Check LLM punctuation patterns
    for (const pattern of LLM_PUNCTUATION_PATTERNS) {
      if (pattern.test(text)) {
        flags.push({
          code: 'llm_punctuation',
          message: '检测到LLM标志性套话',
          severity: 'high',
        });
        break;
      }
    }

    // Rhythm analysis
    const rhythmAnalysis = this.analyzeRhythm(text);
    if (rhythmAnalysis.avgSentenceLength > 60) {
      flags.push({
        code: 'rhythm_flat',
        message: `平均句长${rhythmAnalysis.avgSentenceLength}字，节奏呆板，建议长短句交替`,
        severity: 'medium',
      });
    }
    if (rhythmAnalysis.shortSentences === 0 && text.length > 1000) {
      flags.push({
        code: 'no_break',
        message: '没有短句独立成段，缺少节奏断裂感',
        severity: 'medium',
      });
    }

    // HKR match check
    const hasHook = /故事是这样的|事情是这样的|那天|上周|我朋友|听说/.test(text);
    if (!hasHook && text.length > 800) {
      flags.push({
        code: 'hkr_match',
        message: '缺少具体场景钩子（叙事/荒诞事实/热点破题）',
        severity: 'high',
      });
    }

    // Score: 100 - (sum of severity weights)
    const scoreDeductions: Record<L2Flag['severity'], number> = {
      high: 25,
      medium: 12,
      low: 5,
    };
    let score = 100;
    for (const flag of flags) {
      score -= scoreDeductions[flag.severity];
    }
    score = Math.max(0, score);

    return { flags, score, rhythmAnalysis };
  }

  private analyzeRhythm(text: string): L2CheckResult['rhythmAnalysis'] {
    // Split by Chinese sentence endings
    const sentences = text.split(/[。！？\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    const shortSentences = sentences.filter(s => s.length < 15).length;
    const longSentences = sentences.filter(s => s.length > 50).length;
    const totalLength = sentences.reduce((sum, s) => sum + s.length, 0);
    const avgSentenceLength = sentences.length > 0 ? Math.round(totalLength / sentences.length) : 0;

    return { shortSentences, longSentences, avgSentenceLength };
  }
}

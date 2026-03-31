import { NineDimensionScores, PlatformContent } from '../types';

export interface QualityGateResult {
  passed: boolean;
  score: number;
  hasVeto: boolean;
  vetoDimensions: string[];
  suggestions: string[];
}

export class QualityGate {
  private readonly WEIGHTS = {
    emotion: 0.20,
    utility: 0.20,
    narrative: 0.15,
    socialCurrency: 0.10,
    controversy: 0.10,
    timeliness: 0.05,
    differentiation: 0.10,
    shareability: 0.05,
    conversionPotential: 0.05,
  };

  private readonly PASSING_SCORE = 85;
  private readonly VETO_THRESHOLD = 5;

  /**
   * Evaluate content against quality gate
   */
  evaluate(
    scores: NineDimensionScores,
    platform: PlatformContent['platform']
  ): QualityGateResult {
    const hasVeto = this.checkVeto(scores);
    const score = this.calculateWeightedScore(scores);
    const suggestions = this.generateSuggestions(scores, platform);

    return {
      passed: !hasVeto && score >= this.PASSING_SCORE,
      score,
      hasVeto,
      vetoDimensions: hasVeto ? this.getVetoDimensions(scores) : [],
      suggestions,
    };
  }

  /**
   * Check if any dimension is below veto threshold
   */
  private checkVeto(scores: NineDimensionScores): boolean {
    return Object.values(scores).some(score => score < this.VETO_THRESHOLD);
  }

  /**
   * Get list of dimensions that vetoed
   */
  private getVetoDimensions(scores: NineDimensionScores): string[] {
    const dimensions: string[] = [];
    for (const [dim, score] of Object.entries(scores)) {
      if (score < this.VETO_THRESHOLD) {
        dimensions.push(dim);
      }
    }
    return dimensions;
  }

  /**
   * Calculate weighted total score
   */
  private calculateWeightedScore(scores: NineDimensionScores): number {
    let total = 0;
    for (const [dim, score] of Object.entries(scores)) {
      const weight = this.WEIGHTS[dim as keyof typeof this.WEIGHTS];
      if (weight !== undefined) {
        total += score * weight * 10; // Convert to 0-100 scale
      }
    }
    return Math.round(total);
  }

  /**
   * Generate improvement suggestions based on scores
   */
  private generateSuggestions(scores: NineDimensionScores, platform: PlatformContent['platform']): string[] {
    const suggestions: string[] = [];

    if (scores.emotion < 7) {
      suggestions.push('增加情绪触发点，用个人故事或共鸣场景开头');
    }
    if (scores.utility < 7) {
      suggestions.push('增加实用价值，给出具体的可执行步骤');
    }
    if (scores.narrative < 7) {
      suggestions.push('改善叙事结构，增加开头钩子和故事元素');
    }
    if (scores.socialCurrency < 6) {
      suggestions.push('增加社交货币，让读者觉得转发能彰显身份');
    }
    if (scores.controversy < 6) {
      suggestions.push('适度增加争议性观点，引发讨论');
    }
    if (scores.differentiation < 6) {
      suggestions.push('增加差异化视角，避免老生常谈');
    }
    if (scores.shareability < 6) {
      suggestions.push('增加可转发的金句或场景');
    }
    if (scores.conversionPotential < 6) {
      suggestions.push('增加明确的行动号召或互动引导');
    }

    // Platform-specific suggestions
    if (platform === 'wechat' && scores.narrative < 7) {
      suggestions.push('微信公众号需要更长的故事弧线，增加案例深度');
    }
    if (platform === 'xiaohongshu' && scores.emotion < 7) {
      suggestions.push('小红书需要更强的情绪共鸣，增加个人体验感');
    }
    if (platform === 'twitter' && scores.utility < 6) {
      suggestions.push('Twitter需要在有限的字数内给出最大价值');
    }

    return suggestions;
  }
}

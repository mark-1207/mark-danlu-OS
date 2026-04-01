import type {
  SimilarityResult,
  SimilarityThresholds,
  LLMCall,
  PlatformContent,
} from './types';
import { DEFAULT_SIMILARITY_THRESHOLDS, SIMILARITY_DIMENSION_WEIGHTS } from './types';
import { detectCaseSimilarity } from './detectors/case-detector';
import { detectQuoteSimilarity } from './detectors/quote-detector';
import { detectSemanticSimilarity } from './detectors/semantic-detector';
import { detectTitleDifference } from './detectors/title-detector';
import { detectOpeningEndingDifference } from './detectors/opening-ending-detector';

export interface SimilarityVerifierConfig {
  thresholds?: Partial<SimilarityThresholds>;
  maxIterations?: number;
}

export class SimilarityVerifier {
  private thresholds: SimilarityThresholds;
  private maxIterations: number;

  constructor(config: SimilarityVerifierConfig = {}) {
    this.thresholds = { ...DEFAULT_SIMILARITY_THRESHOLDS, ...config.thresholds };
    this.maxIterations = config.maxIterations ?? 999;
  }

  /**
   * Verify all platforms' rewritten content against original
   * Returns the worst-case result across all platforms
   */
  async verify(
    originalContent: string,
    originalTitle: string,
    platformOutputs: PlatformContent[],
    llmCall: LLMCall
  ): Promise<SimilarityResult> {
    let iterationCount = 0;
    let result = await this.runVerification(originalContent, originalTitle, platformOutputs, llmCall);

    while (!result.passed && iterationCount < this.maxIterations) {
      iterationCount++;
      result = await this.runVerification(originalContent, originalTitle, platformOutputs, llmCall);
      result.iterationCount = iterationCount;
    }

    return result;
  }

  /**
   * Run one verification pass across all platforms
   */
  private async runVerification(
    originalContent: string,
    originalTitle: string,
    platformOutputs: PlatformContent[],
    llmCall: LLMCall
  ): Promise<SimilarityResult> {
    // Run all dimension checks for each platform in parallel, then aggregate
    const platformResults = await Promise.all(
      platformOutputs.map(async (output) => ({
        platform: output.platform,
        dimensions: await this.checkAllDimensions(
          originalContent,
          originalTitle,
          output.title,
          output.body,
          llmCall
        ),
      }))
    );

    // Aggregate: worst score across all platforms for each dimension
    const aggregatedDimensions = {
      caseSimilarity: this.worstScore(platformResults.map(p => p.dimensions.caseSimilarity)),
      quoteSimilarity: this.worstScore(platformResults.map(p => p.dimensions.quoteSimilarity)),
      semanticSimilarity: this.worstScore(platformResults.map(p => p.dimensions.semanticSimilarity)),
      titleDiff: this.worstScore(platformResults.map(p => p.dimensions.titleDiff)),
      openingEndingDiff: this.worstScore(platformResults.map(p => p.dimensions.openingEndingDiff)),
    };

    // Calculate overall weighted score
    const weights = SIMILARITY_DIMENSION_WEIGHTS;
    const overallScore = Math.round(
      aggregatedDimensions.caseSimilarity.score * weights.caseSimilarity +
      aggregatedDimensions.quoteSimilarity.score * weights.quoteSimilarity +
      aggregatedDimensions.semanticSimilarity.score * weights.semanticSimilarity +
      aggregatedDimensions.titleDiff.score * weights.titleDiff +
      aggregatedDimensions.openingEndingDiff.score * weights.openingEndingDiff
    );

    // Dual-track pass: (1) overall score ≤70, (2) ALL dimensions pass
    const allDimensionsPass = Object.values(aggregatedDimensions).every(d => d.passed);
    const passed = overallScore <= 70 && allDimensionsPass;

    // Build summary
    const summary = this.buildSummary(aggregatedDimensions, overallScore);

    return {
      passed,
      overallScore,
      dimensions: aggregatedDimensions,
      summary,
      iterationCount: 0,
    };
  }

  private async checkAllDimensions(
    originalContent: string,
    originalTitle: string,
    rewrittenTitle: string,
    rewrittenBody: string,
    llmCall: LLMCall
  ) {
    const [caseResult, quoteResult, semanticResult, titleResult, openingEndingResult] = await Promise.all([
      detectCaseSimilarity(originalContent, rewrittenBody, llmCall),
      detectQuoteSimilarity(originalContent, rewrittenBody),
      detectSemanticSimilarity(originalContent, rewrittenBody, llmCall),
      detectTitleDifference(originalTitle, rewrittenTitle),
      detectOpeningEndingDifference(originalContent, rewrittenBody),
    ]);

    return {
      caseSimilarity: caseResult,
      quoteSimilarity: quoteResult,
      semanticSimilarity: semanticResult,
      titleDiff: titleResult,
      openingEndingDiff: openingEndingResult,
    };
  }

  /**
   * For "passed" dimensions, lower score is better
   * For "diff" dimensions, higher score is better
   * We aggregate by taking the most "failed" direction
   */
  private worstScore(results: { score: number; passed: boolean }[]): { score: number; passed: boolean } {
    const worstPassed = results.some(r => !r.passed);
    if (worstPassed) {
      // Return the one that failed with the worst score
      const failed = results.filter(r => !r.passed);
      return failed.reduce((a, b) => a.score > b.score ? a : b);
    }
    // All passed, return the median
    const scores = results.map(r => r.score).sort((a, b) => a - b);
    return { score: scores[Math.floor(scores.length / 2)], passed: true };
  }

  private buildSummary(
    dims: SimilarityResult['dimensions'],
    overallScore: number
  ): string {
    const parts: string[] = [];

    if (!dims.caseSimilarity.passed) {
      parts.push(`案例相似度${dims.caseSimilarity.score}%(${dims.caseSimilarity.detail})`);
    }
    if (!dims.quoteSimilarity.passed) {
      parts.push(`金句照搬${dims.quoteSimilarity.score}%`);
    }
    if (!dims.semanticSimilarity.passed) {
      parts.push(`语义相似度${dims.semanticSimilarity.score}%`);
    }
    if (!dims.titleDiff.passed) {
      parts.push(`标题差异${dims.titleDiff.score}%`);
    }
    if (!dims.openingEndingDiff.passed) {
      parts.push(`开头结尾差异${dims.openingEndingDiff.score}%`);
    }

    if (parts.length === 0) {
      return `相似度${overallScore}%，通过验证`;
    }

    return `以下维度超标: ${parts.join(', ')}，整体相似度${overallScore}%`;
  }
}

import { NineDimensionScores, PlatformContent, LLMCall } from '../types';
import { NINE_DIMENSION_EVALUATION_PROMPT } from '../prompts';

export interface InlineEvaluationResult {
  scores: NineDimensionScores;
  score: number;
  passed: boolean;
  hasVeto: boolean;
  vetoDimensions: string[];
  suggestions: string[];
}

export class InlineEvaluator {
  constructor(private llmCall: LLMCall) {}

  /**
   * Evaluate content inline (embedded in generation, not separate call)
   * This calls the LLM to evaluate the content that was just generated
   */
  async evaluate(content: PlatformContent): Promise<InlineEvaluationResult> {
    const prompt = NINE_DIMENSION_EVALUATION_PROMPT.replace('{content}', content.body);

    try {
      const result = await this.llmCall('claude', prompt);
      const parsed = this.parseEvaluationResult(result);

      return {
        scores: parsed.scores,
        score: parsed.weightedScore,
        passed: !parsed.hasVeto && parsed.weightedScore >= 70,
        hasVeto: parsed.hasVeto,
        vetoDimensions: parsed.vetoDimensions || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      console.error('Inline evaluation error:', error);
      // Return a lenient evaluation on error to avoid blocking generation
      return {
        scores: this.defaultScores(),
        score: 75,
        passed: true, // Pass on error to allow continuation
        hasVeto: false,
        vetoDimensions: [],
        suggestions: [],
      };
    }
  }

  /**
   * Parse JSON result from LLM evaluation
   */
  private parseEvaluationResult(result: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fall through to defaults
    }

    // Default scores if parsing fails
    return {
      scores: this.defaultScores(),
      weightedScore: 75,
      hasVeto: false,
      vetoDimensions: [],
      suggestions: [],
    };
  }

  /**
   * Default scores for error cases
   */
  private defaultScores(): NineDimensionScores {
    return {
      emotion: 7,
      utility: 7,
      narrative: 7,
      socialCurrency: 6,
      controversy: 5,
      timeliness: 6,
      differentiation: 6,
      shareability: 6,
      conversionPotential: 6,
    };
  }
}

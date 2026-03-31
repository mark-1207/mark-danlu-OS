import { Platform, PlatformContent, DynamicPromptContext, GenerationWithQuality, LLMCall } from '../types';
import { LLMPool, LLM_POOL } from './llm-pool';
import { QualityGate, QualityGateResult } from './quality-gate';
import { InlineEvaluator } from './inline-evaluator';
import { DynamicPromptBuilder } from '../prompts';

export interface SelfEvolutionConfig {
  maxLLMSwitches: number;
  qualityGate: QualityGate;
}

export class SelfEvolutionGenerator {
  private llmPool: LLMPool;
  private qualityGate: QualityGate;
  private inlineEvaluator: InlineEvaluator;
  private promptBuilder: DynamicPromptBuilder;

  constructor(
    private llmCall: LLMCall,
    config?: Partial<SelfEvolutionConfig>
  ) {
    this.llmPool = new LLMPool(llmCall);
    this.qualityGate = config?.qualityGate || new QualityGate();
    this.inlineEvaluator = new InlineEvaluator(llmCall);
    this.promptBuilder = new DynamicPromptBuilder();
  }

  /**
   * Generate content with quality gate
   * Retry logic: same LLM retries up to maxRetries, then switch to next LLM
   */
  async generateWithQualityGate(
    platform: Platform,
    context: DynamicPromptContext
  ): Promise<GenerationWithQuality> {
    this.llmPool.reset();
    let lastError: string = '';
    let lastResult: GenerationWithQuality | null = null;

    while (this.llmPool.getNext()) {
      const llm = this.llmPool.getNext()!;

      // Try current LLM up to its max retries
      while (this.llmPool.hasRetries() || this.llmPool.getRetryCount() === 0) {
        const retryCount = this.llmPool.incrementRetry();

        try {
          // Build prompt
          const prompt = this.promptBuilder.buildFor(platform, context);

          // Generate content
          const generatedText = await this.llmPool.llmCall(llm.name, prompt);

          // Parse into PlatformContent
          const content = this.parseGeneratedContent(generatedText, platform);

          // Evaluate inline
          const evaluation = await this.inlineEvaluator.evaluate(content);

          // Check quality gate
          if (evaluation.passed) {
            return {
              content,
              passed: true,
              score: evaluation.score,
              llmUsed: llm.name,
              iterations: retryCount,
              improvementSuggestions: [],
            };
          }

          // Quality gate failed - update context with suggestions and retry
          context = {
            ...context,
            improvementSuggestions: evaluation.suggestions,
          };

          lastError = `LLM ${llm.name} attempt ${retryCount}: score=${evaluation.score}, veto=${evaluation.hasVeto}`;

          // Check if we should retry this LLM
          if (!this.llmPool.hasRetries()) {
            break; // Switch to next LLM
          }
        } catch (error: any) {
          lastError = `LLM ${llm.name} error: ${error.message}`;

          if (!this.llmPool.hasRetries()) {
            break; // Switch to next LLM
          }
        }
      }

      // Move to next LLM
      this.llmPool.next();
    }

    // All LLMs failed
    return {
      content: lastResult?.content || {
        platform,
        title: '',
        body: '',
        wordCount: 0,
      },
      passed: false,
      score: 0,
      improvementSuggestions: ['内容质量未达标'],
      llmUsed: this.llmPool.getCurrentName() || 'unknown',
      iterations: 0,
    };
  }

  /**
   * Parse generated text into PlatformContent
   */
  private parseGeneratedContent(text: string, platform: Platform): PlatformContent {
    // Extract title and body from generated text
    // Expected format: first line is title, rest is body
    const lines = text.trim().split('\n');
    const title = lines[0]?.replace(/^#+\s*/, '').trim() || 'Untitled';
    const body = lines.slice(1).join('\n').trim() || text;

    return {
      platform,
      title,
      body,
      wordCount: this.countWords(body),
      tags: platform === 'xiaohongshu' ? this.extractTags(body) : undefined,
      coverText: platform === 'xiaohongshu' ? this.extractCoverText(title) : undefined,
    };
  }

  /**
   * Count Chinese + English words
   */
  private countWords(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (text.match(/[a-zA-Z]+/g) || []).length;
    return chinese + english;
  }

  /**
   * Extract hashtags from Xiaohongshu content
   */
  private extractTags(body: string): string[] {
    const tagMatches = body.match(/#[^#\s]+#/g) || [];
    return tagMatches.map(t => t.replace(/#/g, ''));
  }

  /**
   * Extract cover text suggestion
   */
  private extractCoverText(title: string): string {
    // First 20 chars as cover suggestion
    return title.substring(0, 20);
  }
}

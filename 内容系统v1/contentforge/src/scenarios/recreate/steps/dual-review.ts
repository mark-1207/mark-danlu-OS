import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { DualReviewResultSchema, type DualReviewResult } from '../types.js';

const InputSchema = z.object({
  originalArticle: z.string().optional(),
  recreationArticle: z.string().optional(),
});

// P1 thresholds — must be optimal
const TITLE_THRESHOLD = 8;
const HOOK_THRESHOLD = 7;
const EMOTION_THRESHOLD = 7;
const CTA_THRESHOLD = 7;

// P2 thresholds — important
const POWER_SENTENCE_MIN = 3;

const MAX_ITERATIONS = 3;

/**
 * DualReviewStep implements the conditional loop:
 * P0: If originality check fails → rewrite flagged paragraphs → re-review (max 3 iterations)
 * P1/P2: If element scores below threshold (and P0 passes) → set needsLocalRewrite=true, write triggers to context
 */
export class DualReviewStep extends PipelineStep<z.infer<typeof InputSchema>, DualReviewResult> {
  config = {
    name: 'dual-review',
    description: 'Dual review: P0 originality loop + P1/P2 element trigger extraction',
    retries: 0,
  };

  inputSchema = InputSchema;
  outputSchema = DualReviewResultSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<DualReviewResult> {
    const originalArticle = context.get<string>('_originalArticle');
    const recreationArticle = context.get<string>('recreation-content');
    if (!originalArticle || !recreationArticle) throw new Error('Missing context: _originalArticle or recreation-content');

    let article = recreationArticle;
    let iteration = 0;

    // ── P0: Originality rewrite loop ──────────────────────────────────
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const reviewResult = await this.reviewOnce(originalArticle, article);

      if (!reviewResult.needsRewrite) {
        // P0 passed — evaluate P1/P2
        const triggers = this.extractTriggers(reviewResult, article);

        if (triggers.length > 0) {
          // P1/P2 triggers found — write to context for local-rewrite step
          context.set('needsLocalRewrite', true);
          context.set('optimization-triggers', triggers);
          // Return normally. CLI will check context after pipeline completes.
          return {
            ...reviewResult,
            finalArticle: article,
            needsRewrite: false,
            needsLocalRewrite: true,
            optimizationTriggers: triggers,
          };
        }

        // All clear
        return { ...reviewResult, finalArticle: article };
      }

      if (iteration >= MAX_ITERATIONS) {
        return {
          ...reviewResult,
          finalArticle: article,
          needsRewrite: true,
        };
      }

      article = await this.rewriteFlaggedParagraphs(article, reviewResult.originalityReport.flaggedParagraphs);
    }

    return await this.reviewOnce(originalArticle, article);
  }

  private extractTriggers(
    reviewResult: DualReviewResult,
    article: string,
  ): Array<{ element: string; score: number; position?: string; suggestion: string; action: string }> {
    const triggers: Array<{ element: string; score: number; position?: string; suggestion: string; action: string }> = [];
    const scores = reviewResult.viralPotentialReport?.scores;
    if (!scores) return triggers;

    // P1: Title
    if (scores.titleAttraction < TITLE_THRESHOLD) {
      triggers.push({
        element: 'title',
        score: scores.titleAttraction,
        suggestion: `标题吸引力评分${scores.titleAttraction}低于${TITLE_THRESHOLD}，建议增强反差感或收益承诺`,
        action: 'rewrite-title',
      });
    }

    // P1: Hook
    if (scores.hookRetention < HOOK_THRESHOLD) {
      triggers.push({
        element: 'hook',
        score: scores.hookRetention,
        suggestion: `开头钩子评分${scores.hookRetention}低于${HOOK_THRESHOLD}，建议用更强判断句或认知冲突开场`,
        action: 'rewrite-hook',
      });
    }

    // P1: Emotion curve
    if (scores.emotionalEngagement < EMOTION_THRESHOLD) {
      triggers.push({
        element: 'section',
        score: scores.emotionalEngagement,
        suggestion: `情绪张力评分${scores.emotionalEngagement}低于${EMOTION_THRESHOLD}，建议在情感低谷章节加强情绪密度`,
        action: 'rewrite-section',
      });
    }

    // P1: CTA / interaction
    if (scores.interactionDesign < CTA_THRESHOLD) {
      triggers.push({
        element: 'cta',
        score: scores.interactionDesign,
        suggestion: `互动设计评分${scores.interactionDesign}低于${CTA_THRESHOLD}，建议加强结尾互动提问或行动号召`,
        action: 'rewrite-cta',
      });
    }

    // P2: Power sentence density
    const powerSentenceCount = (article.match(/[。！？]\s*[""]?.{5,20}[""]?[。！？]/g) ?? []).length;
    if (powerSentenceCount < POWER_SENTENCE_MIN) {
      triggers.push({
        element: 'power-sentences',
        score: powerSentenceCount,
        suggestion: `金句数量${powerSentenceCount}低于${POWER_SENTENCE_MIN}，建议补充${POWER_SENTENCE_MIN - powerSentenceCount}句高密度金句`,
        action: 'supplement-power-sentences',
      });
    }

    // P2: Vague examples (from optimization suggestions)
    for (const suggestion of reviewResult.viralPotentialReport?.optimizationSuggestions ?? []) {
      if (/案例.{0,5}(空洞|不够|具体|模糊)/.test(suggestion) || /画面感/.test(suggestion)) {
        triggers.push({
          element: 'example',
          score: 5,
          suggestion,
          action: 'replace-example',
        });
        break; // Only one example trigger per review
      }
    }

    return triggers;
  }

  private async reviewOnce(original: string, recreation: string): Promise<DualReviewResult> {
    const template = await promptLoader.load('recreate', 'dual-review');

    const systemPrompt = template.system;
    const userPrompt = template.user
      .replace('{{originalArticle}}', original)
      .replace('{{recreationArticle}}', recreation);

    return this.callLLMJson<DualReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  private async rewriteFlaggedParagraphs(
    article: string,
    flaggedParagraphs: Array<{ paragraphIndex: number; recreationText: string }>,
  ): Promise<string> {
    const lines = article.split('\n');
    const flaggedIndices = new Set(flaggedParagraphs.map((p) => p.paragraphIndex));

    for (const idx of flaggedIndices) {
      if (idx >= 0 && idx < lines.length) {
        const originalText = flaggedParagraphs.find((p) => p.paragraphIndex === idx)?.recreationText ?? lines[idx];

        const rewritePrompt = `请将以下段落改写，要求：保持相同的意思，但用完全不同的表达方式，禁止使用原文的任何完整句子或相似表达。\n\n原文：${originalText}`;
        const { content } = await this.callLLM([
          { role: 'system', content: '你是一位创意写作专家，擅长同义改写。' },
          { role: 'user', content: rewritePrompt },
        ]);
        lines[idx] = content.trim();
      }
    }

    return lines.join('\n');
  }
}

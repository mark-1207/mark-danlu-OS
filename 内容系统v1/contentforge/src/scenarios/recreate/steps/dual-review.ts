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

const MAX_ITERATIONS = 3;

/**
 * DualReviewStep implements the conditional loop:
 * If originality check fails → rewrite flagged paragraphs → re-review (max 3 iterations).
 */
export class DualReviewStep extends PipelineStep<z.infer<typeof InputSchema>, DualReviewResult> {
  config = {
    name: 'dual-review',
    description: 'Dual review: originality check + viral potential evaluation with rewrite loop',
    retries: 0, // We handle retries internally
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

    while (iteration < MAX_ITERATIONS) {
      const reviewResult = await this.reviewOnce(originalArticle, article);

      if (!reviewResult.needsRewrite) {
        return { ...reviewResult, finalArticle: article };
      }

      iteration++;
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

  private async reviewOnce(original: string, recreation: string): Promise<DualReviewResult> {
    const template = await promptLoader.load('recreate', 'dual-review');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      originalArticle: original,
      recreationArticle: recreation,
    });

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

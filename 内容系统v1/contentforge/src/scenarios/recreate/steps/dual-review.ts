import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { DualReviewResultSchema, type DualReviewResult } from '../types.js';
import type { GoldQuote } from '../types.js';
import { checkSimilarity, type SimilarityCheckItem, cosineSimilarity, computeEmbedding } from '../../../utils/embedding.js';
import { logger } from '../../../utils/logger.js';

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
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');
    if (!originalArticle || !recreationArticle) throw new Error('Missing context: _originalArticle or recreation-content');

    let article = recreationArticle;
    let iteration = 0;

    // ── P0: Originality rewrite loop ──────────────────────────────────
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const reviewResult = await this.reviewOnce(originalArticle, article, viralGenome);

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

        // P0-end: Embedding-based case/data/goldQuote similarity check (per-paragraph)
        // Only runs after LLM originality check passes (needsRewrite === false)
        const hasCaseStudies = viralGenome?.caseStudies?.length ?? 0;
        const hasKeyDataPoints = viralGenome?.keyDataPoints?.length ?? 0;
        const hasGoldQuotes = viralGenome?.goldQuotes?.length ?? 0;

        if (hasCaseStudies || hasKeyDataPoints || hasGoldQuotes) {
          const paragraphs = article.split('\n').filter(p => p.trim().length > 0);
          const paragraphEmbeddings = await Promise.all(
            paragraphs.map(p => computeEmbedding({ text: p }))
          );

          const flaggedElements: Array<{
            paragraphIndex: number;
            recreationText: string;
            similarOriginalText: string;
            similarityType: 'example' | 'goldQuote' | 'expression';
            severity: 'high';
          }> = [];

          // Check caseStudies
          for (const cs of viralGenome?.caseStudies ?? []) {
            const originalText = `${cs.protagonist} ${cs.story}`;
            const elementEmb = await computeEmbedding({ text: originalText });
            let flagged = false;
            for (let pi = 0; pi < paragraphs.length; pi++) {
              const sim = cosineSimilarity(elementEmb.embedding, paragraphEmbeddings[pi].embedding);
              if (sim > SIMILARITY_THRESHOLD) {
                flaggedElements.push({
                  paragraphIndex: pi,
                  recreationText: paragraphs[pi],
                  similarOriginalText: originalText,
                  similarityType: 'example',
                  severity: 'high',
                });
                flagged = true;
                break; // Only flag once per element
              }
            }
          }

          // Check keyDataPoints
          for (const dp of viralGenome?.keyDataPoints ?? []) {
            const originalText = `${dp.data} ${dp.context}`;
            const elementEmb = await computeEmbedding({ text: originalText });
            for (let pi = 0; pi < paragraphs.length; pi++) {
              const sim = cosineSimilarity(elementEmb.embedding, paragraphEmbeddings[pi].embedding);
              if (sim > SIMILARITY_THRESHOLD) {
                flaggedElements.push({
                  paragraphIndex: pi,
                  recreationText: paragraphs[pi],
                  similarOriginalText: originalText,
                  similarityType: 'expression',
                  severity: 'high',
                });
                break;
              }
            }
          }

          // Check goldQuotes
          for (const gq of viralGenome?.goldQuotes ?? []) {
            const elementEmb = await computeEmbedding({ text: gq.text });
            for (let pi = 0; pi < paragraphs.length; pi++) {
              const sim = cosineSimilarity(elementEmb.embedding, paragraphEmbeddings[pi].embedding);
              if (sim > SIMILARITY_THRESHOLD) {
                flaggedElements.push({
                  paragraphIndex: pi,
                  recreationText: paragraphs[pi],
                  similarOriginalText: gq.text,
                  similarityType: 'goldQuote',
                  severity: 'high',
                });
                break;
              }
            }
          }

          if (flaggedElements.length > 0) {
            logger.info(`[dual-review] embedding check flagged ${flaggedElements.length} elements`);
            return {
              ...reviewResult,
              finalArticle: article,
              needsRewrite: true,
              originalityReport: {
                ...reviewResult.originalityReport,
                flaggedParagraphs: [
                  ...reviewResult.originalityReport.flaggedParagraphs,
                  ...flaggedElements,
                ],
              },
            };
          }
        }

        // All clear
        return { ...reviewResult, finalArticle: article, needsRewrite: false, needsLocalRewrite: false };
      }

      if (iteration >= MAX_ITERATIONS) {
        return {
          ...reviewResult,
          finalArticle: article,
          needsRewrite: true,
          needsLocalRewrite: false,
        };
      }

      article = await this.rewriteFlaggedParagraphs(article, reviewResult.originalityReport.flaggedParagraphs, iteration);
    }

    return await this.reviewOnce(originalArticle, article, viralGenome);
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

  private async reviewOnce(original: string, recreation: string, viralGenome?: ViralGenome): Promise<DualReviewResult> {
    const template = await promptLoader.load('recreate', 'dual-review');

    // Build argumentative paths reference for structural similarity check
    const argumentativePaths = viralGenome?.narrativeStructure
      .map((s, i) => `第${i + 1}段: ${s.argumentativePath}`)
      .join('\n') ?? '';

    const systemPrompt = template.system.replace('{{argumentativePaths}}', argumentativePaths || '（无原文论证路径数据）');
    const userPrompt = template.user
      .replace('{{originalArticle}}', original)
      .replace('{{recreationArticle}}', recreation);

    return this.callLLMJson<DualReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  /**
   * Rewrite flagged paragraphs using escalation strategy:
   * - iteration 1: inject narrative identity (e.g. "从外卖小哥视角重写")
   * - iteration 2: force different argumentative method
   * - iteration 3 (final): regenerate from viral genome (drop original entirely)
   */
  private async rewriteFlaggedParagraphs(
    article: string,
    flaggedParagraphs: Array<{ paragraphIndex: number; recreationText: string }>,
    iteration: number,
  ): Promise<string> {
    const lines = article.split('\n');
    const flaggedIndices = new Set(flaggedParagraphs.map((p) => p.paragraphIndex));

    const strategy = iteration === 1
      ? 'narrative-identity'
      : iteration === 2
      ? 'argumentative-shift'
      : 'structural-regeneration';

    for (const idx of flaggedIndices) {
      if (idx >= 0 && idx < lines.length) {
        const originalText = flaggedParagraphs.find((p) => p.paragraphIndex === idx)?.recreationText ?? lines[idx];
        let rewritePrompt: string;

        if (strategy === 'narrative-identity') {
          // Strategy 1: inject a specific narrative POV to break stylistic similarity
          const povOptions = ['从外卖小哥的真实视角', '从一个刚毕业的应届生角度', '从一个宝妈的日常场景', '从一个产品经理的角度'];
          const pov = povOptions[idx % povOptions.length];
          rewritePrompt = `${pov}，将以下段落用完全不同的叙事身份和表达风格重写。保持核心信息，但必须改变：1）叙事身份 2）句式结构 3）用词选择。禁止使用原文任何完整句子或近义表达。\n\n原文：${originalText}`;
        } else if (strategy === 'argumentative-shift') {
          // Strategy 2: force a different argumentative method
          const methodOptions = ['用故事叙事替代说理', '用数据对比替代定性结论', '用问答形式替代陈述形式', '用反常识视角替代常规认知'];
          const method = methodOptions[idx % methodOptions.length];
          rewritePrompt = `用"${method}"的方式重写以下段落。要求：改变论证方式而非仅仅换词，必须实质性地改变论述结构。禁止使用原文任何完整句子或近义表达。\n\n原文：${originalText}`;
        } else {
          // Strategy 3: regenerate from scratch using only the structural instruction
          rewritePrompt = `完全重新生成以下段落的内容。只保留与原文相同的主题方向，用全新的论点、全新的案例、全新的表达方式来写。禁止引用或借鉴原文的任何具体表述。\n\n原文：${originalText}`;
        }

        const { content } = await this.callLLM([
          { role: 'system', content: '你是一位创意写作专家，擅长内容重构。' },
          { role: 'user', content: rewritePrompt },
        ]);
        lines[idx] = content.trim();
      }
    }

    return lines.join('\n');
  }
}

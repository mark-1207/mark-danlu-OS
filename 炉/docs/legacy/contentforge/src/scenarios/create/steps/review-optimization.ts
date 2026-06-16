import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { PlatformAssignmentsSchema, ReviewResultSchema, type PlatformAssignments, type ReviewResult } from '../types.js';
import { L1ForbiddenWordScanner, type L1ScanResult } from '../../opinion/quality/l1-forbidden.js';
import { L2StyleChecker, type L2CheckResult } from '../../opinion/quality/l2-style.js';
import { logger } from '../../../utils/logger.js';

// L1+L2 checker instances (module-scope singletons)
const l1Scanner = new L1ForbiddenWordScanner();
const l2Checker = new L2StyleChecker();

const ReviewInputSchema = z.object({
  titleDrafts: z.array(z.string()).optional(),
  content: z.string().optional(),
  topicCard: z.unknown().optional(),
});

const ReviewOutputSchema = ReviewResultSchema;

// ── Wechat ──────────────────────────────────────────────────────────

export class ReviewWechatStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-wechat', description: 'Review and optimize wechat article', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-wechat');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-wechat');
    const template = await promptLoader.load('create', 'review', 'wechat');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.wechat, null, 2),
    });

    const llmResult = await this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return applyQualityChecks(llmResult, 'wechat', context);
  }
}

// ── Xiaohongshu ─────────────────────────────────────────────────────

export class ReviewXiaohongshuStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-xiaohongshu', description: 'Review and optimize xiaohongshu note', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-xiaohongshu');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-xiaohongshu');
    const template = await promptLoader.load('create', 'review', 'xiaohongshu');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.xiaohongshu, null, 2),
    });

    const llmResult = await this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return applyQualityChecks(llmResult, 'xiaohongshu', context);
  }
}

// ── Douyin ──────────────────────────────────────────────────────────

export class ReviewDouyinStep extends PipelineStep<z.infer<typeof ReviewInputSchema>, ReviewResult> {
  config = { name: 'review-douyin', description: 'Review and optimize douyin script', retries: 1 };

  inputSchema = ReviewInputSchema;
  outputSchema = ReviewOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof ReviewInputSchema>, context: PipelineContext): Promise<ReviewResult> {
    const assignments = context.get<PlatformAssignments>('topic-assignment');
    const contentText = context.get<string>('content-douyin');
    if (!assignments || !contentText) throw new Error('Missing context: topic-assignment or content-douyin');
    const template = await promptLoader.load('create', 'review', 'douyin');
    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      titleDrafts: '',
      content: contentText,
      topicCard: JSON.stringify(assignments.douyin, null, 2),
    });

    const llmResult = await this.callLLMJson<ReviewResult>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return applyQualityChecks(llmResult, 'douyin', context);
  }
}

// ── L1 + L2 quality checks (shared helper) ─────────────────────

interface QualityCheckReport {
  l1: L1ScanResult;
  l2: L2CheckResult;
}

async function applyQualityChecks(
  result: ReviewResult,
  platform: 'wechat' | 'xiaohongshu' | 'douyin',
  context: PipelineContext,
): Promise<ReviewResult> {
  // L1: 禁词扫描 + 自动替换
  const l1 = l1Scanner.scan(result.revisedContent);
  if (l1.hits.length > 0) {
    logger.info(`[${platform}] L1 禁词扫描: ${l1.hits.length} 处命中，已自动替换`);
  }

  // L2: 风格检查（仅生成报告，不阻塞）
  const l2 = l2Checker.check(l1.cleanText);
  if (l2.flags.length > 0) {
    logger.info(`[${platform}] L2 风格检查: ${l2.flags.length} 个 flag, score=${l2.score}`);
  }

  // 存储质检报告到 context（供后续 review-only 阶段使用）
  context.set(`quality-check-${platform}`, { l1, l2 } satisfies QualityCheckReport);

  // 返回替换后的内容（保持 LLM 评审结果 + 应用 L1 替换）
  return {
    ...result,
    revisedContent: l1.cleanText,
  };
}

// 注：applyQualityChecks 作为模块级函数（非方法），因为它不依赖实例。
// 各 review step 通过 super.provider 共享 l1Scanner/l2Checker 模块单例。

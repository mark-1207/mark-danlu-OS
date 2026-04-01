import { DynamicPromptContext, MaterialPackage, AudienceProfile, Platform } from '../types';
import { WECHAT_BASE_PROMPT, XIAOHONGSHU_BASE_PROMPT, TWITTER_BASE_PROMPT, EMBEDDED_REVIEW_PROMPT } from './base-prompts';

/**
 * Progressive Disclosure Levels:
 * - level 1: Direct instruction (simple task)
 * - level 2: Add constraints (standard task)
 * - level 3: Add reasoning steps (complex task)
 * - level 4: Add few-shot examples (new domain)
 */
export type PromptComplexityLevel = 1 | 2 | 3 | 4;

export class DynamicPromptBuilder {
  /**
   * Build prompt for WeChat platform with progressive disclosure
   * Complexity increases based on:
   * - Has improvement suggestions from previous iterations (level up)
   * - Has style examples from library (level up)
   * - Is a new topic area (level up)
   */
  buildForWechat(ctx: DynamicPromptContext, complexityLevel: PromptComplexityLevel = 2): string {
    let prompt = WECHAT_BASE_PROMPT;

    // Progressive disclosure: add more guidance based on complexity
    if (complexityLevel >= 3) {
      prompt += '\n\n【写作前思考步骤】\n';
      prompt += '1. 核心反常识观点是什么？\n';
      prompt += '2. 用什么个人故事支撑？\n';
      prompt += '3. 目标受众最大的痛点如何回应？\n';
    }

    // Inject materials (more context for higher complexity)
    if (ctx.materialPackage && this.hasMaterials(ctx.materialPackage)) {
      prompt += '\n\n【参考素材】\n';

      if (ctx.materialPackage.viralQuotes.length > 0) {
        prompt += '高光金句：\n';
        ctx.materialPackage.viralQuotes.forEach(q => { prompt += `- ${q}\n`; });
        prompt += '\n';
      }

      if (ctx.materialPackage.caseStudies.length > 0) {
        prompt += '案例参考：\n';
        ctx.materialPackage.caseStudies.forEach(c => { prompt += `- ${c}\n`; });
        prompt += '\n';
      }

      if (ctx.materialPackage.counterArguments.length > 0) {
        prompt += '反常识观点：\n';
        ctx.materialPackage.counterArguments.forEach(c => { prompt += `- ${c}\n`; });
        prompt += '\n';
      }
    }

    // Inject improvement suggestions (escalates complexity)
    if (ctx.improvementSuggestions.length > 0) {
      prompt += '\n【上轮改进建议】\n';
      prompt += '请特别注意以下改进点（这是第' + ctx.improvementSuggestions.length + '轮迭代）：\n';
      ctx.improvementSuggestions.forEach((s, i) => { prompt += `${i + 1}. ${s}\n`; });

      // Add specific guidance for iteration
      if (complexityLevel >= 2) {
        prompt += '\n【迭代要求】\n';
        prompt += '对比上一版本，重点检查：\n';
        prompt += '- 之前的问题是否已解决？\n';
        prompt += '- 是否有新的提升？\n';
      }
    }

    // Inject task background
    if (ctx.taskBackground) {
      prompt += `\n【本次任务】\n${ctx.taskBackground}\n`;
    }

    // Inject audience
    prompt += '\n【重点受众特征】\n';
    if (ctx.targetAudience.painPoints.length > 0) {
      prompt += `他们关心的问题：${ctx.targetAudience.painPoints.join('、')}\n`;
    }
    if (ctx.targetAudience.aspirations.length > 0) {
      prompt += `他们想要的：${ctx.targetAudience.aspirations.join('、')}\n`;
    }

    // Inject style examples for highest complexity (few-shot)
    if (ctx.styleExamples && ctx.styleExamples.length > 0 && complexityLevel >= 4) {
      prompt += '\n【风格参考示例】\n';
      prompt += '学习以下优秀案例的写作手法：\n\n';
      ctx.styleExamples.slice(0, 2).forEach((example, i) => {
        prompt += `示例${i + 1}：\n${example.content}\n\n`;
      });
    }

    // Add review instruction
    prompt += '\n' + EMBEDDED_REVIEW_PROMPT;

    return prompt;
  }

  /**
   * Build prompt for Xiaohongshu platform
   */
  buildForXiaohongshu(ctx: DynamicPromptContext, complexityLevel: PromptComplexityLevel = 2): string {
    let prompt = XIAOHONGSHU_BASE_PROMPT;

    // Progressive disclosure
    if (complexityLevel >= 3) {
      prompt += '\n\n【创作检查清单】\n';
      prompt += '□ 封面能3秒内抓住注意力吗？\n';
      prompt += '□ 开头能引发共鸣吗？\n';
      prompt += '□ 有真实的个人体验吗？\n';
    }

    // Inject materials (shorter for Xiaohongshu)
    if (ctx.materialPackage && this.hasMaterials(ctx.materialPackage)) {
      prompt += '\n\n【参考素材】\n';

      if (ctx.materialPackage.viralQuotes.length > 0) {
        prompt += '可用金句：' + ctx.materialPackage.viralQuotes.slice(0, 2).join('、') + '\n';
      }

      if (ctx.materialPackage.caseStudies.length > 0) {
        prompt += '可用案例：' + ctx.materialPackage.caseStudies.slice(0, 2).join('、') + '\n';
      }
    }

    // Inject improvements
    if (ctx.improvementSuggestions.length > 0) {
      prompt += '\n【上轮改进点】' + ctx.improvementSuggestions[0] + '\n';
    }

    // Task background
    if (ctx.taskBackground) {
      prompt += '\n' + ctx.taskBackground + '\n';
    }

    // Add review
    prompt += '\n' + EMBEDDED_REVIEW_PROMPT;

    return prompt;
  }

  /**
   * Build prompt for Twitter platform
   */
  buildForTwitter(ctx: DynamicPromptContext, complexityLevel: PromptComplexityLevel = 2): string {
    let prompt = TWITTER_BASE_PROMPT;

    // Progressive disclosure
    if (complexityLevel >= 3) {
      prompt += '\n\n【Tweet检查】\n';
      prompt += '前3字是否抓人？\n';
      prompt += '观点是否足够鲜明？\n';
    }

    // Keep Twitter prompt concise
    if (ctx.materialPackage && ctx.materialPackage.viralQuotes.length > 0) {
      prompt += '\n\n【核心观点参考】' + ctx.materialPackage.viralQuotes[0] + '\n';
    }

    if (ctx.improvementSuggestions.length > 0) {
      prompt += '\n【改进】' + ctx.improvementSuggestions[0] + '\n';
    }

    if (ctx.taskBackground) {
      prompt += '\n' + ctx.taskBackground + '\n';
    }

    prompt += '\n' + EMBEDDED_REVIEW_PROMPT;

    return prompt;
  }

  /**
   * Build prompt for specific platform
   */
  buildFor(platform: Platform, ctx: DynamicPromptContext, complexityLevel?: PromptComplexityLevel): string {
    const level = complexityLevel ?? this.calculateComplexityLevel(ctx);

    switch (platform) {
      case 'wechat':
        return this.buildForWechat(ctx, level);
      case 'xiaohongshu':
        return this.buildForXiaohongshu(ctx, level);
      case 'twitter':
        return this.buildForTwitter(ctx, level);
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Calculate complexity level based on context
   * Higher complexity = more guidance needed
   */
  calculateComplexityLevel(ctx: DynamicPromptContext): PromptComplexityLevel {
    // Level 1: Simple, direct task
    // Level 2: Standard (has materials)
    // Level 3: Complex (has improvements or new domain)
    // Level 4: Very complex (has style examples + improvements)

    let score = 1;

    if (ctx.materialPackage && this.hasMaterials(ctx.materialPackage)) {
      score = Math.max(score, 2);
    }

    if (ctx.improvementSuggestions.length > 0) {
      score = Math.max(score, 3);
    }

    if (ctx.styleExamples && ctx.styleExamples.length > 0) {
      score = Math.max(score, 4);
    }

    if (ctx.targetAudience.painPoints.length > 3) {
      score = Math.max(score, 3);
    }

    return score as PromptComplexityLevel;
  }

  /**
   * Check if material package has any content
   */
  private hasMaterials(pkg: MaterialPackage): boolean {
    return (
      pkg.viralQuotes.length > 0 ||
      pkg.caseStudies.length > 0 ||
      pkg.counterArguments.length > 0
    );
  }
}
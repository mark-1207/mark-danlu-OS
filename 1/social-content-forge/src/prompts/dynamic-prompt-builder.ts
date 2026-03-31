import { DynamicPromptContext, MaterialPackage, AudienceProfile, Platform } from '../types';
import { WECHAT_BASE_PROMPT, XIAOHONGSHU_BASE_PROMPT, TWITTER_BASE_PROMPT, EMBEDDED_REVIEW_PROMPT } from './base-prompts';

export class DynamicPromptBuilder {
  /**
   * Build prompt for WeChat platform
   */
  buildForWechat(ctx: DynamicPromptContext): string {
    let prompt = WECHAT_BASE_PROMPT;

    // Inject materials
    if (ctx.materialPackage && this.hasMaterials(ctx.materialPackage)) {
      prompt += '\n\n【参考素材】\n';
      prompt += '在生成内容时，可以参考以下素材（但不要照搬）：\n\n';

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

    // Inject improvement suggestions
    if (ctx.improvementSuggestions.length > 0) {
      prompt += '\n【上轮改进建议】\n';
      prompt += '请特别注意以下改进点：\n';
      ctx.improvementSuggestions.forEach((s, i) => { prompt += `${i + 1}. ${s}\n`; });
      prompt += '\n';
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

    // Add review instruction
    prompt += '\n' + EMBEDDED_REVIEW_PROMPT;

    return prompt;
  }

  /**
   * Build prompt for Xiaohongshu platform
   */
  buildForXiaohongshu(ctx: DynamicPromptContext): string {
    let prompt = XIAOHONGSHU_BASE_PROMPT;

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
      prompt += '\n【改进点】' + ctx.improvementSuggestions[0] + '\n';
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
  buildForTwitter(ctx: DynamicPromptContext): string {
    let prompt = TWITTER_BASE_PROMPT;

    // Keep Twitter prompt concise
    if (ctx.materialPackage?.viralQuotes.length > 0) {
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
  buildFor(platform: Platform, ctx: DynamicPromptContext): string {
    switch (platform) {
      case 'wechat':
        return this.buildForWechat(ctx);
      case 'xiaohongshu':
        return this.buildForXiaohongshu(ctx);
      case 'twitter':
        return this.buildForTwitter(ctx);
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
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
import { DynamicPromptContext, MaterialPackage, AudienceProfile } from '../../types';

/**
 * Build enhanced prompt with materials
 */
export class PromptBuilder {
  /**
   * Build dynamic prompt context with materials injected
   */
  buildContext(
    taskBackground: string,
    materialPackage: MaterialPackage | undefined,
    improvementSuggestions: string[],
    targetAudience: AudienceProfile,
    relatedExamples?: string[]
  ): DynamicPromptContext {
    return {
      taskBackground,
      materialPackage,
      improvementSuggestions,
      targetAudience,
      styleExamples: relatedExamples?.map(content => ({
        type: 'good' as const,
        content,
        whatWorks: 'Related style example',
      })),
    };
  }

  /**
   * Format material package as string for LLM prompt
   */
  formatMaterialsForPrompt(pkg: MaterialPackage): string {
    const parts: string[] = [];

    if (pkg.viralQuotes.length > 0) {
      parts.push('【高光金句】');
      pkg.viralQuotes.forEach(q => parts.push(`- ${q}`));
    }

    if (pkg.caseStudies.length > 0) {
      parts.push('\n【案例参考】');
      pkg.caseStudies.forEach(c => parts.push(`- ${c}`));
    }

    if (pkg.counterArguments.length > 0) {
      parts.push('\n【反常识观点】');
      pkg.counterArguments.forEach(c => parts.push(`- ${c}`));
    }

    return parts.join('\n');
  }
}
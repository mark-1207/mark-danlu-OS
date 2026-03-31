import { MaterialPackage, AudienceProfile, StyleExample } from '../../types';
import { MaterialEnhancementConfig, EnhancementResult } from './types';
import { MaterialExtractor } from './extractor';
import { StyleLibrarySearcher } from './searcher';
import { PromptBuilder } from './prompter';

const DEFAULT_CONFIG: MaterialEnhancementConfig = {
  maxMaterialsPerQuery: 5,
  minQuoteLength: 10,
  minCaseLength: 20,
};

export class MaterialEnhancementService {
  private extractor: MaterialExtractor;
  private searcher: StyleLibrarySearcher;
  private prompter: PromptBuilder;

  constructor(
    private projectRoot: string,
    config: Partial<MaterialEnhancementConfig> = {}
  ) {
    this.extractor = new MaterialExtractor();
    this.searcher = new StyleLibrarySearcher(projectRoot);
    this.prompter = new PromptBuilder();
  }

  /**
   * Enhance a search query by finding related materials
   */
  enhanceSearchQuery(
    query: string,
    targetAudience: AudienceProfile
  ): EnhancementResult {
    // Search for related content in style library
    const relatedExamples = this.searcher.search(query, 3);

    // Extract materials from found content
    const allMaterials: MaterialPackage = {
      viralQuotes: [],
      caseStudies: [],
      counterArguments: [],
    };

    for (const example of relatedExamples) {
      const extracted = this.extractor.extract(example.content);
      allMaterials.viralQuotes.push(...extracted.viralQuotes);
      allMaterials.caseStudies.push(...extracted.caseStudies);
      allMaterials.counterArguments.push(...extracted.counterArguments);
    }

    // Deduplicate
    allMaterials.viralQuotes = [...new Set(allMaterials.viralQuotes)];
    allMaterials.caseStudies = [...new Set(allMaterials.caseStudies)];
    allMaterials.counterArguments = [...new Set(allMaterials.counterArguments)];

    // Calculate confidence based on how much material we found
    const totalMaterials =
      allMaterials.viralQuotes.length +
      allMaterials.caseStudies.length +
      allMaterials.counterArguments.length;
    const confidence = Math.min(totalMaterials / 3, 1); // 0-1 scale

    return {
      query,
      materialPackage: allMaterials,
      relatedTopics: relatedExamples.map(e => e.whatWorks || '').filter(Boolean),
      confidence,
    };
  }

  /**
   * Extract materials from a specific piece of content
   */
  extractFromContent(content: string): MaterialPackage {
    return this.extractor.extract(content);
  }

  /**
   * Build prompt context with materials
   */
  buildContext(
    taskBackground: string,
    materialPackage: MaterialPackage | undefined,
    improvementSuggestions: string[],
    targetAudience: AudienceProfile
  ): DynamicPromptContext {
    return this.prompter.buildContext(
      taskBackground,
      materialPackage,
      improvementSuggestions,
      targetAudience
    );
  }
}
import { describe, it, expect } from 'vitest';
import { MaterialEnhancementService } from '../../src/material-enhancement';
import { MaterialExtractor } from '../../src/material-enhancement/extractor';
import { PromptBuilder } from '../../src/material-enhancement/prompter';
import { StyleLibrarySearcher } from '../../src/material-enhancement/searcher';

describe('MaterialEnhancementService', () => {
  const PROJECT_ROOT = 'D:/myproject/1/social-content-forge';
  let service: MaterialEnhancementService;

  beforeEach(() => {
    service = new MaterialEnhancementService(PROJECT_ROOT);
  });

  it('should create service', () => {
    expect(service).toBeInstanceOf(MaterialEnhancementService);
  });

  it('should enhance search query', () => {
    const result = service.enhanceSearchQuery('赚钱', {
      core: ['大厂边缘人'],
      edge: ['小企业主'],
      painPoints: ['职场内卷'],
      aspirations: ['找到新方向'],
    });
    expect(result.query).toBe('赚钱');
    expect(result.materialPackage).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should extract from content', () => {
    const content = '赚钱最重要的是动脑子。像冯小刚这样的成功人士，都是善于学习的。';
    const pkg = service.extractFromContent(content);
    expect(pkg.viralQuotes.length).toBeGreaterThan(0);
  });
});

describe('MaterialExtractor', () => {
  let extractor: MaterialExtractor;

  beforeEach(() => {
    extractor = new MaterialExtractor();
  });

  it('should extract viral quotes', () => {
    const content = '赚钱最重要的是动脑子。这是一个关键的洞察。';
    const pkg = extractor.extract(content);
    expect(pkg.viralQuotes.length).toBeGreaterThan(0);
  });

  it('should extract case studies', () => {
    const content = '像冯小刚这样的成功人士，都是善于学习的。';
    const pkg = extractor.extract(content);
    expect(pkg.caseStudies.length).toBeGreaterThan(0);
  });

  it('should extract counter arguments', () => {
    const content = '赚钱不是因为运气，而是因为认知。';
    const pkg = extractor.extract(content);
    expect(pkg.counterArguments.length).toBeGreaterThan(0);
  });
});

describe('PromptBuilder', () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  it('should build context', () => {
    const ctx = builder.buildContext(
      '用户想写赚钱的文章',
      { viralQuotes: ['赚钱靠认知'], caseStudies: [], counterArguments: [] },
      ['加强案例'],
      { core: ['大厂边缘人'], edge: [], painPoints: [], aspirations: [] }
    );
    expect(ctx.taskBackground).toBe('用户想写赚钱的文章');
    expect(ctx.materialPackage?.viralQuotes[0]).toBe('赚钱靠认知');
  });

  it('should format materials for prompt', () => {
    const formatted = builder.formatMaterialsForPrompt({
      viralQuotes: ['赚钱靠认知'],
      caseStudies: ['冯小刚案例'],
      counterArguments: ['不是运气'],
    });
    expect(formatted).toContain('高光金句');
    expect(formatted).toContain('赚钱靠认知');
  });
});
import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { ViralGenome } from '../types.js';
import {
  rewriteTitle,
  rewriteHook,
  rewriteSection,
  rewriteCta,
  supplementPowerSentences,
  replaceExample,
} from './rewrite-actions.js';

const InputSchema = z.object({
  _unused: z.string().optional(),
});

const LocalRewriteOutputSchema = z.object({
  rewrittenArticle: z.string(),
  appliedTriggers: z.array(z.object({
    element: z.string(),
    action: z.string(),
    originalText: z.string().optional(),
    newText: z.string().optional(),
  })),
});

export class LocalRewriteStep extends PipelineStep<z.infer<typeof InputSchema>, z.infer<typeof LocalRewriteOutputSchema>> {
  config = {
    name: 'local-rewrite',
    description: 'Rewrite specific elements (title/hook/section/cta/sentences) based on optimization triggers',
    optional: true,
    retries: 0,
  };

  inputSchema = InputSchema;
  outputSchema = LocalRewriteOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(_input: z.infer<typeof InputSchema>, context: PipelineContext) {
    const triggers = context.get<Array<{ element: string; score: number; position?: string; suggestion: string; action: string }>>('optimization-triggers');
    let article = context.get<string>('recreation-content');
    const viralGenome = context.get<ViralGenome>('viral-deconstruction');

    if (!triggers || triggers.length === 0) {
      return { rewrittenArticle: article, appliedTriggers: [] };
    }

    const applied: Array<{ element: string; action: string; originalText?: string; newText?: string }> = [];

    for (const trigger of triggers) {
      switch (trigger.action) {
        case 'rewrite-title': {
          const { newTitle } = await this.rewriteTitle(article, viralGenome);
          const oldTitle = article.split('\n')[0];
          article = newTitle + '\n' + article.slice(article.indexOf('\n') + 1);
          applied.push({ element: 'title', action: 'rewrite-title', originalText: oldTitle, newText: newTitle });
          break;
        }
        case 'rewrite-hook': {
          const { newHook } = await this.rewriteHook(viralGenome);
          // Replace first 1-3 paragraphs
          const paragraphs = article.split('\n\n');
          const hookParagraphs = newHook.split('\n\n').slice(0, 3);
          const restStart = paragraphs.findIndex((_, i) => i >= 2 || paragraphs[i].startsWith('#'));
          const start = restStart >= 0 ? restStart : 3;
          const originalFirst = paragraphs.slice(0, start).join('\n\n');
          const newParagraphs = [...hookParagraphs, ...paragraphs.slice(start)];
          article = newParagraphs.join('\n\n');
          applied.push({ element: 'hook', action: 'rewrite-hook', originalText: originalFirst, newText: hookParagraphs.join('\n\n') });
          break;
        }
        case 'rewrite-section': {
          const { rewritten, originalText } = await this.rewriteSection(article, trigger, viralGenome);
          if (originalText) {
            article = article.replace(originalText, rewritten);
            applied.push({ element: 'section', action: 'rewrite-section', originalText, newText: rewritten });
          }
          break;
        }
        case 'rewrite-cta': {
          const { newCta, originalCta } = await this.rewriteCta(viralGenome);
          // Replace last paragraph(s)
          const lastSep = article.lastIndexOf('\n\n');
          if (lastSep > 0) {
            const originalCtaText = article.slice(lastSep);
            article = article.slice(0, lastSep) + '\n\n' + newCta;
            applied.push({ element: 'cta', action: 'rewrite-cta', originalText: originalCtaText, newText: newCta });
          }
          break;
        }
        case 'supplement-power-sentences': {
          const { insertions } = await this.supplementPowerSentences(article, viralGenome);
          // Insert at the specified positions (paragraph boundaries)
          const paras = article.split('\n\n');
          for (const ins of insertions.reverse()) {
            const idx = Math.min(ins.position, paras.length - 1);
            paras[idx] = paras[idx] + '\n\n' + ins.sentence;
          }
          article = paras.join('\n\n');
          applied.push({ element: 'power-sentences', action: 'supplement-power-sentences', newText: insertions.map(i => i.sentence).join(' | ') });
          break;
        }
        case 'replace-example': {
          const { rewritten, originalText } = await this.replaceExample(article, trigger.suggestion);
          if (originalText) {
            article = article.replace(originalText, rewritten);
            applied.push({ element: 'example', action: 'replace-example', originalText, newText: rewritten });
          }
          break;
        }
      }
    }

    context.set('recreation-content', article);

    return { rewrittenArticle: article, appliedTriggers: applied };
  }

  private async rewriteTitle(article: string, viralGenome: ViralGenome): Promise<{ newTitle: string }> {
    return rewriteTitle(article, viralGenome, { callLLM: (msgs) => this.callLLM(msgs) });
  }

  private async rewriteHook(viralGenome: ViralGenome): Promise<{ newHook: string }> {
    return rewriteHook(viralGenome, { callLLM: (msgs) => this.callLLM(msgs) });
  }

  private async rewriteSection(
    article: string,
    trigger: { element: string; score: number; position?: string; suggestion: string },
    viralGenome: ViralGenome,
  ): Promise<{ rewritten: string; originalText: string | null }> {
    return rewriteSection(article, trigger, viralGenome, { callLLM: (msgs) => this.callLLM(msgs) });
  }

  private async rewriteCta(viralGenome: ViralGenome): Promise<{ newCta: string; originalCta: string }> {
    return rewriteCta(viralGenome, { callLLM: (msgs) => this.callLLM(msgs) });
  }

  private async supplementPowerSentences(
    article: string,
    viralGenome: ViralGenome,
  ): Promise<{ insertions: Array<{ sentence: string; position: number }> }> {
    return supplementPowerSentences(article, viralGenome, { callLLM: (msgs) => this.callLLM(msgs) });
  }

  private async replaceExample(
    article: string,
    suggestion: string,
  ): Promise<{ rewritten: string; originalText: string | null }> {
    return replaceExample(article, suggestion, { callLLM: (msgs) => this.callLLM(msgs) });
  }
}

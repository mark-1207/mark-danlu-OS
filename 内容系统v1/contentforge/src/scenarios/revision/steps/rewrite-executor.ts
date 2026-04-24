// Revision rewrite executor — applies targeted element rewrites across platforms

import type { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { RevisionSelection } from '../types.js';
import type { AppliedRevision } from '../types.js';
import {
  rewriteTitle,
  rewriteHook,
  rewriteSection,
  rewriteCta,
  supplementPowerSentences,
  replaceExample,
} from '../../recreate/steps/rewrite-actions.js';

export interface RewriteResult {
  appliedTriggers: AppliedRevision['appliedTriggers'];
  updatedContent: Record<string, string>; // platform -> content
}

function elementToAction(element: string): string {
  switch (element) {
    case 'title': return 'rewrite-title';
    case 'hook': return 'rewrite-hook';
    case 'body': return 'rewrite-section';
    case 'cta': return 'rewrite-cta';
    case 'example': return 'replace-example';
    case 'power-sentence': return 'supplement-power-sentences';
    default: return 'rewrite-section';
  }
}

export async function executeRevisionRewrite(
  selections: RevisionSelection[],
  contents: Record<string, string>, // platform -> current content
  userInstruction: string,
  _context: PipelineContext,
  provider: LLMProvider,
  defaultModel: string,
): Promise<RewriteResult> {
  const updatedContent: Record<string, string> = { ...contents };
  const appliedTriggers: AppliedRevision['appliedTriggers'] = [];

  // Build a mock viralGenome as fallback (revision may not have full genome)
  const mockViralGenome = {
    hookTechnique: { type: '判断式金句钩子', mechanism: '用极短句直接给出一个强判断', template: '' },
    emotionCurve: [],
    narrativeStructure: [],
    powerSentences: [],
  };
  const viralGenome = _context.get<any>('viral-genome') ?? mockViralGenome;

  const callLLM = async (messages: Array<{ role: string; content: string }>) => {
    const response = await provider.chat({
      model: defaultModel,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    });
    return { content: response.content };
  };

  const deps = { callLLM };

  for (const selection of selections) {
    const action = elementToAction(selection.element);

    for (const platform of selection.platforms) {
      const article = updatedContent[platform];
      if (!article) continue;

      switch (action) {
        case 'rewrite-title': {
          const { newTitle } = await rewriteTitle(article, viralGenome, deps);
          const oldTitle = article.split('\n')[0];
          updatedContent[platform] = newTitle + '\n' + article.slice(article.indexOf('\n') + 1);
          appliedTriggers.push({ element: 'title', action: 'rewrite-title', originalText: oldTitle, newText: newTitle });
          break;
        }
        case 'rewrite-hook': {
          const { newHook } = await rewriteHook(viralGenome, deps);
          const paragraphs = article.split('\n\n');
          const hookParagraphs = newHook.split('\n\n').slice(0, 3);
          const restStart = paragraphs.findIndex((_, i) => i >= 2 || paragraphs[i].startsWith('#'));
          const start = restStart >= 0 ? restStart : 3;
          const originalFirst = paragraphs.slice(0, start).join('\n\n');
          const newParagraphs = [...hookParagraphs, ...paragraphs.slice(start)];
          updatedContent[platform] = newParagraphs.join('\n\n');
          appliedTriggers.push({ element: 'hook', action: 'rewrite-hook', originalText: originalFirst, newText: hookParagraphs.join('\n\n') });
          break;
        }
        case 'rewrite-section': {
          const trigger = { element: 'body', score: 0, suggestion: userInstruction };
          const { rewritten, originalText } = await rewriteSection(article, trigger, viralGenome, deps);
          if (originalText) {
            updatedContent[platform] = article.replace(originalText, rewritten);
            appliedTriggers.push({ element: 'body', action: 'rewrite-section', originalText, newText: rewritten });
          }
          break;
        }
        case 'rewrite-cta': {
          const { newCta, originalCta } = await rewriteCta(viralGenome, deps);
          const lastSep = article.lastIndexOf('\n\n');
          if (lastSep > 0) {
            const originalCtaText = article.slice(lastSep);
            updatedContent[platform] = article.slice(0, lastSep) + '\n\n' + newCta;
            appliedTriggers.push({ element: 'cta', action: 'rewrite-cta', originalText: originalCtaText, newText: newCta });
          }
          break;
        }
        case 'supplement-power-sentences': {
          const { insertions } = await supplementPowerSentences(article, viralGenome, deps);
          const paras = article.split('\n\n');
          for (const ins of insertions.reverse()) {
            const idx = Math.min(ins.position, paras.length - 1);
            paras[idx] = paras[idx] + '\n\n' + ins.sentence;
          }
          updatedContent[platform] = paras.join('\n\n');
          appliedTriggers.push({ element: 'power-sentence', action: 'supplement-power-sentences', newText: insertions.map(i => i.sentence).join(' | ') });
          break;
        }
        case 'replace-example': {
          const { rewritten, originalText } = await replaceExample(article, userInstruction, deps);
          if (originalText) {
            updatedContent[platform] = article.replace(originalText, rewritten);
            appliedTriggers.push({ element: 'example', action: 'replace-example', originalText, newText: rewritten });
          }
          break;
        }
      }
    }
  }

  return { appliedTriggers, updatedContent };
}

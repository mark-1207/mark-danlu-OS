import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { ViralGenome } from '../types.js';

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
    const currentTitle = article.split('\n')[0].replace(/^#+\s*/, '').trim();
    const hookTemplate = viralGenome?.hookTechnique?.template ?? '';

    const { content } = await this.callLLM([
      {
        role: 'system',
        content: `你是一位爆款标题专家。根据文章内容，生成3个不同风格的高吸引力标题。

要求：
- 每个标题不超过20字
- 风格要有差异（一个问题型、一个反差型、一个利益承诺型）
- 直接输出标题，每行一个，前面加序号（1. 2. 3.）
- 不要输出其他内容

参考标题公式：${hookTemplate || '体力有上限，{认知}没有。学会用{脑力}而不是{时间}去{赚钱}.'}`,
      },
      {
        role: 'user',
        content: `当前标题：${currentTitle}\n\n文章内容前500字：\n${article.slice(0, 500)}`,
      },
    ]);

    // Pick the first one as the new title (it's the best rated)
    const lines = content.split('\n').filter(l => /^\d+\./.test(l.trim()));
    const newTitle = lines[0]?.replace(/^\d+\.\s*/, '').trim() || currentTitle;
    return { newTitle: '# ' + newTitle };
  }

  private async rewriteHook(viralGenome: ViralGenome): Promise<{ newHook: string }> {
    const firstEmotion = viralGenome?.emotionCurve?.[0];
    const hookType = viralGenome?.hookTechnique?.type ?? '判断式金句钩子';
    const hookMechanism = viralGenome?.hookTechnique?.mechanism ?? '用极短句直接给出一个强判断';

    const { content } = await this.callLLM([
      {
        role: 'system',
        content: `你是一位爆款文章开头专家。

技巧类型：${hookType}
运作机制：${hookMechanism}
第一个情绪高点：${firstEmotion ? `${firstEmotion.emotion}（强度${firstEmotion.intensity}/10）` : '被点醒（强度8）'}

要求：
- 写前1-3段作为开头（总字数100-200字）
- 必须有强烈的第一句/第一段
- 直接输出Markdown正文，不要输出JSON或其他内容`,
      },
      {
        role: 'user',
        content: `请根据以上信息生成一个新的开头，要求：
1. 冲击力强，第一句就要抓人
2. 与原文风格明显不同
3. 可以用金句开场或问题共鸣开场`,
      },
    ]);

    return { newHook: content.trim() };
  }

  private async rewriteSection(
    article: string,
    trigger: { element: string; score: number; position?: string; suggestion: string },
    viralGenome: ViralGenome,
  ): Promise<{ rewritten: string; originalText: string | null }> {
    const emotionTarget = trigger.suggestion;

    // Find the section to rewrite — use position hint or just take middle third
    const paragraphs = article.split('\n\n');
    let targetIdx = Math.floor(paragraphs.length / 3);
    if (trigger.position) {
      const match = trigger.position.match(/paragraphs? (\d+)/);
      if (match) targetIdx = parseInt(match[1]) - 1;
    }

    const originalText = paragraphs[targetIdx] ?? null;
    if (!originalText) return { rewritten: '', originalText: null };

    const { content } = await this.callLLM([
      {
        role: 'system',
        content: `你是一位内容优化专家。需要重写文章中的一个段落。

优化要求：${emotionTarget}

要求：
- 保持相同的字数和结构位置
- 按照优化要求调整论点和表达
- 直接输出重写后的段落正文，不要前缀说明
- 禁止使用与原文相同的完整句子`,
      },
      {
        role: 'user',
        content: `原文段落：\n${originalText}`,
      },
    ]);

    return { rewritten: content.trim(), originalText };
  }

  private async rewriteCta(viralGenome: ViralGenome): Promise<{ newCta: string; originalCta: string }> {
    const closingDesign = viralGenome?.narrativeStructure?.find(
      s => s.purpose.includes('结尾') || s.purpose.includes('收束'),
    );

    const { content } = await this.callLLM([
      {
        role: 'system',
        content: `你是一位内容结尾专家。

结尾技巧：${closingDesign?.technique ?? '口语化收尾 + 轻幽默 + 互动提问'}
情绪目标：${closingDesign?.emotionMark ?? '松弛、亲近、余味停留'}

要求：
- 写最后一段作为结尾（80-150字）
- 必须有互动提问或引导评论的元素
- 口语化，不要说教
- 直接输出Markdown正文`,
      },
      {
        role: 'user',
        content: '生成一个新的结尾：',
      },
    ]);

    return { newCta: content.trim(), originalCta: '' };
  }

  private async supplementPowerSentences(
    article: string,
    viralGenome: ViralGenome,
  ): Promise<{ insertions: Array<{ sentence: string; position: number }> }> {
    const powerSentences = viralGenome?.powerSentences ?? [];
    const emotionCurve = viralGenome?.emotionCurve ?? [];

    // Find top emotion curve positions
    const highEmotionPositions = emotionCurve
      .filter(e => e.intensity >= 7)
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3)
      .map(e => Math.floor((e.position / 10) * article.split('\n\n').length)); // rough mapping

    const insertPositions = highEmotionPositions.length > 0
      ? highEmotionPositions
      : [Math.floor(article.split('\n\n').length / 3), Math.floor(article.split('\n\n').length * 2 / 3)];

    const sentences = powerSentences.slice(0, insertPositions.length);

    const insertions: Array<{ sentence: string; position: number }> = [];
    for (let i = 0; i < Math.min(sentences.length, insertPositions.length); i++) {
      // Generate a new power sentence similar in style
      const { content } = await this.callLLM([
        {
          role: 'system',
          content: `你是一位爆款金句专家。请根据以下金句的风格，生成1句新的金句。

风格参考：${sentences[i]?.structure ?? '并列对照 + 极简短句'}

要求：
- 10-20字
- 可以是对照式、警告式、或概念反转式
- 直接输出一句话，不要其他内容`,
        },
        {
          role: 'user',
          content: `生成一句新金句：`,
        },
      ]);
      insertions.push({ sentence: content.trim(), position: insertPositions[i] });
    }

    return { insertions };
  }

  private async replaceExample(
    article: string,
    suggestion: string,
  ): Promise<{ rewritten: string; originalText: string | null }> {
    // Try to find a vague/improvable example paragraph
    const paragraphs = article.split('\n\n');
    let candidateIdx = -1;
    let minLen = Infinity;

    // Find the shortest paragraph that sounds like a case/example (likely too vague)
    for (let i = 1; i < paragraphs.length - 1; i++) {
      const p = paragraphs[i];
      if (p.length < minLen && (p.includes('比如') || p.includes('例如') || p.includes('有的人'))) {
        candidateIdx = i;
        minLen = p.length;
      }
    }

    const originalText = candidateIdx >= 0 ? paragraphs[candidateIdx] : null;
    if (!originalText) return { rewritten: '', originalText: null };

    const { content } = await this.callLLM([
      {
        role: 'system',
        content: `你是一位案例优化专家。

优化建议：${suggestion}

要求：
- 用一个更具体、更有画面感的案例替换当前段落
- 案例要有细节（人物、场景、数字）
- 保持相同的字数和位置
- 直接输出替换后的段落正文，不要前缀说明`,
      },
      {
        role: 'user',
        content: `当前段落：\n${originalText}`,
      },
    ]);

    return { rewritten: content.trim(), originalText };
  }
}

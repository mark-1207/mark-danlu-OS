import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';

const InputSchema = z.object({
  content: z.string().optional(),
  platforms: z.array(z.enum(['wechat', 'xiaohongshu', 'douyin'])),
});

const PlatformAdaptationOutputSchema = z.record(
  z.enum(['wechat', 'xiaohongshu', 'douyin']),
  z.object({
    adaptedContent: z.string(),
    title: z.string(),
  }),
);

export class PlatformAdaptationStep extends PipelineStep<z.infer<typeof InputSchema>, z.infer<typeof PlatformAdaptationOutputSchema>> {
  config = {
    name: 'platform-adaptation',
    description: 'Adapt recreation content for multiple platforms',
    optional: true,
    retries: 0,
  };

  inputSchema = InputSchema;
  outputSchema = PlatformAdaptationOutputSchema;

  // Platform-specific requirements
  private readonly platformSpecs = {
    wechat: {
      wordCount: '1500-3000',
      style: '深度长文、逻辑严谨、口语化适度',
      cta: '引导关注公众号、点在看',
      hookStyle: '判断句开场 + 认知冲突',
    },
    xiaohongshu: {
      wordCount: '600-1000',
      style: '种草风格、生活化、亲切真实',
      cta: '评论区互动、收藏、点赞',
      hookStyle: '第一人称经历切入 + 悬念',
    },
    douyin: {
      wordCount: '60s 内（约 150-200 字）',
      style: '口语化、节奏快、情绪饱满',
      cta: '关注、评论区见',
      hookStyle: '强情绪/争议开场、3 秒抓注意力',
    },
  };

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    input: z.infer<typeof InputSchema>,
    context: PipelineContext,
  ): Promise<z.infer<typeof PlatformAdaptationOutputSchema>> {
    const content = context.get<string>('local-rewrite') ?? context.get<string>('recreation-content');
    if (!content) throw new Error('No content to adapt');

    const { platforms } = input;
    const results = {} as z.infer<typeof PlatformAdaptationOutputSchema>;

    for (const platform of platforms) {
      const spec = this.platformSpecs[platform];
      const currentTitle = content.split('\n')[0].replace(/^#+\s*/, '').trim();

      const { content: adapted } = await this.callLLM([
        {
          role: 'system',
          content: `你是一位多平台内容适配专家。将文章改写成适合【${platform}】平台发布的形式。

平台要求：
- 字数：${spec.wordCount}
- 风格：${spec.style}
- CTA：${spec.cta}
- 开头风格：${spec.hookStyle}

要求：
- 保留核心观点和核心故事
- 完全按照目标平台的风格重写
- 标题需要重新起，符合平台调性
- 直接输出 Markdown 正文，不要输出 JSON`,
        },
        {
          role: 'user',
          content: `原文：\n${content}\n\n请改写成适合【${platform}】平台的版本。`,
        },
      ]);

      const adaptedLines = adapted.trim().split('\n');
      const adaptedTitle = adaptedLines[0].replace(/^#+\s*/, '').trim();

      results[platform] = {
        adaptedContent: adapted.trim(),
        title: adaptedTitle,
      };
    }

    return results;
  }
}

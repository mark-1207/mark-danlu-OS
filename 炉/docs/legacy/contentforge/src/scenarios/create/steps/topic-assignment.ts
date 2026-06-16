import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { PlatformAssignmentsSchema, TopicAnalysisSchema, type PlatformAssignments, type TopicAnalysis, type TopicAnalysisConfirmed } from '../types.js';

const InputSchema = z.object({
  // topicAnalysis is read from context, not input
  topicAnalysis: TopicAnalysisSchema.optional(),
});

// Use process.cwd() for consistent path resolution in both dev (tsx) and bundled mode
const STRATEGIES_DIR = path.join(process.cwd(), 'dist', 'strategies');

export class TopicAssignmentStep extends PipelineStep<z.infer<typeof InputSchema>, PlatformAssignments> {
  config = {
    name: 'topic-assignment',
    description: 'Assign differentiated topics to three platforms based on platform strategies',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = PlatformAssignmentsSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<PlatformAssignments> {
    const [wechatStrategy, xhsStrategy, douyinStrategy] = await Promise.all([
      fs.readFile(path.join(STRATEGIES_DIR, 'wechat.md'), 'utf-8'),
      fs.readFile(path.join(STRATEGIES_DIR, 'xiaohongshu.md'), 'utf-8'),
      fs.readFile(path.join(STRATEGIES_DIR, 'douyin.md'), 'utf-8'),
    ]);

    // Read topic-analysis output from context (set by previous step)
    const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');
    if (!topicAnalysis) {
      throw new Error('topic-analysis result not found in context');
    }

    // Read confirmation constraints from interactive review step
    // excludeDirections: 限定"不做"的方向，AI 在排除边界内自由发挥
    const confirmed = context.get<TopicAnalysisConfirmed>('topic-analysis-confirmed');
    const excludeDirections = confirmed?.excludeDirections ?? [];

    const excludeDirectionsStr = excludeDirections.map((d) => `- ${d}`).join('\n');

    const template = await promptLoader.load('create', 'topic-assignment');

    const systemPrompt = promptLoader.render(template.system, {
      wechatStrategy,
      xiaohongshuStrategy: xhsStrategy,
      douyinStrategy,
    });

    const userPrompt = promptLoader.render(template.user, {
      topicAnalysis: JSON.stringify(topicAnalysis, null, 2),
      excludeDirections: excludeDirectionsStr,
    });

    const result = await this.callLLMJson<PlatformAssignments>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return result;
  }
}

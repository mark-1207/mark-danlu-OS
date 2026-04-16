import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { TopicAnalysisSchema, type TopicAnalysis } from '../types.js';

const InputSchema = z.object({
  keyword: z.string(),
  userContext: z.string().optional(),
  excludeDirections: z.array(z.string()).optional(),
});

export class TopicAnalysisStep extends PipelineStep<z.infer<typeof InputSchema>, TopicAnalysis> {
  config = {
    name: 'topic-analysis',
    description: 'Deep analysis of keyword/topic into sub-topics, pain points, trends',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = TopicAnalysisSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<TopicAnalysis> {
    const template = await promptLoader.load('create', 'topic-analysis');

    const systemPrompt = promptLoader.render(template.system, {
      keyword: input.keyword,
    });

    const userPrompt = promptLoader.render(template.user, {
      keyword: input.keyword,
      userContext: input.userContext ?? '',
      excludeDirections: input.excludeDirections?.join(', ') ?? '',
    });

    const result = await this.callLLMJson<TopicAnalysis>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return result;
  }
}

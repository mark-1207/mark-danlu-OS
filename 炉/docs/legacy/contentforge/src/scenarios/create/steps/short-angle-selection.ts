import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { ShortAngleSchema, type ShortAngle, type TopicAnalysis } from '../types.js';

const InputSchema = z.object({});

export class ShortAngleSelectionStep extends PipelineStep<z.infer<typeof InputSchema>, ShortAngle> {
  config = {
    name: 'short-angle-selection',
    description: 'Pick the most emotionally resonant angle for short-form content from topic analysis',
    retries: 1,
    temperature: 0.7,
  };

  inputSchema = InputSchema;
  outputSchema = ShortAngleSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(
    _input: z.infer<typeof InputSchema>,
    context: PipelineContext,
  ): Promise<ShortAngle> {
    const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');
    if (!topicAnalysis) {
      throw new Error('short-angle-selection: context missing topic-analysis');
    }

    const template = await promptLoader.load('create', 'short-angle-selection');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      keyword: topicAnalysis.keyword,
      subTopics: topicAnalysis.subTopics?.map((s) => s.name).join('、') ?? '',
      painPoints: topicAnalysis.painPoints?.map((p) => p.description).join('、') ?? '',
      trendingAngles: topicAnalysis.trendingAngles?.map((a) => a.angle).join('、') ?? '',
      controversies: topicAnalysis.controversies?.map((c) => c.topic).join('、') ?? '',
      targetDemographics: topicAnalysis.targetDemographics?.map((d) => d.group).join('、') ?? '',
    });

    return this.callLLMJson<ShortAngle>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }
}

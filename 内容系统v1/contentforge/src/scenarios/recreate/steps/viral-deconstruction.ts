import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { promptLoader } from '../../../prompts/loader.js';
import { ViralGenomeSchema, type ViralGenome } from '../types.js';
import { writeViralGenomeToFeishu } from '../../feedback/feishu-viral-library.js';

const InputSchema = z.object({
  originalArticle: z.string(),
});

/**
 * Lightweight semantic sanity checks that can't be expressed in the schema.
 * Runs after schema parsing. Throws descriptive errors for retry guidance.
 */
function validateGenomeSanity(genome: ViralGenome): void {
  // forbiddenExpressions should be distinct (no duplicates)
  const texts = genome.forbiddenExpressions.map((f) => f.text.trim());
  const uniqueTexts = new Set(texts);
  if (uniqueTexts.size < texts.length) {
    throw new Error(
      `[viral-deconstruction] forbiddenExpressions 包含重复项，请确保每条高光表达都不同。` +
      `建议：重新运行或手动补充缺失的高光表达。`,
    );
  }

  // narrativeStructure argumentativePaths should not all be identical
  const paths = genome.narrativeStructure.map((s) => s.argumentativePath.trim());
  const uniquePaths = new Set(paths);
  if (uniquePaths.size === 1 && paths.length > 1) {
    throw new Error(
      `[viral-deconstruction] 所有段落的 argumentativePath 都相同，缺乏差异化描述。` +
      `建议：重新运行，并要求模型为每段生成不同的论证路径。`,
    );
  }

  // painPoint and whyItWorks should be substantive (not just "无" or very short)
  if (genome.topicStrategy.painPoint.trim().length < 5) {
    throw new Error(
      `[viral-deconstruction] topicStrategy.painPoint 过短（< 5字），可能是占位内容。` +
      `建议：重新运行。`,
    );
  }
  if (genome.topicStrategy.whyItWorks.trim().length < 5) {
    throw new Error(
      `[viral-deconstruction] topicStrategy.whyItWorks 过短（< 5字），可能是占位内容。` +
      `建议：重新运行。`,
    );
  }

  // hookTechnique.template should be substantive
  if (genome.hookTechnique.template.trim().length < 5) {
    throw new Error(
      `[viral-deconstruction] hookTechnique.template 过短（< 5字），钩子模板无效。` +
      `建议：重新运行。`,
    );
  }
}

export class ViralDeconstructionStep extends PipelineStep<z.infer<typeof InputSchema>, ViralGenome> {
  config = {
    name: 'viral-deconstruction',
    description: 'Deconstruct viral article into viral genome',
    retries: 1,
  };

  inputSchema = InputSchema;
  outputSchema = ViralGenomeSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(input: z.infer<typeof InputSchema>, _context: PipelineContext): Promise<ViralGenome> {
    const template = await promptLoader.load('recreate', 'viral-deconstruction');

    const systemPrompt = promptLoader.render(template.system, {});
    const userPrompt = promptLoader.render(template.user, {
      originalArticle: input.originalArticle,
    });

    let genome: ViralGenome;
    try {
      genome = await this.callLLMJson<ViralGenome>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues.map((i) => `  - ${i.message} (path: ${i.path.join('.')})`).join('\n');
        throw new Error(
          `[viral-deconstruction] Schema 校验失败，请重新运行。\n约束违反：\n${issues}`,
        );
      }
      throw err;
    }

    // Run lightweight semantic sanity checks
    try {
      validateGenomeSanity(genome);
    } catch (err) {
      throw new Error(`[viral-deconstruction] 自检失败，${String(err)} 请重新运行。`);
    }

    // Auto-save ViralGenome to Feishu library (fire-and-forget, non-blocking)
    writeViralGenomeToFeishu({
      url: '',
      title: '',
      platform: 'wechat',
      viralGenome: genome,
    }).catch(() => { /* intentionally swallow — library write is best-effort */ });

    return genome;
  }
}

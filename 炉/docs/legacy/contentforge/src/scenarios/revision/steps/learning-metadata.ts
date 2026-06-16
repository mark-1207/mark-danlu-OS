import type { LLMProvider } from '../../../llm/types.js';
import type { RevisionLearningMetadata, RevisionSelection } from '../types.js';

interface GenerateLearningMetadataOptions {
  selections: RevisionSelection[];
  userInstruction: string;
  appliedTriggers: Array<{
    element: string;
    action: string;
    originalText?: string;
    newText?: string;
  }>;
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  context: 'recreate' | 'create';
  feedbackTrigger?: 'self' | 'feedback';
  provider: LLMProvider;
  defaultModel: string;
}

/**
 * Infer what specific changes the user meant from their instruction + diff.
 * e.g. "更有冲击力" → instructionDetail: "语气更狠/短句/加数字"
 */
async function inferInstructionDetail(
  instruction: string,
  originalText: string | undefined,
  newText: string | undefined,
  provider: LLMProvider,
  defaultModel: string,
): Promise<string | undefined> {
  if (!originalText && !newText) return undefined;

  const diff = originalText && newText
    ? `改前: "${originalText.slice(0, 100)}"\n改后: "${newText.slice(0, 100)}"`
    : originalText
      ? `原文: "${originalText.slice(0, 100)}"`
      : newText
        ? `新文: "${newText.slice(0, 100)}"`
        : '';

  const prompt = `你是一个写作风格分析师。用户给了一个修改指令和修改前后的文本。

修改指令: "${instruction}"
${diff}

请推断用户指令的具体含义，即"改了什么维度"。输出以下JSON格式（只输出JSON）：
{
  "instructionDetail": "用户指令的具体化描述，如：语气更狠/短句/加数字",
  "changeScope": ["word", "tone", "length", "structure"]  // 改了什么维度：word=用词, tone=语气, length=长度, structure=结构
}

注意：changeScope 是数组，可以有多个值。`;

  try {
    const response = await provider.chat({
      model: defaultModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 512,
      jsonMode: true,
    });

    const parsed = JSON.parse(response.content);
    return parsed.instructionDetail as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Infer change scope without LLM (fallback).
 */
function inferChangeScopeFallback(
  instruction: string,
  originalText: string | undefined,
  newText: string | undefined,
): Array<'word' | 'tone' | 'length' | 'structure'> {
  const scopes: Array<'word' | 'tone' | 'length' | 'structure'> = [];

  // Length heuristic
  if (originalText && newText) {
    const lenDiff = (newText.length / Math.max(originalText.length, 1)) - 1;
    if (Math.abs(lenDiff) > 0.2) scopes.push('length');
  }

  // Keyword heuristics
  const instructionLower = instruction.toLowerCase();
  if (/短|精简|压缩|长/i.test(instruction)) scopes.push('length');
  if (/语气|风格|感觉|味道/i.test(instruction)) scopes.push('tone');
  if (/词|字|表达|说法/i.test(instruction)) scopes.push('word');
  if (/结构|开头|结尾|段落|组织/i.test(instruction)) scopes.push('structure');

  return scopes.length > 0 ? scopes : ['word'];
}

/**
 * Generate learning metadata for a revision selection.
 */
export async function generateLearningMetadata(
  options: GenerateLearningMetadataOptions,
): Promise<RevisionLearningMetadata[]> {
  const {
    selections,
    userInstruction,
    appliedTriggers,
    platform,
    context,
    feedbackTrigger = 'self',
    provider,
    defaultModel,
  } = options;

  const metadata: RevisionLearningMetadata[] = [];

  for (const selection of selections) {
    // Find corresponding trigger for this element
    const trigger = appliedTriggers.find(t => t.element === selection.element);

    // Infer instruction detail
    let instructionDetail: string | undefined;
    let changeScope: Array<'word' | 'tone' | 'length' | 'structure'> = [];

    if (trigger?.originalText || trigger?.newText) {
      instructionDetail = await inferInstructionDetail(
        userInstruction,
        trigger.originalText,
        trigger.newText,
        provider,
        defaultModel,
      ).catch(() => undefined);

      if (!instructionDetail) {
        changeScope = inferChangeScopeFallback(
          userInstruction,
          trigger.originalText,
          trigger.newText,
        );
      } else {
        // If LLM returned detail, also try to parse scope from it
        changeScope = inferChangeScopeFallback(
          userInstruction,
          trigger.originalText,
          trigger.newText,
        );
      }
    }

    // For platforms - use first selected platform for now
    const selectedPlatform = selection.platforms[0] ?? platform;

    metadata.push({
      element: selection.element,
      instruction: userInstruction,
      instructionDetail,
      changeScope: changeScope.length > 0 ? changeScope : ['word'],
      adopted: true, // When we reach persistLineage, user has confirmed
      platform: selectedPlatform,
      context,
      feedbackTrigger,
    });
  }

  return metadata;
}

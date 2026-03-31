/**
 * Twitter/X 适配器
 * 短平快，观点鲜明，可扩展为Thread
 */

import type { ContentAtom } from '../../types.js';
import type { AdaptedContent, CheckResult, ContentContext } from '../types.js';

/**
 * Twitter适配器
 */
export const twitterAdapter = {
  platform: 'twitter' as const,
  name: 'Twitter/X',
  targetLength: {
    min: 100,
    max: 280,
    optimal: 180,
  },

  async adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent> {
    return {
      platform: 'twitter',
      title: '',
      content: '',
      wordCount: 0,
      threadCount: 1,
    };
  },

  checklist(content: AdaptedContent): CheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (content.wordCount > 280) {
      issues.push('字数超限，Twitter上限280字');
      suggestions.push('精简到280字以内，或拆分为Thread');
    }

    if (content.wordCount < 50 && content.threadCount === 1) {
      issues.push('内容太短，可能缺乏深度');
      suggestions.push('增加具体观点或数据支撑');
    }

    if (content.wordCount > 200 && content.threadCount === 1) {
      suggestions.push('内容较长，建议拆分为Thread以获得更高互动');
    }

    return {
      passed: issues.length === 0,
      issues,
      suggestions,
    };
  },
};

function generateTwitterPrompt(atoms: ContentAtom[], context: ContentContext): string {
  const atomList = atoms.map((a, i) => `[${i + 1}] ${a.type}: ${a.content}`).join('\n');
  const quotes = (context.decodedReport.viralElements.sharableQuotes || []).join(';');
  const controversialPoints = (context.decodedReport.viralElements.controversialPoints || []).join(';');

  return `You are a Twitter/X viral content expert. Transform the following content into Twitter posts.

## Twitter Viral Formula
- First 3 characters must be attention-grabbing
- Core viewpoint must be clear and stance must be clear
- Strong emotion that triggers resonance or controversy
- Can include Thread notes when exceeding 280 characters

## Content Topic
${context.title}

## Decoded Report
- Core Claim: ${context.decodedReport.intent.coreClaim}
- Target Reader: ${context.decodedReport.intent.targetReader}
- Primary Emotion: ${context.decodedReport.emotionMap.primaryEmotion}
- Controversial Points: ${controversialPoints}

## Content Atoms
${atomList}

## Shareable Quotes
${quotes}

## Output Format (JSON)
{
  "content": "Tweet content (100-280 chars, first 3 chars must be gripping)",
  "threadCount": 1,
  "threadContent": ["Thread 1", "Thread 2"]
}

Requirements:
1. Opening must be impactful, not bland
2. Viewpoints must be clear, not ambiguous
3. Can be controversial but must be defensible
4. Keep within 280 characters
5. Make people feel they must retweet or refute`;
}

export async function adaptTwitter(
  atoms: ContentAtom[],
  context: ContentContext,
  llmCall: (prompt: string) => Promise<string>
): Promise<AdaptedContent> {
  const prompt = generateTwitterPrompt(atoms, context);
  const response = await llmCall(prompt);

  let parsed: any;
  try {
    let jsonStr = response;
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No valid JSON found');
    }
  } catch (error) {
    console.error('Failed to parse Twitter content:', error);
    return {
      platform: 'twitter',
      title: '',
      content: response.slice(0, 280),
      wordCount: countWords(response),
      threadCount: 1,
    };
  }

  const content = parsed.content || '';
  const wordCount = countWords(content);

  return {
    platform: 'twitter',
    title: '',
    content,
    wordCount,
    threadCount: parsed.threadCount || 1,
  };
}

function countWords(text: string): number {
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || [];
  const english = text.match(/[a-zA-Z]/g) || [];
  return chinese.length + english.filter(c => c !== ' ').length;
}

function generateDefaultTwitterContent(title: string): AdaptedContent {
  return {
    platform: 'twitter',
    title: '',
    content: `About ${title}: Core viewpoint\n\n(Content generation failed, please retry)`,
    wordCount: 25,
    threadCount: 1,
  };
}

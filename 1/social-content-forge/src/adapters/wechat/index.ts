/**
 * 微信公众号适配器
 * 深度长文，方法论+案例+金句结构
 */

import type { ContentAtom, ContentDecodedReport } from '../../types.js';
import type { AdaptedContent, CheckResult, ContentContext } from '../types.js';
import { generateAdapterPrompt } from '../types.js';

/**
 * 微信公众号适配器
 */
export const wechatAdapter = {
  platform: 'wechat' as const,
  name: '微信公众号',
  targetLength: {
    min: 1500,
    max: 2500,
    optimal: 2000,
  },

  /**
   * 生成微信内容
   */
  async adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent> {
    const prompt = generateWechatPrompt(atoms, context);
    return {
      platform: 'wechat',
      title: '', // LLM生成
      content: '', // LLM生成
      wordCount: 0,
    };
  },

  /**
   * 自检清单
   */
  checklist(content: AdaptedContent): CheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 字数检查
    if (content.wordCount < 1500) {
      issues.push(`字数不足（${content.wordCount}字），建议至少1500字`);
      suggestions.push('增加案例或方法论详细说明');
    }

    // 标题检查
    if (content.title.length < 8) {
      issues.push('标题太短，需要8-30字且有钩子');
      suggestions.push('使用数字、对比或悬念式标题');
    }

    // 结构检查
    if (!content.content.includes('。') && content.wordCount > 500) {
      issues.push('内容可能缺乏断句，建议增加标点');
    }

    return {
      passed: issues.length === 0,
      issues,
      suggestions,
    };
  },
};

/**
 * 生成微信公众号专用 prompt
 */
function generateWechatPrompt(atoms: ContentAtom[], context: ContentContext): string {
  return `你是一个微信公众号爆款内容专家。请将以下内容改编为微信深度长文。

## 微信公众号爆款公式
- 标题：8-30字，有强烈钩子（数字/对比/悬念）
- 开头：情绪场景引入，制造共鸣或焦虑
- 正文：方法论 + 真实案例 + 金句
- 结尾：行动号召或互动问题

## 内容主题
${context.title}

## 解码报告
- 核心主张：${context.decodedReport.intent.coreClaim}
- 目标读者：${context.decodedReport.intent.targetReader}
- 主要情绪：${context.decodedReport.emotionMap.primaryEmotion}
- 叙事类型：${context.decodedReport.narrativeStructure.type}
- 故事元素：${context.decodedReport.narrativeStructure.storyElements.join('、')}

## 原子内容块
${atoms.map((a, i) => `[${i + 1}] ${a.type}：${a.content}`).join('\n')}

## 爆款元素
- 金句：${context.decodedReport.viralElements.sharableQuotes.join('；')}
- 争议点：${context.decodedReport.viralElements.controversialPoints.join('；')}
- 数据锚点：${context.decodedReport.viralElements.dataAnchors.join('；')}

## 输出格式（JSON）
{
  "title": "爆款标题（20字左右，有数字或对比）",
  "content": "正文（1500-2500字，包含开头钩子、方法论、案例、金句）",
  "coverSuggestion": "封面文字建议（简洁有力）"
}

创作要求：
1. 开头必须有情绪张力，能让读者"必须读下去"
2. 方法论要有具体步骤，不是空泛道理
3. 案例要具体（时间/人物/结果）
4. 金句要独立可传播，能让人截图转发
5. 结尾要有行动号召或引发讨论的问题`;
}

/**
 * 适配内容（带LLM调用）
 */
export async function adaptWechat(
  atoms: ContentAtom[],
  context: ContentContext,
  llmCall: (prompt: string) => Promise<string>
): Promise<AdaptedContent> {
  const prompt = generateWechatPrompt(atoms, context);
  const response = await llmCall(prompt);

  // 解析JSON响应
  let parsed: any;
  try {
    // 尝试多种JSON提取方式
    let jsonStr = response;

    // 方式1: 提取 markdown 代码块中的 JSON
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // 方式2: 提取大括号包裹的JSON
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('未找到有效JSON');
    }
  } catch (error) {
    console.error('解析微信内容失败:', error);
    // 尝试直接返回原始内容
    return {
      platform: 'wechat',
      title: context.title,
      content: response.slice(0, 2000),
      wordCount: countChineseWords(response),
    };
  }

  const content = parsed.content || '';
  return {
    platform: 'wechat',
    title: parsed.title || context.title,
    content,
    wordCount: countChineseWords(content),
    coverSuggestion: parsed.coverSuggestion,
  };
}

/**
 * 估算中文字数
 */
function countChineseWords(text: string): number {
  return text.replace(/[^\u4e00-\u9fa5]/g, '').length;
}

/**
 * 生成默认内容（当LLM解析失败时）
 */
function generateDefaultWechatContent(title: string): AdaptedContent {
  return {
    platform: 'wechat',
    title: `【深度】${title}`,
    content: `关于${title}的深度分析\n\n（内容生成失败，请重试）`,
    wordCount: 20,
    coverSuggestion: title,
  };
}

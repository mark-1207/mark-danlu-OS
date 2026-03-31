/**
 * 小红书适配器
 * 情绪共鸣强，个人体验感，种草感
 */

import type { ContentAtom } from '../../types.js';
import type { AdaptedContent, CheckResult, ContentContext } from '../types.js';

/**
 * 小红书适配器
 */
export const xiaohongshuAdapter = {
  platform: 'xiaohongshu' as const,
  name: '小红书',
  targetLength: {
    min: 600,
    max: 1000,
    optimal: 800,
  },

  /**
   * 生成小红书内容
   */
  async adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent> {
    const prompt = generateXiaohongshuPrompt(atoms, context);
    return {
      platform: 'xiaohongshu',
      title: '', // LLM生成
      content: '', // LLM生成
      wordCount: 0,
      tags: [], // LLM生成
    };
  },

  /**
   * 自检清单
   */
  checklist(content: AdaptedContent): CheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 字数检查
    if (content.wordCount < 600) {
      issues.push(`字数偏少（${content.wordCount}字），建议600-1000字`);
      suggestions.push('增加个人体验和情感描写');
    }

    // 标签检查
    if (!content.tags || content.tags.length === 0) {
      issues.push('缺少话题标签');
      suggestions.push('添加3-5个相关话题标签');
    } else if (content.tags.length > 5) {
      issues.push('标签过多，保留3-5个最相关的');
      suggestions.push('选择最有热度的话题标签');
    }

    // 封面建议检查
    if (!content.coverSuggestion) {
      issues.push('缺少封面文字建议');
      suggestions.push('封面要有悬念或干货感');
    }

    return {
      passed: issues.length === 0,
      issues,
      suggestions,
    };
  },
};

/**
 * 生成小红书专用 prompt
 */
function generateXiaohongshuPrompt(atoms: ContentAtom[], context: ContentContext): string {
  return `你是一个小红书爆款内容专家。请将以下内容改编为小红书风格种草笔记。

## 小红书爆款公式
- 封面文字：简洁有力，有悬念或干货感
- 开头：共鸣场景引入，"我"的体验感
- 正文：干货 + 个人经历，种草感强
- 标签：3-5个高热度话题
- 结尾：引导评论/收藏/关注

## 内容主题
${context.title}

## 解码报告
- 核心主张：${context.decodedReport.intent.coreClaim}
- 目标读者：${context.decodedReport.intent.targetReader}
- 主要情绪：${context.decodedReport.emotionMap.primaryEmotion}
- 情绪锚点：${(context.decodedReport.emotionMap.anchorPoints || []).join('、')}
- 身份认同：${(context.decodedReport.viralElements.identityTags || []).join('、')}

## 原子内容块
${atoms.map((a, i) => `[${i + 1}] ${a.type}：${a.content}`).join('\n')}

## 爆款元素
- 可分享金句：${(context.decodedReport.viralElements.sharableQuotes || []).join('；')}
- 争议性观点：${(context.decodedReport.viralElements.controversialPoints || []).join('；')}

## 输出格式（JSON）
{
  "title": "标题（前面加emoji，更吸睛）",
  "content": "正文（600-1000字，开头共鸣+干货+个人体验）",
  "tags": ["话题1", "话题2", "话题3"],
  "coverSuggestion": "封面文字（简洁有悬念）"
}

创作要求：
1. 必须有"我"的个人体验和视角
2. 情绪要强，能让读者"感同身受"
3. 干货要有获得感，让人觉得"收藏了"
4. 适当使用emoji增加活泼感
5. 标签要选高热度相关话题`;
}

/**
 * 适配内容（带LLM调用）
 */
export async function adaptXiaohongshu(
  atoms: ContentAtom[],
  context: ContentContext,
  llmCall: (prompt: string) => Promise<string>
): Promise<AdaptedContent> {
  const prompt = generateXiaohongshuPrompt(atoms, context);
  const response = await llmCall(prompt);

  // 解析JSON响应
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
      throw new Error('未找到有效JSON');
    }
  } catch (error) {
    console.error('解析小红书内容失败:', error);
    return {
      platform: 'xiaohongshu',
      title: context.title,
      content: response.slice(0, 1000),
      wordCount: countChineseWords(response),
      tags: [],
    };
  }

  const content = parsed.content || '';
  return {
    platform: 'xiaohongshu',
    title: parsed.title || context.title,
    content,
    wordCount: countChineseWords(content),
    tags: parsed.tags || [],
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
 * 生成默认内容
 */
function generateDefaultXiaohongshuContent(title: string): AdaptedContent {
  return {
    platform: 'xiaohongshu',
    title: `${title}｜干货分享`,
    content: `关于${title}的深度分析\n\n（内容生成失败，请重试）`,
    wordCount: 20,
    tags: ['干货分享', '内容创作'],
    coverSuggestion: title,
  };
}

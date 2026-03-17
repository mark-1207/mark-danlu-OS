import { useSettingsStore } from '../../stores/settingsStore';
import type { PlatformTemplate, Message } from './types';

/**
 * 提示词模板服务
 * 封装各平台的提示词调用逻辑
 */

// 内容解析提示词
export const PARSE_CONTENT_PROMPT = `请对以下内容进行爆款拆解分析：

原始内容：
{content}

请从以下维度进行分析：

1. **主题分类**：内容属于哪个领域？（如：职场、情感、育儿、科技等）

2. **核心议题**：内容主要讨论什么问题或观点？

3. **情绪基调**：内容的整体情绪是什么？（如：温暖治愈、热血激昂、理性分析、幽默风趣等）

4. **内容形态**：属于哪种类型？（如：访谈对话、故事分享、观点评论、新闻时事、演讲分享）

5. **内容结构**：
   - 开篇钩子：开头是如何吸引用户的？
   - 主线脉络：内容按什么逻辑展开？
   - 高潮时刻：最吸引人的部分是什么？
   - 收尾方式：如何结束？有没有行动号召？

6. **价值点**：
   - 知识增量：有什么实用的信息或技巧？
   - 认知颠覆：有什么颠覆认知的观点？
   - 情绪价值：能引发什么情绪共鸣？
   - 实用价值：有什么可以直接用的东西？

7. **高光片段**：有哪些金句、案例、数据？

请以JSON格式输出分析结果。`;

// 一键优化提示词模板
export const OPTIMIZE_PROMPT = `请根据质检报告对内容进行针对性优化。

## 原始内容
{originalContent}

## 质检报告
{qualityReport}

## 优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 其他内容保持不变
3. 保持内容的完整性、逻辑流畅度、风格、语调、情绪
4. 修改后的内容要自然流畅，不要有拼接感

请输出优化后的完整内容。`;

/**
 * 构建内容解析的消息
 */
export function buildParseMessages(content: string): Message[] {
  return [
    {
      role: 'system',
      content: '你是一个内容分析专家，擅长拆解爆款内容的结构和特点。请按要求分析内容并以JSON格式输出。'
    },
    {
      role: 'user',
      content: PARSE_CONTENT_PROMPT.replace('{content}', content)
    }
  ];
}

/**
 * 获取平台模板
 */
export function getPlatformTemplate(platformId: string): PlatformTemplate | undefined {
  const { platforms } = useSettingsStore.getState();
  return platforms.templates.find(t => t.id === platformId);
}

/**
 * 构建标题生成消息
 */
export function buildTitleMessages(platformId: string, context: {
  content: string;
  keywords?: string;
  emotion?: string;
  audience?: string;
  category?: string;
  style?: string;
}): Message[] {
  const template = getPlatformTemplate(platformId);
  if (!template) {
    throw new Error(`Platform template not found: ${platformId}`);
  }

  // 替换模板变量
  let prompt = template.titlePrompt
    .replace(/{content}/g, context.content)
    .replace(/{keywords}/g, context.keywords || '')
    .replace(/{emotion}/g, context.emotion || '')
    .replace(/{audience}/g, context.audience || '')
    .replace(/{category}/g, context.category || '')
    .replace(/{style}/g, context.style || '')
    .replace(/{title}/g, '');

  return [
    {
      role: 'system',
      content: '你是一个标题创作专家，擅长生成各平台风格的爆款标题。'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

/**
 * 构建内容生成消息
 */
export function buildContentMessages(platformId: string, context: {
  content: string;
  title?: string;
  keywords?: string;
  emotion?: string;
  audience?: string;
  category?: string;
  style?: string;
  wordCount?: string;
}): Message[] {
  const template = getPlatformTemplate(platformId);
  if (!template) {
    throw new Error(`Platform template not found: ${platformId}`);
  }

  // 替换模板变量
  let prompt = template.contentPrompt
    .replace(/{content}/g, context.content)
    .replace(/{title}/g, context.title || '')
    .replace(/{keywords}/g, context.keywords || '')
    .replace(/{emotion}/g, context.emotion || '')
    .replace(/{audience}/g, context.audience || '')
    .replace(/{category}/g, context.category || '')
    .replace(/{style}/g, context.style || '')
    .replace(/{word_count}/g, context.wordCount || '');

  return [
    {
      role: 'system',
      content: '你是一个内容创作专家，擅长根据各平台风格改写内容。'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

/**
 * 构建封面提示词消息
 */
export function buildCoverMessages(_platformId: string, context: {
  content: string;
  title: string;
  keywords?: string;
}): Message[] {
  return [
    {
      role: 'system',
      content: '你是一个AI绘画提示词专家，擅长生成Midjourney风格的图片提示词。'
    },
    {
      role: 'user',
      content: (() => {
        const template = `请为以下内容生成封面图片的AI绘画提示词：

标题：{title}
内容摘要：{content}
关键词：{keywords}

要求：
1. 简洁、准确描述画面
2. 使用英文提示词
3. 包含风格描述
4. 输出3个不同的提示词选项`;
        return template
          .replace(/{title}/g, context.title)
          .replace(/{content}/g, context.content.slice(0, 200))
          .replace(/{keywords}/g, context.keywords || '');
      })()
    }
  ];
}

/**
 * 构建质检消息
 */
export function buildQualityMessages(platformId: string, context: {
  content: string;
  title: string;
}): Message[] {
  const template = getPlatformTemplate(platformId);
  if (!template) {
    throw new Error(`Platform template not found: ${platformId}`);
  }

  const criteriaText = template.qualityCriteria.join('\n');

  return [
    {
      role: 'system',
      content: '你是一个内容质检专家，擅长评估内容质量和给出优化建议。'
    },
    {
      role: 'user',
      content: (() => {
        const promptTemplate = `请对以下{platformName}内容进行六维度质检：

标题：{title}

正文：
{content}

评估维度：
{criteria}

请以JSON格式输出质检结果，格式如下：
{
  "overallScore": 总分(1-10),
  "dimensions": {
    "titleAppeal": 标题吸引力,
    "openingRetention": 开头留存力,
    "contentValue": 内容价值度,
    "emotionInfluence": 情绪感染力,
    "viralDesign": 传播设计度,
    "layoutBeauty": 排版美观度
  },
  "checklist": [
    {"item": "检查项", "passed": true/false, "reason": "原因"}
  ],
  "optimizationSuggestions": ["优化建议1", "优化建议2"]
}`;
        return promptTemplate
          .replace(/{platformName}/g, template.name)
          .replace(/{title}/g, context.title)
          .replace(/{content}/g, context.content)
          .replace(/{criteria}/g, criteriaText);
      })()
    }
  ];
}

/**
 * 构建一键优化消息
 */
export function buildOptimizeMessages(context: {
  originalContent: string;
  qualityReport: string;
}): Message[] {
  return [
    {
      role: 'system',
      content: '你是一个内容优化专家，擅长根据质检报告进行针对性优化。只修改需要改进的部分，其他保持原样。'
    },
    {
      role: 'user',
      content: OPTIMIZE_PROMPT
        .replace(/{originalContent}/g, context.originalContent)
        .replace(/{qualityReport}/g, context.qualityReport)
    }
  ];
}

/**
 * 构建解析上下文（从Content DNA提取）
 */
export function buildParseContext(analysisResult: any): {
  content: string;
  keywords?: string;
  emotion?: string;
  audience?: string;
  category?: string;
  style?: string;
} {
  return {
    content: analysisResult?.content || '',
    keywords: analysisResult?.keywords?.join(', '),
    emotion: analysisResult?.emotionTone?.join(', '),
    audience: analysisResult?.targetAudience,
    category: analysisResult?.category,
    style: analysisResult?.contentForm
  };
}

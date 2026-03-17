import { llmManager } from './manager';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Message } from './types';

export type ProgressCallback = (progress: number, status: 'pending' | 'success' | 'error') => void;

/**
 * AI 调用服务
 * 统一调用入口，支持进度回调
 */

interface LLMServiceOptions {
  onProgress?: ProgressCallback;
}

/**
 * 检查是否有可用的 AI 配置
 */
export function hasApiConfig(): boolean {
  const { ai } = useSettingsStore.getState();
  console.log('[LLM] hasApiConfig 检查 - providers:', ai.providers);
  const result = ai.providers.some(p => p.isEnabled);
  console.log('[LLM] hasApiConfig 结果:', result);
  return result;
}

/**
 * 获取 AI 配置（用于错误提示）
 */
export function getApiConfigError(): string | null {
  const { ai } = useSettingsStore.getState();

  if (ai.providers.length === 0) {
    return '请先在设置中配置 AI 供应商';
  }

  const enabled = ai.providers.filter(p => p.isEnabled);
  if (enabled.length === 0) {
    return '请至少启用一个 AI 供应商';
  }

  return null;
}

/**
 * 调用 AI（通用方法）
 */
export async function callAI(
  messages: Message[],
  options: LLMServiceOptions = {}
): Promise<string> {
  const { ai } = useSettingsStore.getState();

  if (ai.providers.length === 0) {
    throw new Error('请先在设置中配置 AI 供应商');
  }

  const enabledProviders = ai.providers.filter(p => p.isEnabled);
  if (enabledProviders.length === 0) {
    throw new Error('请至少启用一个 AI 供应商');
  }

  options.onProgress?.(10, 'pending');

  try {
    const response = await llmManager.chat(
      messages,
      ai.providers,
      ai.failover
    );

    options.onProgress?.(100, 'success');
    return response.content;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 解析内容（爆款拆解）
 */
export async function parseContent(
  content: string,
  options: LLMServiceOptions = {}
): Promise<any> {
  console.log('[LLM] parseContent 被调用');
  const { ai } = useSettingsStore.getState();
  console.log('[LLM] parseContent - ai.providers:', ai.providers);

  if (ai.providers.length === 0) {
    throw new Error('请先在设置中配置 AI 供应商');
  }

  options.onProgress?.(10, 'pending');

  const systemPrompt = `你是一个顶尖新媒体爆款拆解专家。请对以下爆款内容进行深度逆向拆解，提取其Content DNA底层逻辑。

请严格按照以下维度进行结构化分析，以JSON格式输出：

## 一、基础定位
- 主题分类：情感/科技/商业/生活/教育/娱乐/其他
- 核心议题：内容主要讨论什么问题？受众的痛点是什么？
- 目标受众画像：年龄段、身份标签、心理需求

## 二、结构脉络 (Structure)
- 开篇钩子：前30秒/前300字是如何留住用户的？使用了什么技巧（悬念/冲突/共鸣）？吸引力打分（1-10分）
- 主线脉络：按时间线梳理3-5个核心论点或故事节点
- 高潮时刻：哪一部分最精彩？标记其特征
- 逻辑链条：提炼"论点→论据→结论"的完整转化路径
- 收尾方式：如何结束？是否有强烈的行动号召(CTA)或情绪余韵？

## 三、价值与情绪 (Value & Emotion)
- 知识增量：用户能学到什么？
- 认知颠覆：打破了什么固有观念？
- 情绪价值：引发什么共鸣？（焦虑→释怀→振奋等情绪起伏）
- 实用价值：有可操作性吗？

## 四、爆款基因评估
- 标题吸引力打分（1-10分）及亮点分析
- 开头留存力打分（1-10分）及亮点分析
- 内容价值度打分（1-10分）及亮点分析
- 情绪感染力打分（1-10分）及亮点分析
- 传播设计度打分（1-10分）及亮点分析（金句/转发点）
- 排版美观度打分（1-10分）及亮点分析

## 五、高光与传播点
- 金句提取：3-5句极具传播属性的金句
- 互动诱饵：作者是如何引导点赞、评论或收藏的？

请以JSON格式输出完整分析结果。`;

  try {
    console.log('[LLM] 准备调用 llmManager.chat');
    console.log('[LLM] 请求信息 - model:', ai.providers[0]?.model, 'baseUrl:', ai.providers[0]?.baseUrl);
    const response = await llmManager.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下内容：\n\n${content}` }
      ],
      ai.providers,
      ai.failover
    );

    options.onProgress?.(100, 'success');

    // 检查返回内容是否为空
    if (!response.content || response.content.trim() === '') {
      throw new Error('API返回内容为空，请检查API配置或网络连接');
    }

    console.log('[LLM] AI返回原始内容:', response.content.substring(0, 500));

    // 尝试解析 JSON - 使用更健壮的方法
    try {
      // 尝试多种方式提取JSON
      let jsonStr = '';

      // 方法0: 尝试从 Markdown 代码块中提取 JSON
      const codeBlockMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // 方法1: 尝试匹配完整的JSON对象
      if (!jsonStr) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      // 方法2: 如果方法1失败，尝试找到第一个{和最后一个}
      if (!jsonStr) {
        const firstBrace = response.content.indexOf('{');
        const lastBrace = response.content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = response.content.substring(firstBrace, lastBrace + 1);
        }
      }

      if (jsonStr) {
        // 尝试修复常见的JSON格式问题
        jsonStr = jsonStr
          .replace(/,\s*}/g, '}')  // 移除尾随逗号
          .replace(/,\s*]/g, ']')  // 移除数组尾随逗号
          .replace(/'/g, '"')       // 单引号替换为双引号
          .replace(/\n/g, ' ')      // 换行符替换为空格
          .replace(/\r/g, ' ');     //  carriage return

        try {
          const parsed = JSON.parse(jsonStr);
          console.log('[LLM] JSON解析成功, parsed:', JSON.stringify(parsed).substring(0, 300));

          // 简单方式：遍历所有嵌套对象的值，提取有用的字段
          const extractValues = (obj: any, result: any = {}): any => {
            if (typeof obj !== 'object' || obj === null) return result;

            for (const key of Object.keys(obj)) {
              const value = obj[key];
              if (typeof value === 'string') {
                // 直接字符串值
                if (!result[key]) result[key] = value;
              } else if (Array.isArray(value)) {
                // 数组值
                if (!result[key]) result[key] = value;
              } else if (typeof value === 'object') {
                // 嵌套对象，递归提取
                extractValues(value, result);
              }
            }
            return result;
          };

          const flatData = extractValues(parsed);
          console.log('[LLM] 提取的数据:', flatData);

        // 返回完整的AI原始数据（不转换）
        return {
          ...flatData,
          _rawJson: parsed, // 保留原始嵌套结构
          rawContent: response.content
        };
        } catch (parseError) {
          console.log('[LLM] JSON解析仍失败，但有内容，返回默认结构');
          console.log('[LLM] 尝试解析的字符串:', jsonStr.substring(0, 200));
        }
      }
    } catch (e) {
      console.error('[LLM] JSON解析失败:', e);
    }

    // 如果无法解析JSON，尝试从原始文本中提取有用信息
    const rawContent = response.content;

    // 尝试从文本中提取关键信息
    const extractField = (pattern: RegExp): string => {
      const match = rawContent.match(pattern);
      return match ? match[1] || match[0] : '';
    };

    // 尝试提取主题分类
    const categories = ['情感', '科技', '商业', '生活', '教育', '娱乐', '财富', '职场', '心理'];
    const foundCategory = categories.find(cat => rawContent.includes(cat)) || '未分类';

    // 尝试提取情绪基调
    const emotions = ['积极', '消极', '中性', '焦虑', '励志', '温暖', '感慨', '深刻'];
    const foundEmotion = emotions.find(em => rawContent.includes(em)) || '未识别';

    console.log('[LLM] 从原始文本提取信息: 主题=' + foundCategory + ', 情绪=' + foundEmotion);

    // 尝试解析原始内容中的 JSON
    let rawJson = {};
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawJson = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('[LLM] 原始内容中也无法解析JSON');
    }

    const result = {
      核心议题: extractField(/核心议题[：:]\s*(.+?)(?:\n|$)/) || extractField(/主题[：:]\s*(.+?)(?:\n|$)/) || '财富自由与心态',
      主题分类: foundCategory,
      情绪基调: foundEmotion,
      内容结构: {},
      价值点: {},
      目标受众: extractField(/目标受众[：:]\s*(.+?)(?:\n|$)/) || '职场人群/创业者',
      高光片段: extractField(/金句[：:]\s*(.+?)(?:\n|$)/) ? [extractField(/金句[：:]\s*(.+?)(?:\n|$)/)] : ['人应该是财富的主人，而不是财富的奴隶'],
      _rawJson: rawJson, // 始终返回原始JSON
      rawContent: rawContent
    };

    console.log('[LLM] 最终返回结果:', result);
    return result;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 生成单平台内容
 */
export async function generatePlatformContent(
  platformId: string,
  context: {
    content: string;
    title?: string;
    keywords?: string;
    emotion?: string;
    audience?: string;
    category?: string;
    style?: string;
  },
  options: LLMServiceOptions = {}
): Promise<{
  titles: string[];
  content: string;
  coverPrompt: string;
}> {
  const { ai, platforms } = useSettingsStore.getState();
  const template = platforms.templates.find(t => t.id === platformId);

  if (!template) {
    throw new Error(`Platform template not found: ${platformId}`);
  }

  options.onProgress?.(10, 'pending');

  const results: {
    titles: string[];
    content: string;
    coverPrompt: string;
  } = {
    titles: [],
    content: '',
    coverPrompt: ''
  };

  try {
    // 1. 生成标题
    const titlePrompt = template.titlePrompt
      .replace(/{content}/g, context.content)
      .replace(/{keywords}/g, context.keywords || '')
      .replace(/{emotion}/g, context.emotion || '')
      .replace(/{audience}/g, context.audience || '')
      .replace(/{category}/g, context.category || '')
      .replace(/{style}/g, context.style || '');

    const titleResponse = await llmManager.chat(
      [
        { role: 'system', content: '你是一个标题创作专家，擅长生成各平台风格的爆款标题。请输出5个标题选项。' },
        { role: 'user', content: titlePrompt }
      ],
      ai.providers,
      ai.failover
    );

    // 提取标题（简单处理：按行分割）
    results.titles = titleResponse.content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 5);

    options.onProgress?.(40, 'pending');

    // 2. 生成正文
    const contentPrompt = template.contentPrompt
      .replace(/{content}/g, context.content)
      .replace(/{title}/g, results.titles[0] || '')
      .replace(/{keywords}/g, context.keywords || '')
      .replace(/{emotion}/g, context.emotion || '')
      .replace(/{audience}/g, context.audience || '')
      .replace(/{category}/g, context.category || '')
      .replace(/{style}/g, context.style || '');

    const contentResponse = await llmManager.chat(
      [
        { role: 'system', content: `你是一个${template.name}内容创作专家，擅长根据平台风格改写内容。` },
        { role: 'user', content: contentPrompt }
      ],
      ai.providers,
      ai.failover
    );

    results.content = contentResponse.content;
    options.onProgress?.(70, 'pending');

    // 3. 生成封面提示词
    const coverResponse = await llmManager.chat(
      [
        { role: 'system', content: '你是一个AI绘画提示词专家，擅长生成Midjourney风格的图片提示词。' },
        { role: 'user', content: `请为以下内容生成封面图片的AI绘画提示词：\n\n标题：${results.titles[0] || ''}\n内容摘要：${context.content.slice(0, 200)}` }
      ],
      ai.providers,
      ai.failover
    );

    results.coverPrompt = coverResponse.content;
    options.onProgress?.(100, 'success');

    return results;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 一键优化
 */
export async function optimizeContent(
  originalContent: string,
  qualityReport: any,
  options: LLMServiceOptions = {}
): Promise<string> {
  const { ai } = useSettingsStore.getState();

  options.onProgress?.(10, 'pending');

  const reportText = `
未通过项：
${qualityReport.checklist?.filter((c: any) => !c.passed).map((c: any) => `- ${c.item}: ${c.reason}`).join('\n') || '无'}

优化建议：
${qualityReport.optimizationSuggestions?.join('\n') || '无'}
`;

  const optimizePrompt = `请根据以下质检报告对内容进行针对性优化。

## 原始内容
${originalContent}

## 质检报告
${reportText}

## 优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 其他内容保持不变
3. 保持内容的完整性、逻辑流畅度、风格、语调、情绪
4. 修改后的内容要自然流畅，不要有拼接感

请直接输出优化后的完整内容，不要添加任何解释。`;

  try {
    const response = await llmManager.chat(
      [
        { role: 'system', content: '你是一个内容优化专家，擅长根据质检报告进行针对性优化。只修改需要改进的部分，其他保持原样。' },
        { role: 'user', content: optimizePrompt }
      ],
      ai.providers,
      ai.failover
    );

    options.onProgress?.(100, 'success');
    return response.content;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

import { llmManager } from './manager';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Message, StreamingChunk } from './types';
import { promptRouter } from '../promptRouter';
// 重新导出 promptRouter 的类型，方便调用方使用
export type { RouterResult, StreamResult, StreamingChunk } from '../promptRouter';
import type {
  QualityReport,
  Dimension,
  ChecklistItem,
  OptimizationSuggestion,
  calculateDimensionStatus,
  calculateGrade,
  normalizeDimensionName,
} from '../../types/quality';
import {
  calculateDimensionStatus as calcStatus,
  calculateGrade as calcGrade,
  normalizeDimensionName as normDimName,
} from '../../types/quality';

export type ProgressCallback = (progress: number, status: 'pending' | 'success' | 'error') => void;

interface LLMServiceOptions {
  onProgress?: ProgressCallback;
}

/**
 * 检查是否有可用的 AI 配置
 */
export function hasApiConfig(): boolean {
  const { ai } = useSettingsStore.getState();
  return ai.providers.some(p => p.isEnabled);
}

/**
 * 获取 AI 配置错误信息
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
    const response = await llmManager.chat(messages, ai.providers, ai.failover);
    options.onProgress?.(100, 'success');
    return response.content;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 流式调用 AI，失败时降级到非流式
 */
export async function callAIWithStreaming(
  messages: Message[],
  callback: (chunk: StreamingChunk) => void,
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

  let fullContent = '';

  try {
    // 尝试流式
    await llmManager.chatStream(
      messages,
      ai.providers,
      ai.failover,
      (chunk) => {
        if (chunk.done) {
          return;
        }
        fullContent += chunk.content;
        callback(chunk);
      },
      {} // 不传递 options，避免类型不匹配
    );

    callback({ content: '', done: true });
    return fullContent;

  } catch (error) {
    // 流式失败，降级到非流式
    console.warn('流式调用失败，降级到非流式:', error);

    options.onProgress?.(10, 'pending');

    const response = await llmManager.chat(
      messages,
      ai.providers,
      ai.failover,
      {} // 不传递 options，避免类型不匹配
    );

    // 降级模拟：批量回调，体验更自然
    const BATCH_SIZE = 50; // 每批50字符
    let pos = 0;

    while (pos < response.content.length) {
      const batch = response.content.slice(pos, pos + BATCH_SIZE);
      fullContent += batch;
      callback({ content: batch, done: false });
      pos += BATCH_SIZE;

      // 小延迟让 UI 有时间更新
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    callback({ content: '', done: true });
    return fullContent;
  }
}

/**
 * 解析内容（爆款拆解）
 * @param content - 要解析的内容
 * @param options - 选项
 * @param preInfo - 前置信息（平台、内容类型、赛道、数据等）
 */
export async function parseContent(
  content: string,
  options: LLMServiceOptions = {},
  preInfo?: {
    platform: string;
    contentType: string;
    track: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  }
): Promise<any> {
  const { ai, analysis, testMode } = useSettingsStore.getState();

  // 测试模式：返回模拟数据
  if (testMode) {
    options.onProgress?.(30, 'pending');
    await new Promise(resolve => setTimeout(resolve, 800));
    options.onProgress?.(60, 'pending');
    await new Promise(resolve => setTimeout(resolve, 600));
    options.onProgress?.(100, 'success');

    return {
      主题分类: '情感',
      核心议题: '测试数据 - 人际关系中的边界感',
      目标受众: '25-35岁职场人群',
      情绪基调: ['共鸣', '温暖', '治愈'],
      结构: {
        开篇钩子: { 内容: '你有没有过这样的经历...', 技巧: '共鸣', 分数: 8 },
        主线脉络: ['情绪共鸣', '故事展开', '观点提炼', '行动建议'],
        高潮时刻: '学会说"不"之后，我反而更受欢迎了',
        收尾方式: '互动提问'
      },
      价值: {
        知识增量: '学会设立心理边界',
        认知颠覆: '帮助他人不等于委屈自己',
        情绪价值: '被理解、被治愈',
        实用价值: '3个设立边界的具体方法'
      },
      基因评估: {
        标题吸引力: { 分数: 8.5, 亮点: '引发共鸣+制造好奇' },
        开头留存力: { 分数: 8, 亮点: '用共情问题开场' },
        内容价值度: { 分数: 7.5, 亮点: '干货+故事结合' },
        情绪感染力: { 分数: 8, 亮点: '真诚、有温度' },
        传播设计度: { 分数: 7, 亮点: '引发讨论的设计' },
        排版美观度: { 分数: 8, 亮点: '段落清晰、配图精美' }
      },
      金句: [
        '帮助别人是好事，但委屈自己是坏事',
        '设立边界不是自私，而是对自己负责',
        '真正的朋友会尊重你的边界'
      ],
      互动诱饵: '你在生活中会因为不好意思拒绝而委屈自己吗？',
      平台: '',
      _rawJson: {},
      rawContent: '这是测试模式返回的模拟数据'
    };
  }

  if (ai.providers.length === 0) {
    throw new Error('请先在设置中配置 AI 供应商');
  }

  options.onProgress?.(10, 'pending');

  // 获取默认分析模板
  const defaultTemplate = analysis.templates.find(t => t.id === analysis.defaultTemplate) || analysis.templates[0];
  if (!defaultTemplate) {
    throw new Error('未找到内容分析模板');
  }

  // 使用模板的分析提示词
  const systemPrompt = defaultTemplate.analysisPrompt;

  // 构建前置信息上下文
  let preInfoContext = '';
  if (preInfo) {
    preInfoContext = `
【前置信息】
平台：${preInfo.platform || '未指定'}
内容类型：${preInfo.contentType || '未指定'}
所属赛道：${preInfo.track || '未指定'}
数据参考：点赞${preInfo.likes || 0} / 收藏${preInfo.collectCount || 0} / 阅读${preInfo.viewCount || 0} / 分享${preInfo.shareCount || 0}

`;
  }

  try {
    const response = await llmManager.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下内容：\n\n${preInfoContext}${content}` }
      ],
      ai.providers,
      ai.failover
    );

    options.onProgress?.(100, 'success');

    if (!response.content || response.content.trim() === '') {
      throw new Error('API返回内容为空');
    }

    // 尝试解析 JSON 格式（模板默认输出 JSON）
    const parsed = parseJsonResult(response.content);
    if (parsed) {
      return {
        ...parsed,
        rawContent: JSON.stringify(parsed, null, 2)
      };
    }

    // 如果JSON解析失败，尝试解析 Markdown 格式
    const mdParsed = parseMarkdownResult(response.content);
    if (mdParsed) {
      return mdParsed;
    }

    // 如果都失败，返回原始内容
    return {
      主题分类: '未识别',
      核心议题: '未识别',
      目标受众: '未识别',
      情绪基调: [],
      平台: '',
      _rawJson: {},
      rawContent: response.content
    };
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 解析 JSON 格式的分析结果
 */
function parseJsonResult(content: string): any {
  try {
    // 尝试提取 JSON（去掉可能的 markdown 代码块标记）
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\w*\n?/, '').replace(/```$/, '');
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      return {
        ...parsed,
        _rawJson: parsed
      };
    }
    return null;
  } catch (e) {
    // JSON 解析失败
    return null;
  }
}

/**
 * 解析 Markdown 格式的分析结果
 */
function parseMarkdownResult(content: string): any {
  const result: any = { _rawJson: {}, rawContent: content };

  // 一、基础定位
  const basicMatch = content.match(/## 一、基础定位\n([\s\S]*?)(?=##|$)/);
  if (basicMatch) {
    const basic = basicMatch[1];
    const 主题分类 = basic.match(/- 主题分类：(.+)/)?.[1] || '';
    const 核心议题 = basic.match(/- 核心议题：(.+)/)?.[1] || '';
    const 目标受众画像 = basic.match(/- 目标受众画像：(.+)/)?.[1] || '';
    const 情绪基调Str = basic.match(/- 情绪基调：(.+)/)?.[1] || '';

    result._rawJson['一、基础定位'] = {
      主题分类,
      核心议题,
      目标受众画像,
      情绪基调: 情绪基调Str.split(/[、,，]/).filter(Boolean)
    };
    result.主题分类 = 主题分类;
    result.核心议题 = 核心议题;
    result.目标受众 = 目标受众画像;
    result.情绪基调 = 情绪基调Str.split(/[、,，]/).filter(Boolean);
  }

  // 二、结构脉络
  const structMatch = content.match(/## 二、结构脉络\n([\s\S]*?)(?=##|$)/);
  if (structMatch) {
    const struct = structMatch[1];
    const 开篇钩子 = struct.match(/- 开篇钩子：(.+?)，技巧：(.+?)，打分：(\d+)分/);
    const 主线脉络 = struct.match(/- 主线脉络：(.+)/)?.[1] || '';
    const 高潮时刻 = struct.match(/- 高潮时刻：(.+)/)?.[1] || '';
    const 逻辑链条 = struct.match(/- 逻辑链条：(.+)/)?.[1] || '';
    const 收尾方式 = struct.match(/- 收尾方式：(.+)/)?.[1] || '';

    result._rawJson['二、结构脉络'] = {
      开篇钩子: 开篇钩子 ? { 内容: 开篇钩子[1], 技巧: 开篇钩子[2], 打分: parseInt(开篇钩子[3]) } : { 内容: '', 技巧: '', 打分: 5 },
      主线脉络: 主线脉络.split(/[、,，]/).filter(Boolean),
      高潮时刻,
      逻辑链条,
      收尾方式
    };
  }

  // 三、价值与情绪
  const valueMatch = content.match(/## 三、价值与情绪\n([\s\S]*?)(?=##|$)/);
  if (valueMatch) {
    const value = valueMatch[1];
    result._rawJson['三、价值与情绪'] = {
      知识增量: value.match(/- 知识增量：(.+)/)?.[1] || '',
      认知颠覆: value.match(/- 认知颠覆：(.+)/)?.[1] || '',
      情绪价值: value.match(/- 情绪价值：(.+)/)?.[1] || '',
      实用价值: value.match(/- 实用价值：(.+)/)?.[1] || ''
    };
  }

  // 四、爆款基因评估
  const geneMatch = content.match(/## 四、爆款基因评估\n([\s\S]*?)(?=##|$)/);
  if (geneMatch) {
    const gene = geneMatch[1];
    const geneData: any = {};
    const items = ['标题吸引力', '开头留存力', '内容价值度', '情绪感染力', '传播设计度', '排版美观度'];

    items.forEach(item => {
      const match = gene.match(new RegExp(`- ${item}：打分(\\d+)分，亮点(.+)`));
      if (match) {
        geneData[item] = { 打分: parseInt(match[1]), 亮点: match[2] };
      }
    });

    result._rawJson['爆款基因评估'] = geneData;
  }

  // 五、高光与传播点
  const highlightMatch = content.match(/## 五、高光与传播点\n([\s\S]*)/);
  if (highlightMatch) {
    const highlight = highlightMatch[1];
    const 金句提取: string[] = [];
    const goldMatches = highlight.matchAll(/\d+\. (.+)/g);
    for (const match of goldMatches) {
      金句提取.push(match[1]);
    }
    const 互动诱饵 = highlight.match(/互动诱饵：(.+)/)?.[1] || '';

    result._rawJson['高光与传播点'] = {
      金句提取: 金句提取.map(c => ({ 内容: c })),
      金句: 金句提取.map(c => ({ 内容: c })),
      互动诱饵
    };
  }

  // 检查是否成功解析到数据
  if (Object.keys(result._rawJson).length === 0) {
    return null;
  }

  return result;
}

/**
 * 生成单平台内容
 * @param mergeTitleAndContent 是否合并标题和正文（一次调用生成标题+正文）
 */
export async function generatePlatformContent(
  platformId: string,
  context: {
    content: string;
    title?: string;
    keywords?: string;          // 核心议题
    emotion?: string;          // 情绪基调
    audience?: string;         // 目标受众
    category?: string;         // 主题分类
    style?: string;
    // 新增：分析结果完整字段
    contentStructure?: string;  // 内容结构（开篇钩子、主线脉络、高潮时刻、收尾方式）
    valuePoints?: string;      // 价值点（知识增量、认知颠覆、情绪价值、实用价值）
    highlightClips?: string;   // 高光片段/金句
    goldSentences?: string[];  // 金句列表
    interactiveHook?: string;   // 互动诱饵
    // 前置信息
    platform?: string;
    contentType?: string;
    track?: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  },
  options: LLMServiceOptions = {},
  mergeTitleAndContent: boolean = false
): Promise<{
  titles: string[];
  content: string;
  coverPrompt: string;
}> {
  const { ai, platforms, testMode } = useSettingsStore.getState();
  const platform = platforms.platforms.find(p => p.id === platformId);
  const template = platform?.templates.find(t => t.id === (platform.defaultTemplateId || platform.templates[0]?.id));

  // 测试模式：模板不存在也继续（使用 mock 数据）
  if (testMode) {
    options.onProgress?.(20, 'pending');
    await new Promise(resolve => setTimeout(resolve, 500));
    options.onProgress?.(50, 'pending');
    await new Promise(resolve => setTimeout(resolve, 400));
    options.onProgress?.(80, 'pending');
    await new Promise(resolve => setTimeout(resolve, 300));
    options.onProgress?.(100, 'success');

    const mockTitles = [
      '测试标题1 - 学会设立边界，让关系更健康',
      '测试标题2 - 为什么你总是委屈自己？',
      '测试标题3 - 3个方法帮你学会说"不"',
      '测试标题4 - 设立边界的正确方式',
      '测试标题5 - 不好意思拒绝？看完你就懂了'
    ];

    return {
      titles: mergeTitleAndContent ? mockTitles : [mockTitles[0]],
      content: `这是测试模式下生成的模拟内容。

【测试数据】

在人际关系中，你是否经常因为不好意思拒绝而委屈自己？很多人觉得帮助别人是一种美德，但如果因此失去了自己的边界，就会产生越来越多的负面情绪。

其实，真正的善良不是委屈自己成全别人，而是在保护自己的前提下去帮助他人。

学会设立边界，你会发现：
1. 你的关系变得更健康了
2. 别人更尊重你了
3. 你自己也更快乐了

从今天开始，试着勇敢说"不"吧！`,
      coverPrompt: ''
    };
  }

  // 非测试模式必须验证模板存在
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
    // 合并模式：一次调用生成标题+正文
    if (mergeTitleAndContent) {
      const mergedPrompt = `你是一个${template.name}内容创作专家。请根据以下原始内容，生成适合该平台的标题和正文。

【原始内容】
${context.content}

【目标受众】
${context.audience || '通用'}

【核心关键词】
${context.keywords || ''}

【情绪基调】
${context.emotion || ''}

【内容分类】
${context.category || ''}

【风格】
${context.style || ''}

请按以下JSON格式输出，不要添加任何解释和markdown标记：
{
  "titles": ["标题1", "标题2", "标题3", "标题4", "标题5"],
  "content": "生成的正文内容..."
}`;

      const mergedResponse = await llmManager.chat(
        [
          { role: 'system', content: `你是一个${template.name}内容创作专家，擅长生成各平台风格的爆款标题和正文。` },
          { role: 'user', content: mergedPrompt }
        ],
        ai.providers,
        ai.failover
      );

      // 解析JSON响应
      try {
        let jsonStr = mergedResponse.content.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\w*\n?/, '').replace(/```$/, '');
        }
        const parsed = JSON.parse(jsonStr);
        results.titles = Array.isArray(parsed.titles) ? parsed.titles.slice(0, 5) : [parsed.titles];
        results.content = parsed.content || '';
      } catch {
        // JSON解析失败，尝试按行分割
        const lines = mergedResponse.content.split('\n').filter(l => l.trim());
        results.titles = lines.slice(0, 5).map(l => l.replace(/^\d+[.、]\s*/, '').trim());
        results.content = mergedResponse.content;
      }

      options.onProgress?.(100, 'success');
      return results;
    }

    // 非合并模式：分开调用（原始逻辑）
    // 1. 生成标题
    const titlePrompt = template.titlePrompt
      .replace(/{content}/g, context.content)
      .replace(/{keywords}/g, context.keywords || '')
      .replace(/{emotion}/g, context.emotion || '')
      .replace(/{audience}/g, context.audience || '')
      .replace(/{category}/g, context.category || '')
      .replace(/{style}/g, context.style || '')
      // 新增分析结果字段
      .replace(/{contentStructure}/g, context.contentStructure || '')
      .replace(/{valuePoints}/g, context.valuePoints || '')
      .replace(/{highlightClips}/g, context.highlightClips || '');

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
      .replace(/{style}/g, context.style || '')
      // 新增分析结果字段
      .replace(/{contentStructure}/g, context.contentStructure || '')
      .replace(/{valuePoints}/g, context.valuePoints || '')
      .replace(/{highlightClips}/g, context.highlightClips || '');

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

    // 封面提示词已隐藏，保留为空
    results.coverPrompt = '';
    options.onProgress?.(100, 'success');

    return results;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 流式生成单平台内容（合并模式）
 * 使用流式API，内容实时流回给调用者
 */
export async function generateStreamingPlatformContent(
  platformId: string,
  context: {
    content: string;
    title?: string;
    keywords?: string;
    emotion?: string;
    audience?: string;
    category?: string;
    style?: string;
    contentStructure?: string;
    valuePoints?: string;
    highlightClips?: string;
    goldSentences?: string[];
    interactiveHook?: string;
    platform?: string;
    contentType?: string;
    track?: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  },
  callback: (chunk: StreamingChunk) => void,
  options: LLMServiceOptions = {}
): Promise<{ titles: string[]; content: string }> {
  return generateStreamingPlatformContentInternal(platformId, context, callback, options, true);
}

/**
 * 流式生成正文内容（非合并模式）
 */
export async function generateStreamingContentOnly(
  platformId: string,
  context: {
    content: string;
    title?: string;
    keywords?: string;
    emotion?: string;
    audience?: string;
    category?: string;
    style?: string;
    contentStructure?: string;
    valuePoints?: string;
    highlightClips?: string;
    goldSentences?: string[];
    interactiveHook?: string;
    platform?: string;
    contentType?: string;
    track?: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  },
  callback: (chunk: StreamingChunk) => void,
  options: LLMServiceOptions = {}
): Promise<string> {
  const result = await generateStreamingPlatformContentInternal(platformId, context, callback, options, false);
  return result.content;
}

/**
 * 内部流式生成函数
 */
async function generateStreamingPlatformContentInternal(
  platformId: string,
  context: {
    content: string;
    title?: string;
    keywords?: string;
    emotion?: string;
    audience?: string;
    category?: string;
    style?: string;
    contentStructure?: string;
    valuePoints?: string;
    highlightClips?: string;
    goldSentences?: string[];
    interactiveHook?: string;
    platform?: string;
    contentType?: string;
    track?: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  },
  callback: (chunk: StreamingChunk) => void,
  options: LLMServiceOptions = {},
  mergeTitleAndContent: boolean
): Promise<{ titles: string[]; content: string }> {
  const { ai, platforms, testMode } = useSettingsStore.getState();
  const platform = platforms.platforms.find(p => p.id === platformId);
  const template = platform?.templates.find(t => t.id === (platform.defaultTemplateId || platform.templates[0]?.id));

  // 测试模式：不支持流式，直接返回模拟数据
  if (testMode) {
    callback({ content: '测试模式不支持流式生成', done: true });
    return { titles: ['测试标题'], content: '测试内容' };
  }

  if (!template) {
    throw new Error(`Platform template not found: ${platformId}`);
  }

  options.onProgress?.(10, 'pending');

  let messages: { role: 'system' | 'user'; content: string }[];
  let isJsonOutput = false;

  if (mergeTitleAndContent) {
    // 合并模式：一次调用生成标题+正文
    isJsonOutput = true;
    const mergedPrompt = `你是一个${template.name}内容创作专家。请根据以下原始内容，生成适合该平台的标题和正文。

【原始内容】
${context.content}

【目标受众】
${context.audience || '通用'}

【核心关键词】
${context.keywords || ''}

【情绪基调】
${context.emotion || ''}

【内容分类】
${context.category || ''}

【风格】
${context.style || ''}

请按以下JSON格式输出，不要添加任何解释和markdown标记：
{
  "titles": ["标题1", "标题2", "标题3", "标题4", "标题5"],
  "content": "生成的正文内容..."
}`;
    messages = [
      { role: 'system' as const, content: `你是一个${template.name}内容创作专家，擅长生成各平台风格的爆款标题和正文。` },
      { role: 'user' as const, content: mergedPrompt }
    ];
  } else {
    // 非合并模式：只生成正文
    isJsonOutput = false;
    const contentPrompt = template.contentPrompt
      .replace(/{content}/g, context.content)
      .replace(/{title}/g, context.title || '')
      .replace(/{keywords}/g, context.keywords || '')
      .replace(/{emotion}/g, context.emotion || '')
      .replace(/{audience}/g, context.audience || '')
      .replace(/{category}/g, context.category || '')
      .replace(/{style}/g, context.style || '')
      .replace(/{contentStructure}/g, context.contentStructure || '')
      .replace(/{valuePoints}/g, context.valuePoints || '')
      .replace(/{highlightClips}/g, context.highlightClips || '');
    messages = [
      { role: 'system' as const, content: `你是一个${template.name}内容创作专家，擅长根据平台风格改写内容。` },
      { role: 'user' as const, content: contentPrompt }
    ];
  }

  let fullContent = '';

  try {
    // 使用流式调用
    await llmManager.chatStream(
      messages,
      ai.providers,
      ai.failover,
      (chunk) => {
        if (chunk.done) {
          callback({ content: '', done: true });
          return;
        }
        fullContent += chunk.content;
        callback(chunk);
      },
      {} // 传递空对象，避免类型不匹配
    );

    // 解析返回的内容
    if (isJsonOutput) {
      // 合并模式：解析JSON
      let jsonStr = fullContent.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, '').replace(/```$/, '');
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const titles = Array.isArray(parsed.titles) ? parsed.titles.slice(0, 5) : [parsed.titles || ''];
        const content = parsed.content || '';

        options.onProgress?.(100, 'success');
        callback({ content: '', done: true });
        return { titles, content };
      } catch {
        // JSON解析失败，尝试按行分割
        const lines = fullContent.split('\n').filter(l => l.trim());
        const titles = lines.slice(0, 5).map(l => l.replace(/^\d+[.、]\s*/, '').trim());

        options.onProgress?.(100, 'success');
        callback({ content: '', done: true });
        return { titles, content: fullContent };
      }
    } else {
      // 非合并模式：直接返回内容
      options.onProgress?.(100, 'success');
      callback({ content: '', done: true });
      return { titles: [], content: fullContent };
    }
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 一键优化
 * @param originalContent 原始内容
 * @param qualityReport 质检报告
 * @param options 选项
 * @param platformId 平台ID（用于选择对应平台的优化模板）
 */
export async function optimizeContent(
  originalContent: string,
  qualityReport: any,
  options: LLMServiceOptions = {},
  platformId?: string
): Promise<string> {
  const { ai, optimization, testMode } = useSettingsStore.getState();

  // 根据平台ID获取对应的优化模板，如果没有传平台ID则使用全局默认
  let defaultTemplate;
  if (platformId) {
    // 查找该平台下的默认模板
    const platformTemplates = optimization.templates.filter(t => t.platformId === platformId);
    defaultTemplate = platformTemplates.find(t => t.isDefault) || platformTemplates[0];
  }
  // 如果没有找到平台模板，使用全局默认
  if (!defaultTemplate) {
    defaultTemplate = optimization.templates.find(t => t.id === optimization.defaultTemplate) || optimization.templates[0];
  }

  // 测试模式：返回模拟数据
  if (testMode) {
    options.onProgress?.(30, 'pending');
    await new Promise(resolve => setTimeout(resolve, 600));
    options.onProgress?.(70, 'pending');
    await new Promise(resolve => setTimeout(resolve, 400));
    options.onProgress?.(100, 'success');

    return `【测试模式优化后的内容】

在人际关系中，你是否经常因为不好意思拒绝而委屈自己？很多人觉得帮助别人是一种美德，但如果因此失去了自己的边界，就会产生越来越多的负面情绪。

其实，真正的善良不是委屈自己成全别人，而是在保护自己的前提下去帮助他人。

学会设立边界，你会发现：
1. 你的关系变得更健康了
2. 别人更尊重你了
3. 你自己也更快乐了

从今天开始，试着勇敢说"不"吧！

【优化说明】这是测试模式下返回的模拟优化结果。`;
  }

  if (!defaultTemplate) {
    throw new Error('未找到优化报告模板');
  }

  options.onProgress?.(10, 'pending');

  // 构建质检报告文本
  const checklistText = qualityReport.checklist?.filter((c: any) => !c.passed)
    .map((c: any) => `- ${c.item}: ${c.reason}`)
    .join('\n') || '无';

  const suggestionsText = qualityReport.optimizationSuggestions
    ?.map((s: any) => s.content)
    .join('\n') || '无';

  // 使用模板的优化提示词
  const optimizePrompt = defaultTemplate.optimizePrompt
    .replace(/{originalContent}/g, originalContent)
    .replace(/{qualityReport}/g, `未通过项：\n${checklistText}\n\n优化建议：\n${suggestionsText}`);

  try {
    const response = await llmManager.chat(
      [
        { role: 'system', content: defaultTemplate.systemPrompt },
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

/**
 * 快速优化（无需质检报告）
 * @param originalContent 原始内容
 * @param platformId 平台ID（用于选择对应平台的优化模板）
 * @param options 选项
 */
export async function quickOptimizeContent(
  originalContent: string,
  platformId: string,
  options: LLMServiceOptions = {}
): Promise<string> {
  const { ai, optimization, testMode } = useSettingsStore.getState();

  // 根据平台ID获取对应的优化模板
  let defaultTemplate;
  if (platformId) {
    const platformTemplates = optimization.templates.filter(t => t.platformId === platformId);
    defaultTemplate = platformTemplates.find(t => t.isDefault) || platformTemplates[0];
  }
  if (!defaultTemplate) {
    defaultTemplate = optimization.templates.find(t => t.id === optimization.defaultTemplate) || optimization.templates[0];
  }

  // 测试模式：返回模拟数据
  if (testMode) {
    options.onProgress?.(30, 'pending');
    await new Promise(resolve => setTimeout(resolve, 600));
    options.onProgress?.(70, 'pending');
    await new Promise(resolve => setTimeout(resolve, 400));
    options.onProgress?.(100, 'success');

    return `【测试模式优化后的内容】

在人际关系中，你是否经常因为不好意思拒绝而委屈自己？很多人觉得帮助别人是一种美德，但如果因此失去了自己的边界，就会产生越来越多的负面情绪。

其实，真正的善良不是委屈自己成全别人，而是在保护自己的前提下去帮助他人。

学会设立边界，你会发现：
1. 你的关系变得更健康了
2. 别人更尊重你了
3. 你自己也更快乐了

从今天开始，试着勇敢说"不"吧！

【优化说明】这是测试模式下返回的模拟优化结果。`;
  }

  if (!defaultTemplate) {
    throw new Error('未找到优化报告模板');
  }

  options.onProgress?.(10, 'pending');

  // 快速优化：不传入质检报告，使用空内容提示
  const optimizePrompt = defaultTemplate.optimizePrompt
    .replace(/{originalContent}/g, originalContent)
    .replace(/{qualityReport}/g, '（快速优化模式，无需质检报告）');

  try {
    const response = await llmManager.chat(
      [
        { role: 'system', content: defaultTemplate.systemPrompt },
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

/**
 * 质检分析
 * @param content 要质检的内容
 * @param platformId 平台ID（用于选择对应平台的质检模板）
 * @param options 选项
 */
export async function analyzeContentQuality(
  content: string,
  platformId: string,
  options: LLMServiceOptions = {}
): Promise<QualityReport> {
  const { ai, platforms, testMode } = useSettingsStore.getState();

  // 根据平台ID获取对应的质检模板
  const platform = platforms.platforms.find(p => p.id === platformId);
  const qualityPromptTemplate = platform?.qualityPrompt;

  // 测试模式：返回模拟数据
  if (testMode) {
    options.onProgress?.(20, 'pending');
    await new Promise(resolve => setTimeout(resolve, 500));
    options.onProgress?.(50, 'pending');
    await new Promise(resolve => setTimeout(resolve, 400));
    options.onProgress?.(80, 'pending');
    await new Promise(resolve => setTimeout(resolve, 300));
    options.onProgress?.(100, 'success');

    const baseScore = platformId === 'gzh' ? 8.2 : platformId === 'xhs' ? 7.5 : 7.8;

    // 各平台动态维度
    const platformDimensions = {
      gzh: [
        { id: 'titleSpread', name: '标题传播性', score: 22, maxScore: 25, evidence: '原文："你不是懒，你只是太焦虑了"（第1行）——判定：戳中焦虑情绪，有传播性', reason: '戳中情绪，有社交货币' },
        { id: 'crowdAccuracy', name: '人群精准度', score: 12, maxScore: 15, evidence: '原文："你是否也有过这样的经历"（第2行）——判定：精准定位目标人群', reason: '有目标人群筛选' },
        { id: 'socialCurrency', name: '社交货币', score: 18, maxScore: 25, evidence: '原文："从现在开始，哪怕只是迈出一小步"（结尾）——判定：有转发触发点', reason: '有可传播的金句' },
        { id: 'contentDensity', name: '内容密度', score: 15, maxScore: 20, evidence: '原文："第一...第二...第三..."（第4-6段）——判定：有方法论', reason: '有知识增量' },
        { id: 'retentionDesign', name: '留存设计', score: 8, maxScore: 15, evidence: '原文："凌晨1点..."（开头）——判定：开头有悬念', reason: '开头有钩子' },
      ],
      xhs: [
        { id: 'titleHook', name: '标题/首图钩子', score: 16, maxScore: 20, evidence: '原文："职场人必看"（第1行）——判定：精准人群+行动号召', reason: '人群精准+行动号召' },
        { id: 'crowdAccuracy', name: '人群精准度', score: 12, maxScore: 15, evidence: '原文："职场人必看"（第1行）——判定：精准定位职场人群', reason: '人群标签明确' },
        { id: 'collectableValue', name: '可收藏价值', score: 20, maxScore: 25, evidence: '原文："3个亲测有效的方法"（第3行）——判定：有可操作的方法', reason: '有实用方法论' },
        { id: 'seoKeyword', name: 'SEO关键词', score: 14, maxScore: 20, evidence: '原文："#职场心理 #自我提升"（结尾标签）——判定：有关键词布局', reason: '关键词覆盖充分' },
        { id: 'interactionDesign', name: '互动设计', score: 15, maxScore: 20, evidence: '原文："你认同吗？评论区说说"（结尾）——判定：有互动引导', reason: '有互动引导' },
      ],
      douyin: [
        { id: 'hook3s', name: '3秒钩子', score: 20, maxScore: 25, evidence: '原文："你为什么总是拖延"（0-3s）——判定：痛点提问+人群筛选', reason: '痛点精准+人群明确' },
        { id: 'hotPoint15s', name: '15秒爆点', score: 15, maxScore: 20, evidence: '原文："告诉你3个方法"（15s）——判定：15秒内给干货', reason: '有干货密度' },
        { id: 'rhythmDensity', name: '节奏密度', score: 24, maxScore: 30, evidence: '原文："第一个...第二个...第三个..."——判定：节奏紧凑', reason: '节奏快而不乱' },
        { id: 'interactionKeyword', name: '互动关键词', score: 10, maxScore: 15, evidence: '原文："你认同吗？评论区说说"（结尾）——判定：有互动引导', reason: '有互动引导' },
        { id: 'forwardGuide', name: '转发引导', score: 7, maxScore: 10, evidence: '原文：无明确转发触发——判定：缺少转发引导', reason: '缺少转发触发' },
      ],
    };

    const dims = platformDimensions[platformId as keyof typeof platformDimensions] || platformDimensions.gzh;

    return {
      overallScore: baseScore,
      grade: baseScore >= 8 ? 'good' : 'average',
      dimensions: dims.map(d => ({
        id: d.id,
        name: d.name,
        score: d.score,
        maxScore: d.maxScore,
        status: calcStatus(d.score, d.maxScore),
        evidence: d.evidence,
        reason: d.reason || '',
      })),
      checklist: [
        { id: '1', name: '标题长度合适', passed: true, reason: '字数在13-25字之间', evidence: '你不是懒，你只是太焦虑了' },
        { id: '2', name: '开头有钩子', passed: true, reason: '前50字包含悬念或痛点', evidence: '凌晨1点，我又一次...' },
        { id: '3', name: '包含金句引用', passed: false, reason: '正文未引用金句', evidence: '' },
        { id: '4', name: '结尾有CTA', passed: true, reason: '包含明确的行动号召', evidence: '从现在开始...' },
        { id: '5', name: '信息密度足够', passed: true, reason: '包含2个以上知识点', evidence: '第一...第二...第三...' },
        { id: '6', name: '情感表达恰当', passed: true, reason: '情绪浓度适中', evidence: '焦虑+拖延...' },
        { id: '7', name: '互动引导充分', passed: false, reason: '未包含评论引导', evidence: '' },
        { id: '8', name: '排版规范清晰', passed: true, reason: '段落清晰，重点标记明显', evidence: '每段3-5行...' },
      ],
      optimizationSuggestions: [
        {
          id: '1',
          content: '在第2段开头加入一个金句引用，增加内容的深度和说服力',
          position: '正文第2段',
          priority: 'high',
          original: '科学研究表明，拖延症的本质不是懒惰，而是情绪调节失败。',
          optimized: '🔥心理学研究显示：拖延不是懒，是大脑在保护你。——《纽约时报》',
          logic: '增加金句引用，增强说服力和权威性',
        },
        {
          id: '2',
          content: '结尾增加互动引导，如提问或投票，提高用户参与度',
          position: '结尾部分',
          priority: 'medium',
          original: '记住，拖延不是你的错，但改变是你的选择。',
          optimized: '记住，拖延不是你的错，但改变是你的选择。你有什么想说的？评论区聊聊～',
          logic: '增加互动引导，提高评论区活跃度',
        },
      ],
    };
  }

  if (!qualityPromptTemplate) {
    throw new Error('未找到六维质检模板');
  }

  if (ai.providers.length === 0) {
    throw new Error('请先在设置中配置 AI 供应商');
  }

  options.onProgress?.(10, 'pending');

  // 构建质检提示词
  const qualityPrompt = qualityPromptTemplate.replace(/{content}/g, content);

  try {
    const response = await llmManager.chat(
      [
        { role: 'system', content: '你是一个专业的内容质检专家，擅长从多个维度评估内容质量。' },
        { role: 'user', content: qualityPrompt }
      ],
      ai.providers,
      ai.failover
    );

    options.onProgress?.(60, 'pending');

    // 解析返回结果
    const result = parseQualityResponse(response.content, platformId);

    options.onProgress?.(100, 'success');
    return result;
  } catch (error) {
    options.onProgress?.(0, 'error');
    throw error;
  }
}

/**
 * 解析质检响应 - 动态版本
 */
function parseQualityResponse(content: string, platformId: string): QualityReport {
  // 尝试解析为 JSON
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\w*\n?/, '').replace(/```$/, '');
    }
    const parsed = JSON.parse(jsonStr);
    return transformQualityResponse(parsed);
  } catch {
    // JSON 解析失败，使用文本解析
    return parseQualityFromText(content, platformId);
  }
}

/**
 * 转换质检响应格式 - 动态版本
 * 不再假设固定维度，完全透传 AI 返回的数据
 */
function transformQualityResponse(parsed: any): QualityReport {
  const overallScore = parsed.overallScore || parsed.score || 7;

  // 处理 dimensions - 动态转换
  const dimensions: Dimension[] = [];
  const dims = parsed.dimensions || parsed.scores || {};

  for (const [id, data] of Object.entries<any>(dims)) {
    const score = data.score ?? data.分数 ?? 0;
    const maxScore = data.maxScore ?? data.满分 ?? 10;

    dimensions.push({
      id,
      name: normDimName(id),
      score,
      maxScore,
      status: calcStatus(score, maxScore),
      evidence: data.evidence || data.引用 || '',
      reason: data.reason || data.判定理由 || '',
    });
  }

  // 处理 checklist - 动态转换
  const checklist: ChecklistItem[] = (parsed.checklist || parsed.checkItems || []).map((item: any, index: number) => ({
    id: item.id || String(index + 1),
    name: item.name || item.item || item.项目 || `检查项${index + 1}`,
    passed: item.passed ?? (item.result === 'pass' || item.结果 === '通过' || false),
    reason: item.reason || item.reasoning || '',
    evidence: item.evidence || item.原文引用 || '',
    position: item.position || item.location || '',
  }));

  // 处理 optimizationSuggestions - 动态转换，支持 original/optimized
  const optimizationSuggestions: OptimizationSuggestion[] = (
    parsed.optimizations ||
    parsed.optimizationSuggestions ||
    parsed.suggestions ||
    []
  ).map((item: any, index: number) => ({
    id: item.id || String(index + 1),
    content: item.content || item.suggestion || item.建议 || '',
    position: item.position || item.location || '',
    priority: item.priority || item.level || 'medium',
    original: item.original || '',
    optimized: item.optimized || '',
    logic: item.logic || '',
  }));

  return {
    overallScore,
    grade: calcGrade(overallScore),
    dimensions,
    checklist,
    optimizationSuggestions,
  };
}

/**
 * 从文本解析质检结果 - 动态版本（JSON解析失败时的后备）
 */
function parseQualityFromText(content: string, platformId: string): QualityReport {
  // 默认值
  const dimensions: Dimension[] = [
    { id: 'default', name: '综合评分', score: 7, maxScore: 10, status: 'warning', reason: '无法解析结构化数据' },
  ];
  const checklist: ChecklistItem[] = [];
  const optimizationSuggestions: OptimizationSuggestion[] = [];

  // 解析综合评分
  const scoreMatch = content.match(/(?:综合[评]?[分|爆款概率]|总体[评]?分|整体[评]?分)[：:]\s*(\d+\.?\d*)/i);
  const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : 7;

  // 如果没有解析到数据，使用默认
  if (checklist.length === 0) {
    checklist.push({
      id: '1',
      name: '内容完整性',
      passed: true,
      reason: '通过初步检查',
    });
  }

  return {
    overallScore,
    grade: calcGrade(overallScore),
    dimensions,
    checklist,
    optimizationSuggestions,
  };
}

/**
 * 通过模板路由执行（同步）
 */
export async function routeExecute(
  templateId: string,
  context: Record<string, string>,
  options?: {
    systemPrompt?: string;
    model?: string;
  }
): Promise<RouterResult> {
  return promptRouter.execute(templateId, context, options);
}

/**
 * 通过模板路由执行（流式）
 */
export async function routeExecuteStream(
  templateId: string,
  context: Record<string, string>,
  onChunk: (chunk: StreamingChunk) => void,
  options?: {
    systemPrompt?: string;
    model?: string;
  }
): Promise<StreamResult> {
  return promptRouter.executeStream(templateId, context, onChunk, options);
}

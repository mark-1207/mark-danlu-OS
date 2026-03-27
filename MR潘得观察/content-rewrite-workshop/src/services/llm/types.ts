/**
 * LLM 服务类型定义
 */

// AI 供应商类型
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'kimi'
  | 'deepseek'
  | 'minimax'
  | 'glm'
  | 'doubao'
  | 'qwen'
  | 'ark'
  | 'custom';

// 单个供应商配置
export interface ProviderConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // 自定义端点（用于中转站）
  model: string;
  temperature: number;
  maxTokens?: number;
  isEnabled: boolean;
  isPrimary: boolean;
}

// 自动切换配置
export interface FailoverConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
}

// AI 设置
export interface AISettings {
  providers: ProviderConfig[];
  failover: FailoverConfig;
}

// 模板变量
export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

// 单个内容模板
export interface ContentTemplate {
  id: string;
  name: string;  // 如 "深度文章模板"、"种草模板"
  titlePrompt: string;
  contentPrompt: string;
}

// 平台
export interface Platform {
  id: string;
  name: string;
  icon: string;
  isBuiltIn: boolean;
  templates: ContentTemplate[];  // 该平台的多个模板
  defaultTemplateId: string;    // 当前选中的模板
  platformCognition?: string;
  qualityPrompt?: string;
  qualityCriteria?: string[];
}

// 平台设置
export interface PlatformSettings {
  platforms: Platform[];
  defaultPlatform: string;
}

// 内容分析模板 - 输出格式字段
export interface OutputFormatField {
  key: string;
  label: string;
  type: 'string' | 'array' | 'object' | 'number';
  required: boolean;
}

// 内容分析模板
export interface AnalysisTemplate {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isDefault: boolean;

  // 分析提示词
  analysisPrompt: string;

  // 输出格式定义
  outputFormat: {
    fields: OutputFormatField[];
    example?: string;
  };
}

// 优化报告模板
export interface OptimizationTemplate {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isDefault: boolean;
  platformId?: string; // 关联的平台ID

  // 优化系统提示词
  systemPrompt: string;

  // 优化提示词模板
  optimizePrompt: string;
}

// 内容分析设置
export interface AnalysisSettings {
  templates: AnalysisTemplate[];
  defaultTemplate: string;
}

// 优化报告设置
export interface OptimizationSettings {
  templates: OptimizationTemplate[];
  defaultTemplate: string;
}

// 完整应用设置
export interface AppSettings {
  ai: AISettings;
  platforms: PlatformSettings;
  analysis: AnalysisSettings;
  optimization: OptimizationSettings;
  testMode: boolean;
}

// 对话消息
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// LLM 请求配置
export interface LLMRequestConfig {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// LLM 响应
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

// 流式输出类型
export interface StreamingChunk {
  content: string;      // 当前片段内容
  done: boolean;        // 是否完成
  usage?: {             // 完成时返回 usage 信息
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;       // 完成时返回实际使用的模型
}

export interface StreamError {
  message: string;
  isRetryable: boolean;
  retryAfterMs?: number;
}

export type StreamCallback = (chunk: StreamingChunk) => void;

// 供应商信息（用于UI展示）
export interface ProviderInfo {
  id: string;
  name: string;
  provider: AIProvider;
  defaultModel: string;
  baseUrl: string;
  website: string;
}

// 供应商列表
export const PROVIDER_LIST: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    website: 'https://platform.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    provider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
    website: 'https://www.anthropic.com',
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    provider: 'kimi',
    defaultModel: 'moonshot-v1-8k',
    baseUrl: 'https://api.moonshot.cn/v1',
    website: 'https://platform.moonshot.cn',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'deepseek',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    website: 'https://platform.deepseek.com',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    provider: 'minimax',
    defaultModel: 'abab6.5s-chat',
    baseUrl: 'https://api.minimax.chat/v1',
    website: 'https://platform.minimax.io',
  },
  {
    id: 'glm',
    name: 'GLM (智谱)',
    provider: 'glm',
    defaultModel: 'glm-4',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    website: 'https://open.bigmodel.cn',
  },
  {
    id: 'doubao',
    name: '豆包 (字节)',
    provider: 'doubao',
    defaultModel: 'doubao-lite',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    website: 'https://www.doubao.com',
  },
  {
    id: 'qwen',
    name: '千问 (阿里)',
    provider: 'qwen',
    defaultModel: 'qwen-turbo',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    website: 'https://tongyi.aliyun.com',
  },
  {
    id: 'ark',
    name: '火山引擎 Ark',
    provider: 'ark',
    defaultModel: 'deepseek-r1-250528',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    website: 'https://www.volcengine.com',
  },
  {
    id: 'custom',
    name: '自定义/中转站',
    provider: 'custom',
    defaultModel: '',
    baseUrl: '',
    website: '',
  },
];

// 变量映射：UI显示名称（固定映射，不影响AI）
export const VARIABLE_LABELS: Record<string, string> = {
  '{title}': '原始标题',
  '{content}': '原始内容',
  '{keywords}': '关键词',
  '{emotion}': '情绪基调',
  '{audience}': '目标受众',
  '{category}': '内容分类',
  '{style}': '风格要求',
  '{word_count}': '目标字数',
};

// 预设短语到变量的自动映射（用于智能替换）
export const PHRASE_TO_VARIABLE: Record<string, string> = {
  // 原文/内容相关
  '原文': '{content}',
  '原始内容': '{content}',
  '原始文本': '{content}',
  '输入内容': '{content}',
  '内容': '{content}',

  // 标题相关
  '标题': '{title}',
  '原始标题': '{title}',

  // 关键词
  '关键词': '{keywords}',
  '核心关键词': '{keywords}',

  // 受众
  '受众': '{audience}',
  '目标受众': '{audience}',
  '目标人群': '{audience}',
  '针对人群': '{audience}',
  '读者': '{audience}',

  // 情绪
  '情绪': '{emotion}',
  '情绪基调': '{emotion}',
  '情感': '{emotion}',
  '基调': '{emotion}',

  // 分类
  '分类': '{category}',
  '内容分类': '{category}',
  '类别': '{category}',
  '领域': '{category}',

  // 风格
  '风格': '{style}',
  '风格要求': '{style}',
  '文风': '{style}',
  '语调': '{style}',

  // 字数
  '字数': '{word_count}',
  '目标字数': '{word_count}',
  '字': '{word_count}',
};

// 自动检测文本中的概念并替换为变量
// 返回: { text: 替换后的文本, newVariables: 新发现的变量列表 }
export function autoDetectAndReplaceVariables(text: string): { text: string; newVariables: string[] } {
  let resultText = text;
  const newVariables: string[] = [];
  const usedVariables = new Set<string>();

  // 按长度降序排列短语，确保先匹配长的
  const sortedPhrases = Object.keys(PHRASE_TO_VARIABLE).sort((a, b) => b.length - a.length);

  for (const phrase of sortedPhrases) {
    const variable = PHRASE_TO_VARIABLE[phrase];
    // 使用正则表达式全局替换，支持中英文
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    resultText = resultText.replace(regex, () => {
      usedVariables.add(variable);
      return variable;
    });
  }

  // 检测新增变量（用户可能自定义的变量格式，如 {自定义内容}）
  const customVarRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = customVarRegex.exec(resultText)) !== null) {
    const varName = match[0];
    // 如果这个变量不在预设表中，添加到新变量列表
    if (!VARIABLE_LABELS[varName] && !newVariables.includes(varName)) {
      newVariables.push(varName);
    }
  }

  return { text: resultText, newVariables };
}

// 添加新变量到预设表
export function addVariableToLabels(variableName: string, description?: string): void {
  if (!VARIABLE_LABELS[variableName]) {
    VARIABLE_LABELS[variableName] = description || variableName.replace(/[{}]/g, '');
  }
}

// 获取默认变量列表（用于参考）
export const DEFAULT_VARIABLES: TemplateVariable[] = [
  { name: '{title}', description: VARIABLE_LABELS['{title}'], example: '如何提升工作效率' },
  { name: '{content}', description: VARIABLE_LABELS['{content}'], example: '长文本内容...' },
  { name: '{keywords}', description: VARIABLE_LABELS['{keywords}'], example: '效率,时间管理,专注' },
  { name: '{emotion}', description: VARIABLE_LABELS['{emotion}'], example: '积极,乐观,温暖' },
  { name: '{audience}', description: VARIABLE_LABELS['{audience}'], example: '职场新人,25-35岁' },
  { name: '{category}', description: VARIABLE_LABELS['{category}'], example: '职场,自我提升' },
  { name: '{style}', description: VARIABLE_LABELS['{style}'], example: '专业,亲切,口语化' },
  { name: '{word_count}', description: VARIABLE_LABELS['{word_count}'], example: '2000' },
];

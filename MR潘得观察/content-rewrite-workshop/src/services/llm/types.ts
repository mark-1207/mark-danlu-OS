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

// 平台模板
export interface PlatformTemplate {
  id: string;
  name: string;
  icon: string; // 图标或文字标签
  isBuiltIn: boolean;
  isDefault: boolean;

  // 平台核心认知
  platformCognition?: string;

  // 标题模板
  titlePrompt: string;
  titleVariables: TemplateVariable[];

  // 正文模板
  contentPrompt: string;
  contentVariables: TemplateVariable[];

  // 质检模板
  qualityPrompt: string;
  qualityCriteria: string[];
}

// 平台设置
export interface PlatformSettings {
  templates: PlatformTemplate[];
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
    id: 'custom',
    name: '自定义/中转站',
    provider: 'custom',
    defaultModel: '',
    baseUrl: '',
    website: '',
  },
];

// 获取默认变量列表
export const DEFAULT_VARIABLES: TemplateVariable[] = [
  { name: '{title}', description: '原始标题', example: '如何提升工作效率' },
  { name: '{content}', description: '原始内容', example: '长文本内容...' },
  { name: '{keywords}', description: '关键词', example: '效率,时间管理,专注' },
  { name: '{emotion}', description: '情绪基调', example: '积极,乐观,温暖' },
  { name: '{audience}', description: '目标受众', example: '职场新人,25-35岁' },
  { name: '{category}', description: '内容分类', example: '职场,自我提升' },
  { name: '{style}', description: '风格要求', example: '专业,亲切,口语化' },
];

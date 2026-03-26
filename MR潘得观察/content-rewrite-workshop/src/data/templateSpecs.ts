/**
 * 模板格式规范定义
 *
 * 定义标题/正文提示词的标准结构，用于自动修正和验证
 */

import { gzhContentPrompt, xhsContentPrompt, douyinContentPrompt } from './index';

// ============================================
// 平台 ID 类型
// ============================================

export type PlatformId = 'gzh' | 'xhs' | 'douyin';
export type PromptType = 'titlePrompt' | 'contentPrompt' | 'qualityPrompt';

// ============================================
// 标准变量定义
// ============================================

export interface TemplateVariable {
  name: string;      // 变量名，如 {content}
  label: string;     // 展示名称
  description: string; // 说明
  example: string;    // 示例
}

// 标准变量列表
export const STANDARD_VARIABLES: TemplateVariable[] = [
  { name: '{content}', label: '原始内容', description: '用户输入的原始素材', example: '长文本内容...' },
  { name: '{title}', label: '标题', description: '生成/选定的标题', example: '如何提升工作效率' },
  { name: '{audience}', label: '目标受众', description: '目标读者人群', example: '职场新人,25-35岁' },
  { name: '{keywords}', label: '关键词', description: '核心关键词', example: '效率,时间管理' },
  { name: '{emotion}', label: '情绪基调', description: '内容情绪要求', example: '积极,温暖' },
  { name: '{category}', label: '内容分类', description: '内容所属分类', example: '职场,自我提升' },
  { name: '{style}', label: '风格要求', description: '文风/语调要求', example: '专业,亲切' },
  { name: '{word_count}', label: '目标字数', description: '期望输出字数', example: '2000' },
];

// 变量名到标准变量的映射（用于自动转换）
export const VARIABLE_ALIASES: Record<string, string> = {
  // content 相关
  '原文': '{content}',
  '原始内容': '{content}',
  '原始文本': '{content}',
  '输入内容': '{content}',
  '内容': '{content}',
  '素材': '{content}',

  // title 相关
  '标题': '{title}',
  '主标题': '{title}',
  '选定标题': '{title}',

  // audience 相关
  '受众': '{audience}',
  '目标受众': '{audience}',
  '目标人群': '{audience}',
  '针对人群': '{audience}',
  '读者': '{audience}',

  // keywords 相关
  '关键词': '{keywords}',
  '核心关键词': '{keywords}',

  // emotion 相关
  '情绪': '{emotion}',
  '情绪基调': '{emotion}',
  '情感': '{emotion}',

  // category 相关
  '分类': '{category}',
  '内容分类': '{category}',
  '类别': '{category}',
  '领域': '{category}',

  // style 相关
  '风格': '{style}',
  '风格要求': '{style}',
  '文风': '{style}',
  '语调': '{style}',

  // word_count 相关
  '字数': '{word_count}',
  '目标字数': '{word_count}',
  '字': '{word_count}',
};

// ============================================
// 格式规范定义
// ============================================

export interface SectionSpec {
  name: string;           // 区块名称，如"标题提示词"
  markers: string[];      // 识别标记，如["标题", "title"]
  required: boolean;       // 是否必需
  requiredElements: string[]; // 必需包含的元素
  optionalElements: string[]; // 可选包含的元素
}

// 标题提示词规范
export const TITLE_SECTION_SPEC: SectionSpec = {
  name: '标题提示词',
  markers: ['标题', 'title', '生成标题', '输出标题'],
  required: false, // 用户可能只提供正文
  requiredElements: ['role', 'outputFormat'],
  optionalElements: ['formulas', 'prohibitions', 'wordLimit'],
};

// 正文提示词规范
export const CONTENT_SECTION_SPEC: SectionSpec = {
  name: '正文提示词',
  markers: ['正文', 'content', '生成正文', '写文章', '文章'],
  required: false,
  requiredElements: ['role', 'contentType'],
  optionalElements: ['structure', 'goldenSentences', 'prohibitions', 'format'],
};

// ============================================
// 分析结果类型
// ============================================

export interface AnalysisResult {
  // 是否识别到各部分
  hasTitleSection: boolean;
  hasContentSection: boolean;

  // 原始内容
  rawTitleContent: string;
  rawContentContent: string;

  // 检测到的变量
  detectedVariables: string[];     // 原始文本中的变量
  standardVariables: string[];      // 映射后的标准变量

  // 缺失的推荐变量
  missingRecommended: string[];

  // 结构问题
  structureIssues: string[];

  // 修正建议
  suggestions: string[];
}

// ============================================
// 修正结果类型
// ============================================

export interface FixedTemplate {
  titlePrompt: string;      // 修正后的标题提示词
  contentPrompt: string;    // 修正后的正文提示词
  appliedFixes: string[];   // 应用的修正项
  warnings: string[];       // 警告信息（不影响保存）
}

// ============================================
// 验证结果类型
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];   // 必须修复的问题
  warnings: string[]; // 提示信息
}

// ============================================
// JSON 输出格式规范
// ============================================

export interface OutputFormatSpec {
  hasJsonFormat: boolean;    // 是否定义了 JSON 输出格式
  jsonStructure?: string;   // JSON 结构描述
  requiredFields?: string[]; // 必需字段
}

// 标准 JSON 输出格式
export const STANDARD_TITLE_JSON_FORMAT = `{
  "titles": [
    { "text": "标题", "type": "公式类型", "reason": "为什么能爆" }
  ],
  "recommended": "主推标题"
}`;

// ============================================
// 平台特定模板规范（按设计文档 2026-03-26）
// ============================================

/**
 * 标题提示词规范
 */
export interface TitlePromptSpec {
  // 必需区块
  requiredSections: {
    key: string;
    label: string;
    count: number;
    fields: {
      name: string;
      template?: string;
      examples?: string[];
      applicableTo?: string;
    }[];
  }[];
  // 输出格式
  outputFormat: {
    label: string;
    schema: {
      titles: string;
      recommended: string;
    };
  };
  // 禁止事项格式
  prohibitionFormat: string;
}

/**
 * 正文提示词规范
 */
export interface ContentPromptSpec {
  // 内容类型差异化
  contentTypes: {
    label: string;
    types: string[];
  };
  // 必需区块
  requiredSections: {
    key: string;
    label: string;
    count: number;
  }[];
  // 禁止事项
  prohibitionFormat: string;
  // 排版要求
  layoutRequirements: string[];
  // 互动触发
  interactionTypes: string[];
}

/**
 * 质检提示词规范
 */
export interface QualityPromptSpec {
  dimensions: {
    label: string;
    weight: string;
    benchmarks: {
      pass: string;
      warning: string;
      fail: string;
    };
  }[];
  scoringRules: string;
  outputFormat: {
    label: string;
    schema: Record<string, string>;
  };
}

/**
 * 平台模板规范
 */
export interface PlatformTemplateSpec {
  platformId: PlatformId;
  titlePromptSpec: TitlePromptSpec;
  contentPromptSpec: ContentPromptSpec;
  qualityPromptSpec?: QualityPromptSpec;
}

// ============================================
// 各平台模板规范
// ============================================

export const PLATFORM_TEMPLATE_SPECS: Record<PlatformId, PlatformTemplateSpec> = {
  gzh: {
    platformId: 'gzh',
    titlePromptSpec: {
      requiredSections: [
        {
          key: 'coreFormulas',
          label: '核心标题公式',
          count: 5,
          fields: [
            { name: '公式名称' },
            { name: '结构' },
            { name: '示例' },
            { name: '适用场景' },
          ],
        },
      ],
      outputFormat: {
        label: '输出格式',
        schema: {
          titles: '数组，每个包含 text/type/reason',
          recommended: '主推标题',
        },
      },
      prohibitionFormat: '❌ 描述',
    },
    contentPromptSpec: {
      contentTypes: {
        label: '内容类型差异化',
        types: ['访谈对话类', '故事分享类', '观点评论类', '新闻时事类', '演讲分享类'],
      },
      requiredSections: [
        { key: 'openingFormulas', label: '核心开篇公式', count: 3 },
        { key: 'bodyStructures', label: '主体结构模式', count: 4 },
        { key: 'endingFormulas', label: '结尾公式', count: 3 },
        { key: 'goldenQuotes', label: '金句植入策略', count: 1 },
      ],
      prohibitionFormat: '❌ 描述',
      layoutRequirements: ['每段不超过4行', '关键信息用【】或加粗突出', '金句用「」标注', '每300字一个视觉休息点'],
      interactionTypes: ['点赞触发', '评论触发', '转发触发'],
    },
    qualityPromptSpec: {
      dimensions: [
        { label: '标题吸引力', weight: '20%', benchmarks: { pass: '13-25字，关键词前置', warning: '26-30字或缺少关键词', fail: '超过30字或无价值信息' } },
        { label: '开头留存力', weight: '20%', benchmarks: { pass: '前300字有强钩子', warning: '前300字平淡', fail: '开头冗长无重点' } },
        { label: '内容价值度', weight: '25%', benchmarks: { pass: '有知识增量或认知颠覆', warning: '有价值但不突出', fail: '空洞无实质内容' } },
        { label: '情绪感染力', weight: '15%', benchmarks: { pass: '共鸣强，深度足够', warning: '有一定共鸣', fail: '情绪泛滥或冷漠' } },
        { label: '传播设计度', weight: '20%', benchmarks: { pass: '金句多，转发点明确', warning: '有转发点但不明显', fail: '无金句无转发点' } },
      ],
      scoringRules: '每项0-100分，加权求和',
      outputFormat: {
        label: '输出格式',
        schema: {
          scores: '各维度分数',
          overall: '总分',
          checklist: '判定清单',
          suggestions: '优化建议',
        },
      },
    },
  },

  xhs: {
    platformId: 'xhs',
    titlePromptSpec: {
      requiredSections: [
        {
          key: 'coreFormulas',
          label: '核心标题公式',
          count: 5,
          fields: [
            { name: '公式名称' },
            { name: '模板结构' },
            { name: '示例' },
            { name: '适用场景' },
          ],
        },
      ],
      outputFormat: {
        label: '输出格式',
        schema: {
          titles: '数组，每个包含 text/type/reason',
          recommended: '主推标题',
        },
      },
      prohibitionFormat: '❌ 描述',
    },
    contentPromptSpec: {
      contentTypes: {
        label: '内容类型差异化',
        types: ['干货方法类', '情感共鸣类', '经历分享类', '书单/清单类'],
      },
      requiredSections: [
        { key: 'openingFormulas', label: '核心开篇公式', count: 3 },
        { key: 'bodyStructures', label: '主体结构模式', count: 4 },
        { key: 'endingFormulas', label: '结尾公式', count: 3 },
        { key: 'goldenQuotes', label: '金句植入', count: 1 },
      ],
      prohibitionFormat: '❌ 描述',
      layoutRequirements: ['每100-150字一段', '使用emoji作为视觉标记', '重点用「」或加粗突出', '标签：3-5个精准标签'],
      interactionTypes: ['点赞触发', '收藏触发', '评论触发'],
    },
    qualityPromptSpec: {
      dimensions: [
        { label: '标题吸引力', weight: '20%', benchmarks: { pass: '20字内，情绪词+关键词', warning: '21-25字', fail: '超过25字' } },
        { label: '开头留存力', weight: '20%', benchmarks: { pass: '前50字有强代入感', warning: '50-100字才入戏', fail: '开头平淡' } },
        { label: '内容价值度', weight: '25%', benchmarks: { pass: '实用干货+种草价值', warning: '有价值但不够实用', fail: '空洞' } },
        { label: '情绪感染力', weight: '15%', benchmarks: { pass: '真实温暖', warning: '有情绪但不够真实', fail: '过于营销' } },
        { label: '传播设计度', weight: '20%', benchmarks: { pass: '互动引导+收藏点明确', warning: '有但不明显', fail: '无引导' } },
      ],
      scoringRules: '每项0-100分，加权求和',
      outputFormat: {
        label: '输出格式',
        schema: {
          scores: '各维度分数',
          overall: '总分',
          checklist: '判定清单',
          suggestions: '优化建议',
        },
      },
    },
  },

  douyin: {
    platformId: 'douyin',
    titlePromptSpec: {
      requiredSections: [
        {
          key: 'coreFormulas',
          label: '黄金3秒公式',
          count: 5,
          fields: [
            { name: '公式名称' },
            { name: '模板结构' },
            { name: '示例' },
            { name: '适用场景' },
          ],
        },
      ],
      outputFormat: {
        label: '输出格式',
        schema: {
          titles: '数组，每个包含 text/type/reason',
          recommended: '主推标题',
        },
      },
      prohibitionFormat: '❌ 描述',
    },
    contentPromptSpec: {
      contentTypes: {
        label: '内容类型差异化',
        types: ['口播讲解类', '访谈/播客混剪类', '剧情演绎类', '知识干货类'],
      },
      requiredSections: [
        { key: 'scriptStructures', label: '脚本结构模板', count: 2 },
        { key: 'goldenQuotes', label: '金句类型', count: 1 },
        { key: 'rhythmRequirements', label: '节奏要求', count: 1 },
        { key: 'interactionDesign', label: '互动触发设计', count: 1 },
      ],
      prohibitionFormat: '❌ 描述',
      layoutRequirements: ['语速比日常说话快1.2倍', '每10秒1个有效信息点', '字幕与情绪同步'],
      interactionTypes: ['点赞触发', '评论触发', '转发触发', '关注触发'],
    },
    qualityPromptSpec: {
      dimensions: [
        { label: '标题吸引力', weight: '20%', benchmarks: { pass: '15字内，悬念/冲突', warning: '16-20字', fail: '超过20字' } },
        { label: '开头留存力', weight: '30%', benchmarks: { pass: '前3秒完播率高', warning: '3-5秒才入戏', fail: '5秒后才有重点' } },
        { label: '内容价值度', weight: '20%', benchmarks: { pass: '信息密度高，无废话', warning: '有部分废话', fail: '信息密度低' } },
        { label: '情绪感染力', weight: '15%', benchmarks: { pass: '强烈即时', warning: '有一定情绪', fail: '冷漠平淡' } },
        { label: '传播设计度', weight: '15%', benchmarks: { pass: '点赞/评论引导明确', warning: '有但不明显', fail: '无引导' } },
      ],
      scoringRules: '每项0-100分，加权求和',
      outputFormat: {
        label: '输出格式',
        schema: {
          scores: '各维度分数',
          overall: '总分',
          checklist: '判定清单',
          suggestions: '优化建议',
        },
      },
    },
  },
};

// ============================================
// 结构清晰度判断关键词
// ============================================

export const STRUCTURE_KEYWORDS = {
  // 标题相关
  title: ['公式', '示例', '禁止', '结构', '类型', '模板', '生成', '输出'],
  // 正文相关
  content: ['开头', '主体', '结尾', '金句', '禁止', '排版', '互动', '类型', '案例'],
  // 通用
  universal: ['【', '】', '##', '---', '===', '```'],
};

// ============================================
// 辅助函数
// ============================================

/**
 * 检查文本是否匹配某个标记
 */
export function matchesMarker(text: string, markers: string[]): boolean {
  const lowerText = text.toLowerCase();
  return markers.some(marker => lowerText.includes(marker.toLowerCase()));
}

/**
 * 提取变量名（匹配 {xxx} 格式）
 */
export function extractVariables(text: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.push(match[0]);
  }
  return [...new Set(variables)];
}

/**
 * 检查是否包含 JSON 输出格式
 */
export function hasJsonFormat(text: string): boolean {
  return text.includes('"titles"') ||
         text.includes('"title"') ||
         text.includes('```json') ||
         (text.includes('{') && text.includes('}') && text.includes('"'));
}

/**
 * 标准化变量名（将别名转为标准变量）
 */
export function standardizeVariable(variable: string): string {
  const trimmed = variable.trim();
  // 先检查是否是标准变量
  if (STANDARD_VARIABLES.some(v => v.name === trimmed)) {
    return trimmed;
  }
  // 检查别名映射
  return VARIABLE_ALIASES[trimmed] || trimmed;
}

/**
 * 标准化文本中的所有变量
 */
export function standardizeVariables(text: string): string {
  let result = text;

  // 先处理别名映射（按长度降序，确保先匹配长的）
  const sortedAliases = Object.keys(VARIABLE_ALIASES).sort((a, b) => b.length - a.length);

  for (const alias of sortedAliases) {
    const standard = VARIABLE_ALIASES[alias];
    const regex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, standard);
  }

  return result;
}

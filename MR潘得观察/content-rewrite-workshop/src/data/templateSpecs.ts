/**
 * 模板格式规范定义
 *
 * 定义标题/正文提示词的标准结构，用于自动修正和验证
 */

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

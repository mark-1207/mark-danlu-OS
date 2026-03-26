/**
 * 模板格式化服务
 *
 * 实现设计文档中的分级判断和格式化策略：
 * 1. detectStructureLevel() - 关键词快速判断
 * 2. smartExtract() - 智能提取
 * 3. fullRewrite() - 整体重写
 * 4. format() - 格式化入口
 */

import {
  PlatformId,
  PromptType,
  PlatformTemplateSpec,
  PLATFORM_TEMPLATE_SPECS,
  STRUCTURE_KEYWORDS,
  extractVariables,
  standardizeVariables,
  hasJsonFormat,
} from '../data/templateSpecs';
import { gzhTitlePrompt, gzhContentPrompt, xhsTitlePrompt, xhsContentPrompt, douyinTitlePrompt, douyinContentPrompt } from '../data/index';

// ============================================
// 类型定义
// ============================================

export type StructureLevel = 'clear' | 'chaotic' | 'unclear';

export interface FormatInput {
  rawContent: string;
  promptType: PromptType;
  platformId: PlatformId;
}

export interface FormatOutput {
  formatted: string;
  strategy: 'smartExtract' | 'fullRewrite' | 'noChange';
  changes: {
    original: string;
    formatted: string;
    reason: string;
  }[];
  warnings: string[];
}

// ============================================
// 主格式化入口
// ============================================

/**
 * 格式化用户输入的模板内容
 */
export function formatTemplate(input: FormatInput): FormatOutput {
  const { rawContent, promptType, platformId } = input;

  // 空内容检查
  if (!rawContent || !rawContent.trim()) {
    return {
      formatted: '',
      strategy: 'noChange',
      changes: [],
      warnings: ['内容为空'],
    };
  }

  // 获取平台规范
  const spec = PLATFORM_TEMPLATE_SPECS[platformId];
  if (!spec) {
    return {
      formatted: rawContent,
      strategy: 'noChange',
      changes: [],
      warnings: [`未知平台: ${platformId}`],
    };
  }

  // 获取对应的提示词规范
  const promptSpec = promptType === 'titlePrompt'
    ? spec.titlePromptSpec
    : promptType === 'contentPrompt'
      ? spec.contentPromptSpec
      : spec.qualityPromptSpec;

  if (!promptSpec) {
    return {
      formatted: rawContent,
      strategy: 'noChange',
      changes: [],
      warnings: [],
    };
  }

  // 第一层：关键词快速判断
  const structureLevel = detectStructureLevel(rawContent, promptType);

  let result: FormatOutput;

  switch (structureLevel) {
    case 'clear':
      // 结构清晰，使用智能提取
      result = smartExtract(rawContent, promptType, spec);
      break;
    case 'chaotic':
      // 结构混乱，使用整体重写
      result = fullRewrite(rawContent, promptType, spec);
      break;
    case 'unclear':
      // 模糊情况，尝试智能提取，如果失败则整体重写
      const extractResult = smartExtract(rawContent, promptType, spec);
      if (extractResult.changes.length === 0) {
        result = fullRewrite(rawContent, promptType, spec);
      } else {
        result = extractResult;
      }
      break;
    default:
      result = {
        formatted: rawContent,
        strategy: 'noChange',
        changes: [],
        warnings: [],
      };
  }

  return result;
}

// ============================================
// 第一层：关键词快速判断
// ============================================

/**
 * 通过关键词快速判断内容结构清晰度
 *
 * 结构清晰：检测到 ≥3 个结构关键词
 * 结构混乱：段落过长（>50行）且无结构关键词
 * 模糊情况：其他
 */
export function detectStructureLevel(content: string, promptType: PromptType): StructureLevel {
  const lines = content.split('\n');
  const text = content.toLowerCase();

  // 获取该提示词类型的关键词
  const keywords = promptType === 'titlePrompt'
    ? STRUCTURE_KEYWORDS.title
    : promptType === 'contentPrompt'
      ? STRUCTURE_KEYWORDS.content
      : [...STRUCTURE_KEYWORDS.title, ...STRUCTURE_KEYWORDS.content];

  // 统计匹配到的关键词数量
  let matchedCount = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      matchedCount++;
      matchedKeywords.push(keyword);
    }
  }

  // 检查通用结构标记
  for (const marker of STRUCTURE_KEYWORDS.universal) {
    if (content.includes(marker)) {
      matchedCount++;
      matchedKeywords.push(marker);
    }
  }

  // 结构清晰判断：有 ≥3 个结构关键词
  if (matchedCount >= 3) {
    return 'clear';
  }

  // 结构混乱判断：段落过长（>50行）且关键词少（<2个）
  if (lines.length > 50 && matchedCount < 2) {
    return 'chaotic';
  }

  // 模糊情况
  return 'unclear';
}

// ============================================
// 智能提取
// ============================================

/**
 * 智能提取 - 当内容结构清晰时使用
 * 从原文中提取关键部分，按规范整理到正确位置
 */
function smartExtract(content: string, promptType: PromptType, spec: PlatformTemplateSpec): FormatOutput {
  const changes: FormatOutput['changes'] = [];
  const warnings: string[] = [];
  let formatted = content;

  // 1. 标准化变量
  const original = formatted;
  formatted = standardizeVariables(formatted);
  if (formatted !== original) {
    changes.push({
      original: '变量格式不一致',
      formatted: '统一为标准变量格式 {xxx}',
      reason: '将中文别名转换为标准变量格式',
    });
  }

  // 2. 确保包含 JSON 输出格式（仅标题提示词）
  if (promptType === 'titlePrompt' && !hasJsonFormat(formatted)) {
    const jsonSection = `
---

## 输出格式

严格按以下JSON格式输出，禁止额外说明：

\`\`\`json
{
  "titles": [
    { "text": "标题", "type": "公式类型", "reason": "为什么能爆" }
  ],
  "recommended": "主推标题"
}
\`\`\`
`;
    formatted = formatted.trim() + jsonSection;
    changes.push({
      original: '缺少JSON输出格式',
      formatted: '添加JSON输出格式定义',
      reason: '标题提示词必须包含结构化输出格式',
    });
  }

  // 3. 清理格式
  const cleaned = cleanupFormatting(formatted);
  if (cleaned !== formatted) {
    changes.push({
      original: '格式不规整',
      formatted: '清理多余空行和空格',
      reason: '统一格式风格',
    });
    formatted = cleaned;
  }

  return {
    formatted,
    strategy: changes.length > 0 ? 'smartExtract' : 'noChange',
    changes,
    warnings,
  };
}

// ============================================
// 整体重写
// ============================================

/**
 * 整体重写 - 当内容结构混乱时使用
 * 基于平台规范重新生成结构，保留核心意思
 */
function fullRewrite(content: string, promptType: PromptType, spec: PlatformTemplateSpec): FormatOutput {
  const warnings: string[] = [];
  let formatted: string;

  // 根据平台和类型选择内置模板作为基础结构
  if (promptType === 'titlePrompt') {
    formatted = getBuiltInTitlePrompt(spec.platformId);
    warnings.push('内容结构混乱，已基于平台规范重新生成标题提示词结构');
  } else if (promptType === 'contentPrompt') {
    formatted = getBuiltInContentPrompt(spec.platformId);
    warnings.push('内容结构混乱，已基于平台规范重新生成正文提示词结构');
  } else {
    formatted = content;
    warnings.push('质检提示词不支持自动格式化');
  }

  // 提取原内容中的关键信息（如果有的话）
  const keyInfo = extractKeyInfo(content, promptType);
  if (keyInfo) {
    warnings.push(`已提取关键信息: ${keyInfo}`);
  }

  return {
    formatted,
    strategy: 'fullRewrite',
    changes: [
      {
        original: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        formatted: '已重新生成符合规范的模板结构',
        reason: '原内容结构混乱，无法智能提取',
      },
    ],
    warnings,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 清理格式
 */
function cleanupFormatting(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')  // 3个以上连续换行改为2个
    .replace(/[ \t]+\n/g, '\n')   // 行尾空格
    .replace(/\n[ \t]+/g, '\n')   // 行首缩进空格
    .trim();
}

/**
 * 从原内容中提取关键信息
 */
function extractKeyInfo(content: string, promptType: PromptType): string | null {
  const info: string[] = [];

  // 提取变量
  const vars = extractVariables(content);
  if (vars.length > 0) {
    info.push(`变量: ${vars.join(', ')}`);
  }

  // 提取关键段落（如果有的话）
  const lines = content.split('\n');
  const hasFormula = lines.some(l => l.includes('公式') || l.includes('模板'));
  const hasExample = lines.some(l => l.includes('示例') || l.includes('例子'));

  if (hasFormula) info.push('包含公式');
  if (hasExample) info.push('包含示例');

  return info.length > 0 ? info.join(', ') : null;
}

/**
 * 获取内置标题提示词模板
 */
function getBuiltInTitlePrompt(platformId: PlatformId): string {
  switch (platformId) {
    case 'gzh':
      return gzhTitlePrompt;
    case 'xhs':
      return xhsTitlePrompt;
    case 'douyin':
      return douyinTitlePrompt;
    default:
      return gzhTitlePrompt;
  }
}

/**
 * 获取内置正文提示词模板
 */
function getBuiltInContentPrompt(platformId: PlatformId): string {
  switch (platformId) {
    case 'gzh':
      return gzhContentPrompt;
    case 'xhs':
      return xhsContentPrompt;
    case 'douyin':
      return douyinContentPrompt;
    default:
      return gzhContentPrompt;
  }
}

// ============================================
// 快捷函数
// ============================================

/**
 * 快速格式化（用于设置页面保存时）
 */
export function quickFormat(rawContent: string, promptType: PromptType, platformId: PlatformId): FormatOutput {
  return formatTemplate({ rawContent, promptType, platformId });
}

/**
 * 获取格式化预览（用于UI展示）
 */
export function getFormatPreview(rawContent: string, promptType: PromptType, platformId: PlatformId): {
  original: string;
  formatted: string;
  strategy: string;
  changes: FormatOutput['changes'];
  warnings: string[];
} {
  const result = formatTemplate({ rawContent, promptType, platformId });
  return {
    original: rawContent,
    formatted: result.formatted,
    strategy: result.strategy,
    changes: result.changes,
    warnings: result.warnings,
  };
}

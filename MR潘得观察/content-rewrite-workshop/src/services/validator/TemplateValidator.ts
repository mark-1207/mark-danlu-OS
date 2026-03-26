/**
 * 模板验证器 - 分析和自动修正
 *
 * 核心功能：
 * 1. 分析用户粘贴的文本，识别结构
 * 2. 自动修正格式，整理成规范模板
 */

import type {
  AnalysisResult,
  FixedTemplate,
  ValidationResult,
} from '../../data/templateSpecs';
import {
  STANDARD_VARIABLES,
  TITLE_SECTION_SPEC,
  CONTENT_SECTION_SPEC,
  STANDARD_TITLE_JSON_FORMAT,
  extractVariables,
  standardizeVariable,
  standardizeVariables,
  hasJsonFormat,
  matchesMarker,
} from '../../data/templateSpecs';

// ============================================
// 核心分析函数
// ============================================

/**
 * 分析用户输入的文本，识别结构并提取信息
 */
export function analyzeTemplateContent(text: string): AnalysisResult {
  const result: AnalysisResult = {
    hasTitleSection: false,
    hasContentSection: false,
    rawTitleContent: '',
    rawContentContent: '',
    detectedVariables: [],
    standardVariables: [],
    missingRecommended: [],
    structureIssues: [],
    suggestions: [],
  };

  if (!text || !text.trim()) {
    result.structureIssues.push('输入内容为空');
    return result;
  }

  // 分割标题和正文部分
  const sections = splitIntoSections(text);

  // 分析标题部分
  if (sections.title) {
    result.hasTitleSection = true;
    result.rawTitleContent = sections.title;
    analyzeTitleSection(result, sections.title);
  }

  // 分析正文部分
  if (sections.content) {
    result.hasContentSection = true;
    result.rawContentContent = sections.content;
    analyzeContentSection(result, sections.content);
  }

  // 如果没有明确分割，尝试智能识别
  if (!result.hasTitleSection && !result.hasContentSection) {
    const intelligent = intelligentSplit(text);
    result.hasTitleSection = intelligent.hasTitle;
    result.hasContentSection = intelligent.hasContent;
    result.rawTitleContent = intelligent.titleContent;
    result.rawContentContent = intelligent.contentContent;

    if (intelligent.hasTitle) analyzeTitleSection(result, intelligent.titleContent);
    if (intelligent.hasContent) analyzeContentSection(result, intelligent.contentContent);

    if (intelligent.hasTitle || intelligent.hasContent) {
      result.suggestions.push('已智能识别内容结构');
    }
  }

  // 检查缺失的推荐变量
  checkMissingVariables(result);

  return result;
}

/**
 * 分割标题和正文部分
 * 支持的格式：
 * - # 标题提示词 ... # 正文提示词 ...
 * - === 标题 === ... === 正文 === ...
 */
function splitIntoSections(text: string): { title?: string; content?: string } {
  // 尝试用 # 分隔符分割
  const hashPattern = /#\s*标题[提示词]?\s*\n([\s\S]*?)(?=#\s*正文|$)/i;
  const contentPattern = /#\s*正文[提示词]?\s*\n([\s\S]*)/i;

  const hashMatch = text.match(hashPattern);
  const contentMatch = text.match(contentPattern);

  if (hashMatch && contentMatch) {
    return {
      title: hashMatch[1].trim(),
      content: contentMatch[1].trim(),
    };
  }

  // 尝试用 === 分隔符分割
  const eqPattern = /===\s*标题\s*===([\s\S]*?)(?===.*正文.*===|$)/i;
  const eqContentPattern = /===\s*正文\s*===([\s\S]*)/i;

  const eqTitleMatch = text.match(eqPattern);
  const eqContentMatch = text.match(eqContentPattern);

  if (eqTitleMatch && eqContentMatch) {
    return {
      title: eqTitleMatch[1].trim(),
      content: eqContentMatch[1].trim(),
    };
  }

  return {};
}

/**
 * 智能分割（当没有明确分隔符时）
 */
function intelligentSplit(text: string): {
  hasTitle: boolean;
  hasContent: boolean;
  titleContent: string;
  contentContent: string;
} {
  const lines = text.split('\n');
  const lowerLines = lines.map(l => l.toLowerCase());

  // 检测是否为标题提示词
  const titleIndicators = ['标题', 'title', '生成标题', '输出标题', '5个标题', '10个标题'];
  const hasTitle = lowerLines.some(l => titleIndicators.some(ind => l.includes(ind)));

  // 检测是否为正文提示词
  const contentIndicators = ['正文', 'content', '生成正文', '写文章', '文章内容', '2000字', '3000字'];
  const hasContent = lowerLines.some(l => contentIndicators.some(ind => l.includes(ind)));

  // 简单策略：前半部分给标题，后半部分给正文
  if (hasTitle && hasContent) {
    const midPoint = Math.floor(lines.length / 2);
    let splitIndex = midPoint;

    // 找到更合适的分割点（段落边界）
    for (let i = midPoint; i < lines.length - 1; i++) {
      if (lines[i].trim() === '' && lines[i + 1].trim() !== '') {
        splitIndex = i + 1;
        break;
      }
    }

    return {
      hasTitle: true,
      hasContent: true,
      titleContent: lines.slice(0, splitIndex).join('\n'),
      contentContent: lines.slice(splitIndex).join('\n'),
    };
  }

  if (hasTitle) {
    return { hasTitle: true, hasContent: false, titleContent: text, contentContent: '' };
  }

  if (hasContent) {
    return { hasTitle: false, hasContent: true, titleContent: '', contentContent: text };
  }

  // 无法识别，全部作为正文
  return { hasTitle: false, hasContent: true, titleContent: '', contentContent: text };
}

/**
 * 分析标题部分
 */
function analyzeTitleSection(result: AnalysisResult, content: string) {
  // 提取变量
  const vars = extractVariables(content);
  result.detectedVariables.push(...vars);

  // 标准化变量
  vars.forEach(v => {
    const standard = standardizeVariable(v);
    if (!result.standardVariables.includes(standard)) {
      result.standardVariables.push(standard);
    }
  });

  // 检查必需元素
  if (!hasJsonFormat(content)) {
    result.structureIssues.push('标题提示词缺少 JSON 输出格式定义');
  }

  // 检查角色定义
  const roleIndicators = ['你是', '你是一个', '角色', '专家', '师'];
  const hasRole = roleIndicators.some(ind => content.includes(ind));
  if (!hasRole) {
    result.suggestions.push('建议在标题提示词中添加角色定义（如"你是一个XXX专家"）');
  }
}

/**
 * 分析正文部分
 */
function analyzeContentSection(result: AnalysisResult, content: string) {
  // 提取变量
  const vars = extractVariables(content);
  result.detectedVariables.push(...vars);

  // 标准化变量
  vars.forEach(v => {
    const standard = standardizeVariable(v);
    if (!result.standardVariables.includes(standard)) {
      result.standardVariables.push(standard);
    }
  });

  // 检查内容类型
  const typeIndicators = ['访谈', '对话', '故事', '观点', '评论', '新闻', '时事', '演讲'];
  const hasType = typeIndicators.some(ind => content.includes(ind));
  if (!hasType) {
    result.suggestions.push('建议在正文提示词中添加内容类型说明（如访谈类、故事类）');
  }

  // 检查禁止事项
  if (!content.includes('禁止') && !content.includes('❌')) {
    result.suggestions.push('建议添加禁止事项，说明不应出现的内容');
  }
}

/**
 * 检查缺失的推荐变量
 */
function checkMissingVariables(result: AnalysisResult) {
  // 标题提示词应该有的变量
  if (result.hasTitleSection) {
    const recommendedForTitle = ['{content}', '{title}'];
    recommendedForTitle.forEach(v => {
      if (!result.standardVariables.includes(v)) {
        result.missingRecommended.push(v);
      }
    });
  }

  // 正文提示词应该有的变量
  if (result.hasContentSection) {
    const recommendedForContent = ['{content}', '{title}'];
    recommendedForContent.forEach(v => {
      if (!result.standardVariables.includes(v)) {
        result.missingRecommended.push(v);
      }
    });
  }
}

// ============================================
// 自动修正函数
// ============================================

/**
 * 根据分析结果自动修正模板
 */
export function autoFixTemplate(rawText: string, analysis: AnalysisResult): FixedTemplate {
  const appliedFixes: string[] = [];
  const warnings: string[] = [];

  let titlePrompt = analysis.rawTitleContent;
  let contentPrompt = analysis.rawContentContent;

  // 1. 标准化变量
  if (titlePrompt) {
    const original = titlePrompt;
    titlePrompt = standardizeVariables(titlePrompt);
    if (titlePrompt !== original) {
      appliedFixes.push('标准化标题提示词中的变量');
    }
  }

  if (contentPrompt) {
    const original = contentPrompt;
    contentPrompt = standardizeVariables(contentPrompt);
    if (contentPrompt !== original) {
      appliedFixes.push('标准化正文提示词中的变量');
    }
  }

  // 2. 如果缺少 JSON 格式，添加默认格式（仅标题提示词）
  if (analysis.hasTitleSection && !hasJsonFormat(titlePrompt)) {
    // 追加 JSON 格式定义
    titlePrompt = titlePrompt.trim() + '\n\n---\n\n## 输出格式\n\n严格按以下JSON格式输出：\n\n```json\n' + STANDARD_TITLE_JSON_FORMAT + '\n```';
    appliedFixes.push('为标题提示词添加 JSON 输出格式');
  }

  // 3. 整理格式
  titlePrompt = cleanupFormatting(titlePrompt);
  contentPrompt = cleanupFormatting(contentPrompt);

  // 4. 添加分隔标记（如果需要）
  let finalTitle = titlePrompt;
  let finalContent = contentPrompt;

  if (analysis.hasTitleSection && !titlePrompt.startsWith('#')) {
    finalTitle = '# 标题提示词\n\n' + titlePrompt;
    appliedFixes.push('添加标题提示词分隔标记');
  }

  if (analysis.hasContentSection && !contentPrompt.startsWith('#')) {
    finalContent = '# 正文提示词\n\n' + contentPrompt;
    appliedFixes.push('添加正文提示词分隔标记');
  }

  // 5. 如果是整体修正（未分割），尝试分割
  if (!analysis.hasTitleSection && !analysis.hasContentSection && rawText.trim()) {
    const split = intelligentSplit(rawText);
    if (split.hasTitle && split.titleContent) {
      finalTitle = '# 标题提示词\n\n' + standardizeVariables(cleanupFormatting(split.titleContent));
      appliedFixes.push('从整体内容中提取并整理标题提示词');
    }
    if (split.hasContent && split.contentContent) {
      finalContent = '# 正文提示词\n\n' + standardizeVariables(cleanupFormatting(split.contentContent));
      appliedFixes.push('从整体内容中提取并整理正文提示词');
    }
  }

  // 6. 警告信息
  if (analysis.missingRecommended.length > 0) {
    warnings.push(`建议添加变量: ${analysis.missingRecommended.join(', ')}`);
  }

  return {
    titlePrompt: finalTitle,
    contentPrompt: finalContent,
    appliedFixes,
    warnings,
  };
}

/**
 * 清理格式
 * - 移除多余空行
 * - 统一行尾空格
 */
function cleanupFormatting(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')  // 3个以上连续换行改为2个
    .replace(/[ \t]+\n/g, '\n')  // 行尾空格
    .replace(/\n[ \t]+/g, '\n')  // 行首缩进空格
    .trim();
}

// ============================================
// 验证函数
// ============================================

/**
 * 验证修正后的模板是否符合规范
 */
export function validateTemplate(titlePrompt: string, contentPrompt: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 标题提示词验证
  if (titlePrompt) {
    if (!hasJsonFormat(titlePrompt)) {
      errors.push('标题提示词缺少 JSON 输出格式定义');
    }

    const vars = extractVariables(titlePrompt);
    if (!vars.includes('{content}') && !vars.includes('{title}')) {
      warnings.push('标题提示词未检测到输入变量，建议添加 {content} 或 {title}');
    }
  }

  // 正文提示词验证
  if (contentPrompt) {
    const vars = extractVariables(contentPrompt);
    if (!vars.includes('{content}')) {
      warnings.push('正文提示词未检测到原始内容变量，建议添加 {content}');
    }

    // 检查是否有角色定义
    const roleIndicators = ['你是', '你是一个', '角色', '专家'];
    const hasRole = roleIndicators.some(ind => contentPrompt.includes(ind));
    if (!hasRole) {
      warnings.push('正文提示词缺少角色定义，建议添加"你是一个XXX专家"');
    }
  }

  // 至少要有一个
  if (!titlePrompt && !contentPrompt) {
    errors.push('模板内容为空');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// 快捷函数
// ============================================

/**
 * 一键分析并修正（最常用）
 */
export function analyzeAndFix(rawText: string): FixedTemplate {
  const analysis = analyzeTemplateContent(rawText);
  return autoFixTemplate(rawText, analysis);
}

/**
 * 获取修正预览信息（用于UI展示）
 */
export function getFixPreview(rawText: string): {
  analysis: AnalysisResult;
  fixed: FixedTemplate;
} {
  const analysis = analyzeTemplateContent(rawText);
  const fixed = autoFixTemplate(rawText, analysis);
  return { analysis, fixed };
}

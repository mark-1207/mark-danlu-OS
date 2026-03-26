/**
 * 模板验证器
 *
 * 用于校验模板内容是否符合规范
 */

import type { ValidationResult } from '../../data/templateSpecs';
import { extractVariables, hasJsonFormat } from '../../data/templateSpecs';

/**
 * 验证模板内容
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

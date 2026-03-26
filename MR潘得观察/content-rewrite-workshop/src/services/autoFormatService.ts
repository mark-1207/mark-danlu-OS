/**
 * 模板格式化服务 - 统一入口
 *
 * 封装 templateFormatter，提供更简洁的 API
 */

import { formatTemplate, type FormatInput, type FormatOutput } from './templateFormatter';

/**
 * 格式化自定义模板内容
 */
export function autoFormatTemplate(
  rawContent: string,
  promptType: 'titlePrompt' | 'contentPrompt',
  platformId: string
): FormatOutput {
  return formatTemplate({
    rawContent,
    promptType,
    platformId: platformId as any,
  });
}

/**
 * 判断是否需要显示对比弹窗
 */
export function shouldShowCompareModal(result: FormatOutput): boolean {
  return result.changes.length > 0 || result.warnings.length > 0;
}

export type { FormatInput, FormatOutput };

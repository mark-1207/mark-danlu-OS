/**
 * 提示词字数检测服务
 *
 * 检测提示词长度，当超过阈值时触发警告或精简建议
 */

// 提示词类型
export type PromptType = 'titlePrompt' | 'contentPrompt' | 'qualityPrompt';

// 提示词限制配置（字数上限）
export const PROMPT_LIMITS: Record<PromptType, number> = {
  titlePrompt: 1500,    // 标题提示词限制
  contentPrompt: 3000,  // 正文提示词限制
  qualityPrompt: 2500,  // 质检提示词限制
};

// 风险阈值（相对于限制的百分比）
export const RISK_THRESHOLDS = {
  safe: 0.8,    // ≤80% 安全
  warning: 1.0,  // 80%-100% 警告
  // >100% 高风险，触发精简
};

// 检测结果
export interface LengthCheckResult {
  promptType: PromptType;
  currentLength: number;
  limit: number;
  percentage: number;         // 占用百分比 (0-1)
  percentageDisplay: string;   // 显示用百分比字符串
  riskLevel: 'safe' | 'warning' | 'high';
  warnings: string[];
  recommendation: 'none' | 'format_only' | 'slim_and_format';
  recommendationText: string;
}

/**
 * 检测提示词长度
 */
export function checkPromptLength(
  content: string,
  promptType: PromptType
): LengthCheckResult {
  const limit = PROMPT_LIMITS[promptType];
  const currentLength = content.length;
  const percentage = currentLength / limit;
  const warnings: string[] = [];

  // 计算风险等级
  let riskLevel: 'safe' | 'warning' | 'high';
  let recommendation: 'none' | 'format_only' | 'slim_and_format';
  let recommendationText: string;

  if (percentage <= RISK_THRESHOLDS.safe) {
    // 安全
    riskLevel = 'safe';
    recommendation = 'none';
    recommendationText = '';
  } else if (percentage <= RISK_THRESHOLDS.warning) {
    // 警告
    riskLevel = 'warning';
    recommendation = 'format_only';
    recommendationText = '提示词接近限制，建议仅进行格式化以确保正常调用';
    warnings.push('提示词接近字数限制，可能会增加调用耗时');
  } else {
    // 高风险 - 触发精简
    riskLevel = 'high';
    recommendation = 'slim_and_format';
    recommendationText = '提示词超过限制，建议精简后使用，否则可能出现：';
    warnings.push('提示词过长，可能导致 429 错误风险增加');
    warnings.push('提示词过长，可能导致内容分析耗时显著增加');
    warnings.push('提示词过长，可能导致生成质量不稳定');
  }

  return {
    promptType,
    currentLength,
    limit,
    percentage,
    percentageDisplay: `${(percentage * 100).toFixed(1)}%`,
    riskLevel,
    warnings,
    recommendation,
    recommendationText,
  };
}

/**
 * 获取风险等级对应的颜色
 */
export function getRiskLevelColor(riskLevel: LengthCheckResult['riskLevel']): string {
  switch (riskLevel) {
    case 'safe':
      return 'text-green-600 bg-green-50';
    case 'warning':
      return 'text-amber-600 bg-amber-50';
    case 'high':
      return 'text-red-600 bg-red-50';
  }
}

/**
 * 获取风险等级对应的边框颜色
 */
export function getRiskLevelBorderColor(riskLevel: LengthCheckResult['riskLevel']): string {
  switch (riskLevel) {
    case 'safe':
      return 'border-green-300';
    case 'warning':
      return 'border-amber-300';
    case 'high':
      return 'border-red-300';
  }
}

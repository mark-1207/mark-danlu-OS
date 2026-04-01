/**
 * Pre-Generate Hook
 * 生成前安全检查
 */

interface GenerationContext {
  inputType: 'url' | 'search' | 'material';
  targetPlatforms: string[];
  hasApiKey: boolean;
}

interface HookResult {
  allowed: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * 执行生成前检查
 */
export function preGenerateCheck(context: GenerationContext): HookResult {
  const result: HookResult = {
    allowed: true,
    warnings: [],
    errors: []
  };

  // 1. 检查目标平台
  if (context.targetPlatforms.length === 0) {
    result.errors.push('未指定目标平台');
    result.allowed = false;
  }

  const validPlatforms = ['wechat', 'xiaohongshu', 'twitter'];
  const invalidPlatforms = context.targetPlatforms.filter(p => !validPlatforms.includes(p));
  if (invalidPlatforms.length > 0) {
    result.errors.push(`不支持的平台: ${invalidPlatforms.join(', ')}`);
    result.allowed = false;
  }

  // 2. 检查API Key（如果有质量评估）
  if (context.hasApiKey === false) {
    result.warnings.push('未检测到 LLM API Key，将使用基础模式');
  }

  // 3. 平台数量提醒
  if (context.targetPlatforms.length > 3) {
    result.warnings.push('目标平台超过3个，生成时间可能较长');
  }

  return result;
}

/**
 * 格式化检查结果
 */
export function formatHookResult(result: HookResult): string {
  let message = '';

  if (result.errors.length > 0) {
    message += `❌ 生成被阻止:\n`;
    result.errors.forEach(e => message += `  - ${e}\n`);
  }

  if (result.warnings.length > 0) {
    message += `⚠️ 警告:\n`;
    result.warnings.forEach(w => message += `  - ${w}\n`);
  }

  if (result.allowed && result.warnings.length === 0) {
    message += `✅ 检查通过，准备生成`;
  }

  return message;
}

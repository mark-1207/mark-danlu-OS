// 模板提示词汇总
// 由 scripts/regen-prompts.cjs 自动生成

export { analysisPrompt } from './analysisPrompt';
export { titlePrompt as gzhTitlePrompt, contentPrompt as gzhContentPrompt } from './gzhContentPrompt';
export { qualityPrompt as gzhQualityPrompt } from './gzhQualityPrompt';
export { systemPrompt as gzhSystemPrompt, optimizePrompt as gzhOptimizationPrompt } from './gzhOptimizationPrompt';
export { titlePrompt as xhsTitlePrompt, contentPrompt as xhsContentPrompt } from './xhsContentPrompt';
export { qualityPrompt as xhsQualityPrompt } from './xhsQualityPrompt';
export { systemPrompt as xhsSystemPrompt, optimizePrompt as xhsOptimizationPrompt } from './xhsOptimizationPrompt';
export { titlePrompt as douyinTitlePrompt, contentPrompt as douyinContentPrompt } from './douyinContentPrompt';
export { qualityPrompt as douyinQualityPrompt } from './douyinQualityPrompt';
export { systemPrompt as douyinSystemPrompt, optimizePrompt as douyinOptimizationPrompt } from './douyinOptimizationPrompt';

// 模板格式规范
export * from './templateSpecs';

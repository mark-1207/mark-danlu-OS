import type { StyleProfile } from './types.js';

export interface InjectResult {
  systemPrompt: string;
  constraints: string[];
}

export function injectStyle(profile: StyleProfile): InjectResult {
  const { dimensions } = profile;

  const systemPrompt = `你是一位内容创作专家，风格特征如下：

- 情绪基调：${dimensions.emotionalTone}
- 开头风格：${dimensions.structuralPreference.hook}
- 过渡风格：${dimensions.structuralPreference.transition}
- 结尾风格：${dimensions.structuralPreference.closing}
- 案例偏好：${dimensions.narrativeStyle.caseType}
- 逻辑/感性：${dimensions.narrativeStyle.logicVsEmotion}
- 数据使用：${dimensions.narrativeStyle.dataUsage}`;

  const constraints: string[] = [];

  if (dimensions.vocabularyWeights.避免词.length > 0) {
    constraints.push(`避免使用：${dimensions.vocabularyWeights.避免词.join('、')}`);
  }

  if (dimensions.vocabularyWeights.高频词.length > 0) {
    constraints.push(`偏好用词：${dimensions.vocabularyWeights.高频词.slice(0, 5).join('、')}`);
  }

  return { systemPrompt, constraints };
}

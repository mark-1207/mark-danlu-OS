/**
 * LLM 路由模块
 * 根据任务类型选择合适的模型
 */

import { z } from 'zod';
import type { LLMTaskType, LLMModel } from '../types.js';

// 维度权重配置
export const DIMENSION_WEIGHTS = {
  emotion: 0.25,
  utility: 0.25,
  narrative: 0.20,
  socialCurrency: 0.15,
  controversy: 0.10,
  timeliness: 0.05,
} as const;

// 评分标准
export const SCORING_CRITERIA = {
  emotion: {
    9: '强烈情绪冲击，让人"必须转"',
    7: '有共鸣或好奇，有转发冲动',
    5: '有情绪但不强烈',
    3: '情绪平淡',
    1: '毫无情绪波动',
  },
  utility: {
    9: '3个以上可直接用的方法/工具/模板',
    7: '有2个具体可操作的方法点',
    5: '有价值但不具体',
    3: '空泛道理，无干货',
    1: '无任何实用价值',
  },
  narrative: {
    9: '完整故事弧线，有画面感',
    7: '有故事框架，叙事流畅',
    5: '有素材但不成故事',
    3: '干巴巴的罗列',
    1: '无叙事，纯流水账',
  },
} as const;

// LLM路由配置
const MODEL_ROUTING: Record<LLMTaskType, LLMModel> = {
  evaluation: 'glm',         // 质量评估
  wechat: 'glm',              // 微信公众号深度长文
  xiaohongshu: 'glm',         // 小红书情绪共鸣
  twitter: 'glm',             // Twitter短平快
  search: 'glm',              // 搜索资料
  analyze: 'glm',             // 内容分析
};

// API端点配置
const API_ENDPOINTS: Record<LLMModel, string> = {
  claude: 'https://api.anthropic.com/v1/messages',
  gpt: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
};

// 获取任务对应的模型
export function getModelForTask(task: LLMTaskType): LLMModel {
  return MODEL_ROUTING[task];
}

// 获取API端点
export function getEndpoint(model: LLMModel): string {
  return API_ENDPOINTS[model];
}

// LLM响应schema
export const LLMResponseSchema = z.object({
  content: z.string(),
  model: z.string().optional(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }).optional(),
});

// 调用LLM的通用接口
export async function callLLM(
  model: LLMModel,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<z.infer<typeof LLMResponseSchema>> {
  const endpoint = getEndpoint(model);

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let body: Record<string, unknown>;

  if (model === 'claude') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: allMessages.filter((m) => m.role !== 'system'),
      system: systemPrompt,
    };
  } else if (model === 'glm') {
    // 智谱 AI GLM-4
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = {
      model: 'glm-4',
      messages: allMessages.map(m => ({
        role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
    };
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
    const modelMap: Record<LLMModel, string> = {
      claude: 'gpt-4o',
      gpt: 'gpt-4o',
      deepseek: 'deepseek-chat',
      kimi: 'moonshot-v1-8k',
      glm: 'glm-4',
    };
    body = {
      model: modelMap[model],
      messages: allMessages,
      temperature: 0.7,
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API错误 (${response.status}): ${error}`);
  }

  const data: any = await response.json();

  // 统一响应格式
  if (model === 'claude') {
    return {
      content: data.content[0].text,
      model: data.model,
      usage: data.usage,
    };
  } else if (model === 'glm') {
    // 智谱 AI GLM-4
    return {
      content: data.choices[0].message.content,
      model: data.model || 'glm-4',
      usage: data.usage ? {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
      } : undefined,
    };
  } else {
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
    };
  }
}

// 计算加权总分
export function calculateOverallScore(scores: {
  emotion: number;
  utility: number;
  narrative: number;
  socialCurrency: number;
  controversy: number;
  timeliness: number;
}): number {
  const weighted =
    scores.emotion * DIMENSION_WEIGHTS.emotion +
    scores.utility * DIMENSION_WEIGHTS.utility +
    scores.narrative * DIMENSION_WEIGHTS.narrative +
    scores.socialCurrency * DIMENSION_WEIGHTS.socialCurrency +
    scores.controversy * DIMENSION_WEIGHTS.controversy +
    scores.timeliness * DIMENSION_WEIGHTS.timeliness;

  return Math.round(weighted * 10); // 转换为0-100
}

// 判断决策路径
export function getDecisionPath(score: number): 'A' | 'B' | 'C' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

// 生成评分prompt
export function generateEvaluationPrompt(content: string): string {
  return `你是一个内容质量评估专家。请评估以下内容的"爆款潜力"。

评估维度（每项1-10分）：
1. 情绪激发度(25%)：能否让人产生强烈情绪反应（焦虑/兴奋/愤怒/共鸣）
2. 实用价值(25%)：是否有可直接使用的干货（方法/工具/数据/案例）
3. 叙事结构(20%)：是否有完整的故事弧线
4. 社交货币(15%)：转发能彰显读者什么身份/品味
5. 争议引导(10%)：是否有讨论空间
6. 时效贴切(5%)：是否贴合当前热点

评分标准：
- 9-10分：顶级（如：3个以上可直接用的方法、完整故事弧线）
- 7-8分：良好（如：有2个具体可操作的方法点）
- 5-6分：一般（如：有价值但不具体）
- 3-4分：较弱（如：空泛道理）
- 1-2分：极差（如：无叙事、毫无情绪）

请以JSON格式输出评估结果：
{
  "scores": {
    "emotion": X,
    "utility": X,
    "narrative": X,
    "socialCurrency": X,
    "controversy": X,
    "timeliness": X
  },
  "diagnostics": [
    {
      "dimension": "维度名",
      "issue": "问题描述",
      "suggestions": ["建议1", "建议2"]
    }
  ],
  "overallScore": XX,
  "decisionPath": "A或B或C",
  "reasoning": "评分理由"
}

内容如下：
${content.slice(0, 3000)}`;
}

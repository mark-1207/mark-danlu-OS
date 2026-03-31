/**
 * 内容分析模块
 * 深度解码内容，拆解为原子内容块
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ContentAtom,
  ContentDecodedReport,
  ExtractedContent,
  Platform,
} from '../types.js';

/**
 * 生成分析prompt
 */
function generateAnalyzePrompt(content: string): string {
  return `你是一个内容拆解专家。请深度分析以下内容，拆解为结构化的原子内容块。

## 分析任务

1. **意图解构**
   - 核心主张（一句话说清楚）
   - 目标读者（痛点/痒点/爽点）
   - 预期读者反应

2. **情绪图谱**
   - 主要触发情绪（焦虑/兴奋/愤怒/共鸣/好奇/恐惧/敬畏）
   - 情绪曲线（开头→铺垫→高潮→结尾）
   - 情绪锚点（最强记忆点）

3. **价值主张**
   - 实用价值（具体方法/工具/数据/案例）
   - 认知价值（颠覆的旧认知）
   - 社交价值（转发能彰显什么）

4. **叙事结构**
   - 故事类型（英雄之旅/问题-方案/对比反差/揭秘揭示/权威背书）
   - 是否有开头钩子
   - 是否有结尾升华

5. **病毒元素**
   - 可分享金句（独立存在也能理解）
   - 争议性观点（引发讨论）
   - 具体数据锚点
   - 身份认同（目标读者画像）

6. **原子内容块拆分**
   将内容拆分为可复用的最小单位：
   - 观点块：核心论点
   - 金句块：独立可传播的精炼语句
   - 案例块：具体故事/例子
   - 数据块：具体数字/统计
   - 方法论块：可操作的步骤/框架
   - 故事块：叙事性段落

请以JSON格式输出：
{
  "intent": {
    "coreClaim": "一句话核心主张",
    "targetReader": "目标读者描述",
    "expectedReaction": "预期读者反应"
  },
  "emotionMap": {
    "primaryEmotion": "主要情绪",
    "emotionCurve": ["情绪1", "情绪2"],
    "anchorPoints": ["锚点1", "锚点2"]
  },
  "valueClaims": {
    "practical": ["实用价值1", "实用价值2"],
    "cognitive": ["认知价值1"],
    "social": ["社交价值1"]
  },
  "narrativeStructure": {
    "type": "故事类型",
    "hasHook": true/false,
    "hasEnding": true/false,
    "storyElements": ["元素1", "元素2"]
  },
  "viralElements": {
    "sharableQuotes": ["金句1", "金句2"],
    "controversialPoints": ["争议点1"],
    "dataAnchors": ["数据1"],
    "identityTags": ["标签1", "标签2"]
  },
  "atoms": [
    {
      "type": "观点/金句/案例/数据/方法论/故事",
      "content": "内容",
      "viralElements": ["情绪共鸣", "实用价值"],
      "platformSuitability": ["wechat", "xiaohongshu"],
      "reusability": "high/medium/low"
    }
  ]
}

内容如下：
${content.slice(0, 4000)}`;
}

/**
 * 内容分析主函数
 */
export async function analyze(
  extracted: ExtractedContent,
  llmCall: (prompt: string) => Promise<string>
): Promise<{
  report: ContentDecodedReport;
  atoms: ContentAtom[];
}> {
  const prompt = generateAnalyzePrompt(extracted.content);
  const response = await llmCall(prompt);

  // 解析JSON响应
  let parsed: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('未找到有效的JSON');
    }
  } catch (error) {
    console.error('解析分析结果失败:', error);
    // 返回默认结构
    parsed = generateDefaultReport(extracted);
  }

  // 提取原子块
  const atoms: ContentAtom[] = (parsed.atoms || []).map((atom: any) => ({
    id: uuidv4(),
    type: atom.type || '观点',
    content: atom.content || '',
    viralElements: atom.viralElements || [],
    platformSuitability: (atom.platformSuitability || ['wechat']) as Platform[],
    reusability: atom.reusability || 'medium',
  }));

  // 构建报告
  const report: ContentDecodedReport = {
    intent: parsed.intent || {
      coreClaim: extracted.metadata.title || '未识别',
      targetReader: '职场人/创业者',
      expectedReaction: '认知颠覆+行动冲动',
    },
    emotionMap: parsed.emotionMap || {
      primaryEmotion: '共鸣',
      emotionCurve: ['好奇', '共鸣', '兴奋'],
      anchorPoints: [],
    },
    valueClaims: parsed.valueClaims || {
      practical: [],
      cognitive: [],
      social: [],
    },
    narrativeStructure: parsed.narrativeStructure || {
      type: '问题-方案',
      hasHook: true,
      hasEnding: true,
      storyElements: [],
    },
    viralElements: parsed.viralElements || {
      sharableQuotes: [],
      controversialPoints: [],
      dataAnchors: [],
      identity认同: [],
    },
  };

  return { report, atoms };
}

/**
 * 生成默认报告（当LLM解析失败时）
 */
function generateDefaultReport(extracted: ExtractedContent): any {
  return {
    intent: {
      coreClaim: extracted.metadata.title || '未识别',
      targetReader: '职场人/创业者',
      expectedReaction: '认知提升',
    },
    emotionMap: {
      primaryEmotion: '共鸣',
      emotionCurve: ['好奇', '共鸣'],
      anchorPoints: [],
    },
    valueClaims: {
      practical: [],
      cognitive: [],
      social: [],
    },
    narrativeStructure: {
      type: '问题-方案',
      hasHook: true,
      hasEnding: true,
      storyElements: [],
    },
    viralElements: {
      sharableQuotes: [],
      controversialPoints: [],
      dataAnchors: [],
      identityTags: [],
    },
    atoms: [],
  };
}

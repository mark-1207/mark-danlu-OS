/**
 * 平台适配器接口定义
 */

import type { ContentAtom, ContentDecodedReport, Platform } from '../types.js';

/**
 * 适配内容上下文
 */
export interface ContentContext {
  title: string;
  decodedReport: ContentDecodedReport;
  sourceContent: string;
}

/**
 * 适配输出内容
 */
export interface AdaptedContent {
  platform: Platform;
  title: string;
  content: string;
  wordCount: number;
  tags?: string[];          // 小红书标签
  threadCount?: number;     // Twitter thread 条数
  coverSuggestion?: string;  // 封面建议
}

/**
 * 自检结果
 */
export interface CheckResult {
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  /** 平台标识 */
  platform: Platform;

  /** 平台名称 */
  name: string;

  /** 目标字数 */
  targetLength: {
    min: number;
    max: number;
    optimal: number;
  };

  /**
   * 将原子内容块适配为平台格式
   */
  adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent>;

  /**
   * 自检清单
   */
  checklist(content: AdaptedContent): CheckResult;
}

/**
 * 通用平台适配 prompt 生成
 */
export function generateAdapterPrompt(
  platform: Platform,
  atoms: ContentAtom[],
  context: ContentContext
): string {
  const platformConfigs = {
    wechat: {
      name: '微信公众号',
      length: '1500-2500字',
      structure: '开头钩子 → 方法论 → 案例 → 金句 → 结尾行动号召',
    },
    xiaohongshu: {
      name: '小红书',
      length: '600-1000字',
      structure: '封面文字 → 开头共鸣 → 干货内容 → 结尾引导互动',
    },
    twitter: {
      name: 'Twitter/X',
      length: '150-280字',
      structure: '前3字抓人 → 核心观点 → 可扩展为Thread',
    },
  };

  const config = platformConfigs[platform];

  return `你是一个${config.name}内容创作专家。请将以下原子内容块改编为${config.name}爆款内容。

## 目标平台要求
- 字数：${config.length}
- 结构：${config.structure}

## 原始内容主题
${context.title}

## 原始内容解码报告
- 核心主张：${context.decodedReport.intent.coreClaim}
- 目标读者：${context.decodedReport.intent.targetReader}
- 主要情绪：${context.decodedReport.emotionMap.primaryEmotion}
- 情绪曲线：${context.decodedReport.emotionMap.emotionCurve.join(' → ')}
- 故事类型：${context.decodedReport.narrativeStructure.type}

## 可用原子内容块
${atoms.map((a, i) => `[块${i + 1}] ${a.type}：${a.content}`).join('\n')}

## 爆款元素参考
- 可分享金句：${context.decodedReport.viralElements.sharableQuotes.join('、')}
- 争议性观点：${context.decodedReport.viralElements.controversialPoints.join('、')}
- 具体数据：${context.decodedReport.viralElements.dataAnchors.join('、')}

## 输出要求
请以JSON格式输出：
{
  "title": "标题（8-30字，有钩子）",
  "content": "正文内容",
  "tags": ["标签1", "标签2", "标签3"],
  "coverSuggestion": "封面文字建议"
}

确保内容：
1. 情绪共鸣强烈，能让人"必须转"
2. 有实用价值，干货满满
3. 叙事流畅，有故事感
4. 符合平台调性`;
}

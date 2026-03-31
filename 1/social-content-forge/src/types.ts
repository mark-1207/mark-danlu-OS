/**
 * Social Content Forge - 类型定义
 */

// 输入类型
export type InputType = 'url' | 'search' | 'material';

// 目标平台
export type Platform = 'wechat' | 'xiaohongshu' | 'twitter';

// 内容状态
export type ContentStatus = '草稿' | '已确认' | '已发布';

// 原子内容块类型
export type AtomType = '观点' | '金句' | '案例' | '数据' | '故事' | '方法论';

// 决策路径
export type DecisionPath = 'A' | 'B' | 'C';

// 情绪类型
export type EmotionType = '焦虑' | '兴奋' | '愤怒' | '共鸣' | '好奇' | '恐惧' | '敬畏';

// 叙事类型
export type NarrativeType = '英雄之旅' | '问题-方案' | '对比反差' | '揭秘揭示' | '权威背书';

// 原子内容块
export interface ContentAtom {
  id: string;
  type: AtomType;
  content: string;
  viralElements: string[];
  platformSuitability: Platform[];
  reusability: 'high' | 'medium' | 'low';
}

// 内容解码报告
export interface ContentDecodedReport {
  intent: {
    coreClaim: string;
    targetReader: string;
    expectedReaction: string;
  };
  emotionMap: {
    primaryEmotion: EmotionType;
    emotionCurve: EmotionType[];
    anchorPoints: string[];
  };
  valueClaims: {
    practical: string[];
    cognitive: string[];
    social: string[];
  };
  narrativeStructure: {
    type: NarrativeType;
    hasHook: boolean;
    hasEnding: boolean;
    storyElements: string[];
  };
  viralElements: {
    sharableQuotes: string[];
    controversialPoints: string[];
    dataAnchors: string[];
    identity认同: string[];
  };
}

// 六维度评分
export interface DimensionScores {
  emotion: number;        // 0-10
  utility: number;        // 0-10
  narrative: number;      // 0-10
  socialCurrency: number; // 0-10
  controversy: number;    // 0-10
  timeliness: number;     // 0-10
}

// 诊断
export interface Diagnostic {
  dimension: string;
  score: number;
  issue: string;
  suggestions: string[];
}

// 爆款预测
export interface ViralPrediction {
  platform: Platform;
  readRange: string;
  confidence: number;
  factors: string[];
  risks: string[];
}

// 评估结果
export interface EvaluationResult {
  overallScore: number;
  dimensionScores: DimensionScores;
  decisionPath: DecisionPath;
  diagnostics: Diagnostic[];
  viralPredictions: ViralPrediction[];
}

// 平台输出
export interface PlatformOutput {
  platform: Platform;
  title: string;
  content: string;
  wordCount: number;
  filePath: string;
}

// 提取结果
export interface ExtractedContent {
  type: InputType;
  source: string;
  content: string;
  metadata: {
    title?: string;
    author?: string;
    publishTime?: string;
    source: string;
  };
}

// 生成结果
export interface GenerationResult {
  contentId: string;
  extracted: ExtractedContent;
  decodedReport: ContentDecodedReport;
  atoms: ContentAtom[];
  evaluation: EvaluationResult;
  outputs: PlatformOutput[];
  feishuRecordId?: string;
  createdAt: string;
}

// LLM模型类型
export type LLMModel = 'claude' | 'gpt' | 'deepseek' | 'kimi' | 'glm';

// LLM路由任务类型
export type LLMTaskType = 'evaluation' | 'wechat' | 'xiaohongshu' | 'twitter' | 'search' | 'analyze';

// LLM配置
export interface LLMConfig {
  model: LLMModel;
  apiKey: string;
  baseUrl?: string;
}

// 飞书配置
export interface FeishuConfig {
  appId: string;
  appSecret: string;
  tableId: string;
}

// 数据库记录
export interface ContentRecord {
  id: string;
  sourceType: InputType;
  sourceUrl?: string;
  title: string;
  createdAt: string;
  status: ContentStatus;
  overallScore: number;
}

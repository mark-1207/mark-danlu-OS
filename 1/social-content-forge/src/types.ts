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
    identityTags: string[];
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

// ============================================
// V2 Types
// ============================================

// Nine-dimension scores (upgrade from 6-dimension)
export interface NineDimensionScores {
  emotion: number;              // 0-10
  utility: number;              // 0-10
  narrative: number;            // 0-10
  socialCurrency: number;       // 0-10
  controversy: number;          // 0-10
  timeliness: number;          // 0-10
  differentiation: number;     // 0-10 NEW
  shareability: number;        // 0-10 NEW
  conversionPotential: number;  // 0-10 NEW
}

// Evaluation result V2 (extends V1)
export interface EvaluationResultV2 extends EvaluationResult {
  dimensionScores: NineDimensionScores;  // Override parent type
  hasVeto: boolean;             // true if any dimension < 5
  vetoDimensions?: string[];    // list of dimensions that vetoed
}

// Hot topic from discovery
export interface HotTopic {
  id: string;
  platform: 'weibo' | 'twitter' | 'google' | 'xiaohongshu' | 'reddit';
  title: string;
  heatScore?: number;
  category?: string;
  link?: string;
  fetchedAt: Date;
}

// Material package for prompt injection
export interface MaterialPackage {
  viralQuotes: string[];        // extractable sharable quotes
  caseStudies: string[];       // concrete examples/data
  counterArguments: string[];  // anti-consensus viewpoints
  sourceArticle?: string;      // reference article URL
}

// Audience profile
export interface AudienceProfile {
  core: string[];               // core audience description
  edge: string[];              // edge audience description
  painPoints: string[];         // what they struggle with
  aspirations: string[];         // what they want
}

// Dynamic prompt context for generation
export interface DynamicPromptContext {
  taskBackground: string;
  materialPackage?: MaterialPackage;
  improvementSuggestions: string[];
  targetAudience: AudienceProfile;
  styleExamples?: StyleExample[];
}

// Style example from library
export interface StyleExample {
  type: 'good' | 'bad';
  content: string;
  whatWorks?: string;    // for good examples
  whatFails?: string;    // for bad examples
}

// Self-evolution generation result
export interface GenerationWithQuality {
  content: PlatformContent;
  passed: boolean;
  score: number;
  vetoDimensions?: string[];
  improvementSuggestions: string[];
  llmUsed: string;
  iterations: number;
}

// Platform content (per platform)
export interface PlatformContent {
  platform: Platform;
  title: string;
  body: string;           // full Markdown content
  wordCount: number;
  tags?: string[];       // for Xiaohongshu
  coverText?: string;    // for Xiaohongshu
  threadCount?: number;  // for Twitter thread
}

// Style library index
export interface StyleLibraryIndex {
  lastUpdated: string;
  goodCount: number;
  badCount: number;
  lastCheckedCase?: string;  // last processed case ID
}

// Style insight
export interface StyleInsight {
  id: string;
  addedAt: string;
  sourceCase: string;         // case file name
  insight: string;            // what was learned
  applicableDimensions: string[];  // which quality dimensions
  confirmed: boolean;
}

// LLM call type (for dependency injection)
export type LLMCall = (model: string, prompt: string) => Promise<string>;

// ============================================
// Similarity Verifier Types
// ============================================

// Similarity dimension thresholds (适中级别)
export interface SimilarityThresholds {
  caseSimilarity: number;      // ≤20%
  quoteSimilarity: number;     // ≤15%
  semanticSimilarity: number;  // ≤70%
  titleDiff: number;          // ≥60%
  openingEndingDiff: number;  // ≥50%
}

export const DEFAULT_SIMILARITY_THRESHOLDS: SimilarityThresholds = {
  caseSimilarity: 20,
  quoteSimilarity: 15,
  semanticSimilarity: 70,
  titleDiff: 60,
  openingEndingDiff: 50,
};

// Similarity dimension weights (for overall score)
export const SIMILARITY_DIMENSION_WEIGHTS = {
  caseSimilarity: 0.30,
  quoteSimilarity: 0.20,
  semanticSimilarity: 0.30,
  titleDiff: 0.10,
  openingEndingDiff: 0.10,
} as const;

// Single dimension result
export interface DimensionResult {
  score: number;
  passed: boolean;
  detail?: string;
}

// Full similarity verification result
export interface SimilarityResult {
  passed: boolean;
  overallScore: number;    // 0-100, higher = more different (pass = overallScore <= 70)
  dimensions: {
    caseSimilarity: DimensionResult;
    quoteSimilarity: DimensionResult;
    semanticSimilarity: DimensionResult;
    titleDiff: DimensionResult;
    openingEndingDiff: DimensionResult;
  };
  summary: string;         // Human-readable summary for user
  iterationCount: number;
  rawReport?: string;      // Optional detailed report for 追问
}

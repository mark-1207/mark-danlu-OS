/**
 * 质检报告类型定义
 *
 * 注意：维度定义为动态的，由 qualityPrompt 模板决定
 * UI 层需要能够渲染任意维度的质检报告
 */

// 动态维度
export interface Dimension {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warning' | 'fail';
  evidence?: string;
  reason: string;
}

// 清单项
export interface ChecklistItem {
  id: string;
  name: string;
  passed: boolean | 'partial';
  reason: string;
  evidence?: string;
  position?: string;
}

// 优化建议
export interface OptimizationSuggestion {
  id: string;
  content: string;
  position?: string;
  priority: 'high' | 'medium' | 'low';
  original?: string;
  optimized?: string;
  logic?: string;
}

// 统一质检报告
export interface QualityReport {
  overallScore: number;
  grade: 'excellent' | 'good' | 'average' | 'poor';
  dimensions: Dimension[];
  checklist: ChecklistItem[];
  optimizationSuggestions: OptimizationSuggestion[];
}

// 计算维度状态
export function calculateDimensionStatus(score: number, maxScore: number): 'pass' | 'warning' | 'fail' {
  const ratio = score / maxScore;
  if (ratio >= 0.8) return 'pass';
  if (ratio >= 0.5) return 'warning';
  return 'fail';
}

// 计算等级
export function calculateGrade(score: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (score >= 9) return 'excellent';
  if (score >= 8) return 'good';
  if (score >= 6) return 'average';
  return 'poor';
}

// 规范化维度名称（让 AI 返回的名称更友好展示）
export function normalizeDimensionName(id: string): string {
  const nameMap: Record<string, string> = {
    // 公众号
    titleSpread: '标题传播性',
    crowdAccuracy: '人群精准度',
    socialCurrency: '社交货币',
    contentDensity: '内容密度',
    retentionDesign: '留存设计',
    // 小红书
    titleHook: '标题/首图钩子',
    collectableValue: '可收藏价值',
    seoKeyword: 'SEO关键词',
    interactionDesign: '互动设计',
    // 抖音
    hook3s: '3秒钩子',
    hotPoint15s: '15秒爆点',
    rhythmDensity: '节奏密度',
    interactionKeyword: '互动关键词',
    forwardGuide: '转发引导',
    // 通用别名
    titleAppeal: '标题吸引力',
    openingRetention: '开头留存',
    contentValue: '内容价值',
    emotionInfluence: '情绪感染',
    viralDesign: '传播设计',
    layoutBeauty: '排版美观',
  };

  return nameMap[id] || id;
}

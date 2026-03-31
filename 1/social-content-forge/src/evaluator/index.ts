/**
 * 内容评估模块
 * 六维度评分 + 诊断 + 爆款预测
 */

import type {
  ContentAtom,
  ContentDecodedReport,
  EvaluationResult,
  Diagnostic,
  ViralPrediction,
  Platform,
  DimensionScores,
} from '../types.js';
import {
  generateEvaluationPrompt,
  calculateOverallScore,
  getDecisionPath,
  DIMENSION_WEIGHTS,
} from '../llm/router.js';

/**
 * 评估主函数
 */
export async function evaluate(
  atoms: ContentAtom[],
  decodedReport: ContentDecodedReport,
  llmCall: (prompt: string) => Promise<string>
): Promise<EvaluationResult> {
  // 合并所有原子块内容用于评估
  const combinedContent = atoms.map((a) => a.content).join('\n\n');

  const prompt = generateEvaluationPrompt(combinedContent);
  const response = await llmCall(prompt);

  // 解析评估结果
  let parsed: any;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('未找到有效的JSON');
    }
  } catch (error) {
    console.error('解析评估结果失败:', error);
    return generateDefaultEvaluation();
  }

  // 构建维度分数
  const scores: DimensionScores = {
    emotion: parsed.scores?.emotion || 5,
    utility: parsed.scores?.utility || 5,
    narrative: parsed.scores?.narrative || 5,
    socialCurrency: parsed.scores?.socialCurrency || 5,
    controversy: parsed.scores?.controversy || 5,
    timeliness: parsed.scores?.timeliness || 5,
  };

  // 计算总分
  const overallScore = parsed.overallScore || calculateOverallScore(scores);

  // 决策路径
  const decisionPath = parsed.decisionPath || getDecisionPath(overallScore);

  // 构建诊断
  const diagnostics: Diagnostic[] = (parsed.diagnostics || []).map((d: any) => ({
    dimension: d.dimension,
    score: scores[d.dimension as keyof DimensionScores] || 5,
    issue: d.issue || '需要优化',
    suggestions: d.suggestions || [],
  }));

  // 爆款预测
  const viralPredictions: ViralPrediction[] = generatePredictions(
    overallScore,
    scores,
    decodedReport
  );

  return {
    overallScore,
    dimensionScores: scores,
    decisionPath,
    diagnostics,
    viralPredictions,
  };
}

/**
 * 生成爆款预测
 */
function generatePredictions(
  overallScore: number,
  scores: DimensionScores,
  report: ContentDecodedReport
): ViralPrediction[] {
  const platforms: Platform[] = ['wechat', 'xiaohongshu', 'twitter'];
  const predictions: ViralPrediction[] = [];

  for (const platform of platforms) {
    let baseRange: string;
    let confidence: number;
    let factors: string[] = [];
    let risks: string[] = [];

    // 根据评分和平台特性调整预测
    const score80 = overallScore >= 80;
    const score60 = overallScore >= 60;

    if (platform === 'wechat') {
      // 微信：深度内容平台
      if (score80) {
        baseRange = '5万-20万';
        confidence = 0.8;
      } else if (score60) {
        baseRange = '1万-5万';
        confidence = 0.65;
      } else {
        baseRange = '3000-1万';
        confidence = 0.5;
      }

      if (scores.narrative >= 7) {
        factors.push('叙事结构好，适合微信传播');
      }
      if (scores.utility >= 7) {
        factors.push('实用价值高，收藏率高');
      }
      if (scores.emotion < 6) {
        risks.push('情绪强度不足，开头可能流失读者');
      }
    } else if (platform === 'xiaohongshu') {
      // 小红书：种草/情绪平台
      if (score80 && scores.emotion >= 7) {
        baseRange = '1万-10万';
        confidence = 0.75;
      } else if (score60) {
        baseRange = '3000-1万';
        confidence = 0.6;
      } else {
        baseRange = '500-3000';
        confidence = 0.45;
      }

      if (scores.emotion >= 8) {
        factors.push('情绪共鸣强，适合小红书');
      }
      if (report.viralElements.sharableQuotes.length > 0) {
        factors.push('有可分享金句');
      }
      if (scores.emotion < 6) {
        risks.push('情绪不够强烈，不适合小红书');
      }
    } else {
      // Twitter：观点传播平台
      if (score80 && scores.socialCurrency >= 7) {
        baseRange = '高转发';
        confidence = 0.7;
      } else if (score60) {
        baseRange = '中等转发';
        confidence = 0.55;
      } else {
        baseRange = '低转发';
        confidence = 0.4;
      }

      if (scores.socialCurrency >= 7) {
        factors.push('社交货币价值高');
      }
      if (report.viralElements.controversialPoints.length > 0) {
        factors.push('有争议性观点，容易引发讨论');
      }
      if (scores.narrative < 5) {
        risks.push('叙事不足，不适合Twitter');
      }
    }

    predictions.push({
      platform,
      readRange: baseRange,
      confidence,
      factors,
      risks,
    });
  }

  return predictions;
}

/**
 * 生成默认评估（当解析失败时）
 */
function generateDefaultEvaluation(): EvaluationResult {
  const scores: DimensionScores = {
    emotion: 5,
    utility: 5,
    narrative: 5,
    socialCurrency: 5,
    controversy: 5,
    timeliness: 5,
  };

  return {
    overallScore: 50,
    dimensionScores: scores,
    decisionPath: 'C',
    diagnostics: [
      {
        dimension: '整体',
        score: 5,
        issue: '评估超时，使用默认评分',
        suggestions: ['请人工检查内容质量'],
      },
    ],
    viralPredictions: [],
  };
}

/**
 * 格式化评估报告为Markdown
 */
export function formatEvaluationReport(
  evaluation: EvaluationResult,
  title: string
): string {
  const { dimensionScores, overallScore, decisionPath, diagnostics, viralPredictions } =
    evaluation;

  const pathDescriptions = {
    A: '直接适配（具备爆款潜力）',
    B: '优化后适配（可发布但建议优化）',
    C: '建议重构（缺乏爆款基因）',
  };

  let report = `# 内容质量评估报告

## 综合评分：${overallScore}/100

**决策路径：${decisionPath}** - ${pathDescriptions[decisionPath]}

## 六维度评分

| 维度 | 得分 | 权重 | 说明 |
|------|------|------|------|
| 情绪激发度 | ${dimensionScores.emotion}/10 | 25% | ${getScoreDescription('emotion', dimensionScores.emotion)} |
| 实用价值 | ${dimensionScores.utility}/10 | 25% | ${getScoreDescription('utility', dimensionScores.utility)} |
| 叙事结构 | ${dimensionScores.narrative}/10 | 20% | ${getScoreDescription('narrative', dimensionScores.narrative)} |
| 社交货币 | ${dimensionScores.socialCurrency}/10 | 15% | 转发能彰显读者身份 |
| 争议引导 | ${dimensionScores.controversy}/10 | 10% | 讨论空间 |
| 时效贴切 | ${dimensionScores.timeliness}/10 | 5% | 与热点关联度 |

## 诊断与建议

`;

  if (diagnostics.length === 0) {
    report += '*暂无详细诊断*\n';
  } else {
    for (const d of diagnostics) {
      report += `### ${d.dimension}（${d.score}分）

**问题**：${d.issue}

**建议**：
`;
      for (const s of d.suggestions) {
        report += `- ${s}\n`;
      }
      report += '\n';
    }
  }

  report += `## 爆款预测

| 平台 | 预估范围 | 置信度 | 有利因素 | 风险 |
|------|---------|--------|---------|------|
`;

  for (const p of viralPredictions) {
    report += `| ${p.platform} | ${p.readRange} | ${(p.confidence * 100).toFixed(0)}% | ${p.factors.join(', ') || '-'} | ${p.risks.join(', ') || '-'} |\n`;
  }

  return report;
}

function getScoreDescription(dimension: keyof DimensionScores, score: number): string {
  const descriptions: Record<string, Record<number, string>> = {
    emotion: {
      9: '强烈冲击',
      7: '有共鸣',
      5: '较平淡',
      3: '无感',
    },
    utility: {
      9: '3个+干货',
      7: '2个方法',
      5: '有价值',
      3: '较空泛',
    },
    narrative: {
      9: '完整故事',
      7: '有框架',
      5: '有素材',
      3: '流水账',
    },
  };

  const dimDescs = descriptions[dimension];
  if (!dimDescs) return '';

  if (score >= 9) return dimDescs[9];
  if (score >= 7) return dimDescs[7];
  if (score >= 5) return dimDescs[5];
  if (score >= 3) return dimDescs[3];
  return '极差';
}

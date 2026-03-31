/**
 * 内容评估模块
 * 九维度评分 + 诊断 + 爆款预测 + 否决逻辑
 */

import {
  ContentAtom,
  ContentDecodedReport,
  EvaluationResult,
  EvaluationResultV2,
  NineDimensionScores,
  Diagnostic,
  LLMCall,
} from '../types';

const SIX_DIMENSION_WEIGHTS = {
  emotion: 0.25,
  utility: 0.25,
  narrative: 0.20,
  socialCurrency: 0.15,
  controversy: 0.10,
  timeliness: 0.05,
};

const NINE_DIMENSION_WEIGHTS = {
  emotion: 0.20,
  utility: 0.20,
  narrative: 0.15,
  socialCurrency: 0.10,
  controversy: 0.10,
  timeliness: 0.05,
  differentiation: 0.10,
  shareability: 0.05,
  conversionPotential: 0.05,
};

const VETO_THRESHOLD = 5;
const PASSING_SCORE = 85;

/**
 * 评估主函数 V2 - 九维度评估
 */
export async function evaluateV2(
  atoms: ContentAtom[],
  decodedReport: ContentDecodedReport,
  llmCall: LLMCall
): Promise<EvaluationResultV2> {
  // Merge all atom content
  const allContent = atoms.map(a => a.content).join('\n');

  // Build evaluation prompt
  const prompt = buildEvaluationPromptV2(allContent, decodedReport);

  // Call LLM
  const response = await llmCall('claude', prompt);

  // Parse response
  const parsed = parseEvaluationResponse(response);

  // Calculate weighted score
  const weightedScore = calculateWeightedScoreV2(parsed.scores);

  // Check for veto
  const hasVeto = checkVeto(parsed.scores);

  // Generate diagnostics
  const diagnostics = generateDiagnostics(parsed.scores);

  return {
    overallScore: weightedScore,
    dimensionScores: parsed.scores,
    decisionPath: getDecisionPath(weightedScore),
    hasVeto,
    vetoDimensions: hasVeto ? getVetoDimensions(parsed.scores) : undefined,
    diagnostics,
    viralPredictions: [],
  };
}

/**
 * Legacy evaluate function - wraps V2 result
 */
export async function evaluate(
  atoms: ContentAtom[],
  decodedReport: ContentDecodedReport,
  llmCall: LLMCall
): Promise<EvaluationResult> {
  const v2Result = await evaluateV2(atoms, decodedReport, llmCall);

  // Convert V2 to V1 format for backwards compatibility
  return {
    overallScore: v2Result.overallScore,
    dimensionScores: v2Result.dimensionScores as any, // Cast for compatibility
    decisionPath: v2Result.decisionPath,
    diagnostics: v2Result.diagnostics,
    viralPredictions: v2Result.viralPredictions,
  };
}

function buildEvaluationPromptV2(content: string, decodedReport: ContentDecodedReport): string {
  return `请对以下内容进行九维度质量评估：

内容：
${content}

解码报告摘要：
- 核心观点：${decodedReport.intent?.coreClaim || '未知'}
- 目标读者：${decodedReport.intent?.targetReader || '未知'}
- 预期反应：${decodedReport.intent?.expectedReaction || '未知'}

评分维度（每项0-10分）：
1. 情绪激发度：能否引发强烈情绪反应
2. 实用价值：读者能得到什么具体好处
3. 叙事结构：故事是否引人入胜，开头是否有钩子
4. 社交货币：转发能彰显转发者什么身份
5. 争议引导：能否引发讨论而非沉默
6. 时效贴切：是否契合当前热点/趋势
7. 差异化程度：和同类内容有什么不同
8. 可转发场景：读者在什么场景会转发
9. 转化潜力：能否推动关注/互动/行动

【否决条件】任一维度<5分则一票否决
【加权总分】≥85分通过

请返回JSON格式：
{
  "scores": {
    "emotion": X,
    "utility": X,
    "narrative": X,
    "socialCurrency": X,
    "controversy": X,
    "timeliness": X,
    "differentiation": X,
    "shareability": X,
    "conversionPotential": X
  },
  "weightedScore": XX,
  "diagnostics": ["..."]
}`;
}

function parseEvaluationResponse(response: string): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fall through
  }

  // Default response if parsing fails
  return {
    scores: {
      emotion: 7,
      utility: 7,
      narrative: 7,
      socialCurrency: 6,
      controversy: 5,
      timeliness: 6,
      differentiation: 6,
      shareability: 6,
      conversionPotential: 6,
    },
    weightedScore: 70,
    diagnostics: ['评估解析失败，使用默认分数'],
  };
}

export function calculateWeightedScoreV2(scores: NineDimensionScores): number {
  let total = 0;
  for (const [dim, score] of Object.entries(scores)) {
    const weight = NINE_DIMENSION_WEIGHTS[dim as keyof typeof NINE_DIMENSION_WEIGHTS];
    if (weight !== undefined) {
      total += score * weight * 10;
    }
  }
  return Math.round(total);
}

export function checkVeto(scores: NineDimensionScores): boolean {
  return Object.values(scores).some(score => score < VETO_THRESHOLD);
}

export function getVetoDimensions(scores: NineDimensionScores): string[] {
  const dimensions: string[] = [];
  for (const [dim, score] of Object.entries(scores)) {
    if (score < VETO_THRESHOLD) {
      dimensions.push(dim);
    }
  }
  return dimensions;
}

export function getDecisionPath(score: number): 'A' | 'B' | 'C' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

function generateDiagnostics(scores: NineDimensionScores): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const dimensionNames: Record<string, string> = {
    emotion: '情绪激发度',
    utility: '实用价值',
    narrative: '叙事结构',
    socialCurrency: '社交货币',
    controversy: '争议引导',
    timeliness: '时效贴切',
    differentiation: '差异化程度',
    shareability: '可转发场景',
    conversionPotential: '转化潜力',
  };

  for (const [dim, score] of Object.entries(scores)) {
    const name = dimensionNames[dim] || dim;
    if (score < 7) {
      diagnostics.push({
        dimension: name,
        score,
        issue: score < VETO_THRESHOLD ? '一票否决' : '偏低',
        suggestions: getSuggestions(dim, score),
      });
    }
  }

  return diagnostics;
}

function getSuggestions(dim: string, score: number): string[] {
  const suggestions: Record<string, string[]> = {
    emotion: ['增加情绪触发点', '用个人故事开场', '增加共鸣场景'],
    utility: ['增加实用建议', '给出具体步骤', '添加可执行清单'],
    narrative: ['改善开头钩子', '增加故事元素', '优化结尾'],
    socialCurrency: ['增加身份认同点', '加入圈层归属感', '强化转发理由'],
    controversy: ['适度增加反常识观点', '提出引发讨论的问题'],
    timeliness: ['关联当前热点', '增加时效性内容'],
    differentiation: ['增加独特视角', '避免老生常谈', '提炼差异化观点'],
    shareability: ['增加金句', '提供转发场景', '创造社交货币'],
    conversionPotential: ['增加行动号召', '引导互动', '明确下一步'],
  };

  return suggestions[dim] || ['继续优化'];
}

export function formatEvaluationReport(
  evaluation: EvaluationResult | EvaluationResultV2,
  title: string
): string {
  const v2 = 'hasVeto' in evaluation ? evaluation as EvaluationResultV2 : null;
  const scores = evaluation.dimensionScores as NineDimensionScores;

  let report = `# 内容质量评估报告\n\n`;
  report += `## ${title}\n\n`;
  report += `**总分：${evaluation.overallScore}**\n`;

  if (v2?.hasVeto) {
    report += `**一票否决维度：**${v2.vetoDimensions?.join('、')}\n`;
  }

  report += `\n## 九维度评分\n\n`;
  report += `| 维度 | 分数 | 说明 |\n`;
  report += `|------|------|------|\n`;

  const dimensionNames: Record<string, string> = {
    emotion: '情绪激发度',
    utility: '实用价值',
    narrative: '叙事结构',
    socialCurrency: '社交货币',
    controversy: '争议引导',
    timeliness: '时效贴切',
    differentiation: '差异化程度',
    shareability: '可转发场景',
    conversionPotential: '转化潜力',
  };

  for (const [dim, name] of Object.entries(dimensionNames)) {
    const score = scores[dim as keyof NineDimensionScores];
    const vetoMark = score < VETO_THRESHOLD ? ' [VETO]' : '';
    report += `| ${name} | ${score}/10 |${score < 7 ? ' 偏低' : score >= 8 ? ' 优秀' : ' 良好'}${vetoMark} |\n`;
  }

  if (evaluation.diagnostics && evaluation.diagnostics.length > 0) {
    report += `\n## 诊断建议\n\n`;
    for (const d of evaluation.diagnostics) {
      report += `- **${d.dimension}**(${d.score}分): ${d.issue}\n`;
      if (d.suggestions.length > 0) {
        report += `  - 建议: ${d.suggestions.join('、')}\n`;
      }
    }
  }

  return report;
}

// Backwards compatibility - 6 dimension weights
export const DIMENSION_WEIGHTS = {
  emotion: 0.25,
  utility: 0.25,
  narrative: 0.20,
  socialCurrency: 0.15,
  controversy: 0.10,
  timeliness: 0.05,
};

/**
 * Calculate overall score using the 6-dimension weights (backwards compatibility)
 */
export function calculateOverallScore(scores: {
  emotion: number;
  utility: number;
  narrative: number;
  socialCurrency: number;
  controversy: number;
  timeliness: number;
}): number {
  const weighted =
    scores.emotion * SIX_DIMENSION_WEIGHTS.emotion +
    scores.utility * SIX_DIMENSION_WEIGHTS.utility +
    scores.narrative * SIX_DIMENSION_WEIGHTS.narrative +
    scores.socialCurrency * SIX_DIMENSION_WEIGHTS.socialCurrency +
    scores.controversy * SIX_DIMENSION_WEIGHTS.controversy +
    scores.timeliness * SIX_DIMENSION_WEIGHTS.timeliness;

  return Math.round(weighted * 10); // 转换为0-100
}

/**
 * Generate evaluation prompt (backwards compatibility)
 */
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

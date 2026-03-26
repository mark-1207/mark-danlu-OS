/**
 * 质检结果解析器
 */

import type {
  QualityReport,
  LLMQualityResponse,
  PlatformId,
  QualityCheckItem,
  CheckRating,
  PlatformQualityDimensions,
  GzhQualityDimensions,
  XhsQualityDimensions,
  DouyinQualityDimensions,
} from '../types';

import { calculateViralProbability, calculateGrade, PLATFORM_DIMENSION_CONFIG } from '../types';

/**
 * 提取 JSON（去掉 markdown 代码块）
 */
function extractJson(str: string): string {
  let s = str.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```\w*\n?/, '').replace(/```$/, '');
  }
  return s.trim();
}

/**
 * 通用分数提取（兼容旧格式number和新格式object）
 */
function getScore(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
    return (val as any).score || (val as any).分数 || 0;
  }
  return 0;
}

/**
 * 从维度值提取证据（用于新格式的evidence字段）
 */
function getEvidence(val: any): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    return (val as any).evidence || (val as any).引用 || '';
  }
  return '';
}

/**
 * 从维度值提取判定理由（用于新格式的reason字段）
 */
function getReason(val: any): string {
  if (typeof val === 'object' && val !== null) {
    return (val as any).reason || (val as any).判定理由 || '';
  }
  return '';
}

/**
 * 解析维度（公众号）
 */
function parseGzhDimensions(dims: Record<string, any>): GzhQualityDimensions {
  const mapping: Record<string, keyof GzhQualityDimensions> = {
    '标题传播性': 'titleSpread', '标题/摘要传播性': 'titleSpread', '标题吸引力': 'titleSpread',
    '人群精准度': 'crowdAccuracy',
    '社交货币属性': 'socialCurrency', '社交货币': 'socialCurrency',
    '内容密度': 'contentDensity',
    '留存引导设计': 'retentionDesign',
  };
  const result: GzhQualityDimensions = { titleSpread: 0, crowdAccuracy: 0, socialCurrency: 0, contentDensity: 0, retentionDesign: 0 };
  for (const [key, value] of Object.entries(dims)) {
    const mapped = mapping[key] || key as keyof GzhQualityDimensions;
    if (mapped in result) result[mapped] = getScore(value);
  }
  return result;
}

/**
 * 解析维度（小红书）
 */
function parseXhsDimensions(dims: Record<string, any>): XhsQualityDimensions {
  const mapping: Record<string, keyof XhsQualityDimensions> = {
    '标题钩子': 'titleHook', '标题/首图钩子': 'titleHook', '首图钩子': 'titleHook',
    '人群精准度': 'crowdAccuracy',
    '可收藏价值密度': 'collectableValue', '收藏价值': 'collectableValue',
    'SEO关键词布局': 'seoKeyword', '关键词布局': 'seoKeyword',
    '互动/传播设计': 'interactionDesign', '互动设计': 'interactionDesign',
  };
  const result: XhsQualityDimensions = { titleHook: 0, crowdAccuracy: 0, collectableValue: 0, seoKeyword: 0, interactionDesign: 0 };
  for (const [key, value] of Object.entries(dims)) {
    const mapped = mapping[key] || key as keyof XhsQualityDimensions;
    if (mapped in result) result[mapped] = getScore(value);
  }
  return result;
}

/**
 * 解析维度（抖音）
 */
function parseDouyinDimensions(dims: Record<string, any>): DouyinQualityDimensions {
  const mapping: Record<string, keyof DouyinQualityDimensions> = {
    '3秒钩子': 'hook3s', '3秒钩子有效性': 'hook3s', '黄金钩子': 'hook3s',
    '15秒爆点': 'hotPoint15s', '15秒爆点达标率': 'hotPoint15s', '爆点达标率': 'hotPoint15s',
    '节奏密度': 'rhythmDensity', '信息密度': 'rhythmDensity',
    '互动/关键词设计': 'interactionKeyword', '互动关键词': 'interactionKeyword',
    '转发引导设计': 'forwardGuide', '转发引导': 'forwardGuide',
  };
  const result: DouyinQualityDimensions = { hook3s: 0, hotPoint15s: 0, rhythmDensity: 0, interactionKeyword: 0, forwardGuide: 0 };
  for (const [key, value] of Object.entries(dims)) {
    const mapped = mapping[key] || key as keyof DouyinQualityDimensions;
    if (mapped in result) result[mapped] = getScore(value);
  }
  return result;
}

/**
 * 从 JSON 解析质检报告（支持新旧两种格式）
 */
function parseFromJSON(parsed: LLMQualityResponse, platformId: PlatformId): QualityReport {
  const dims = parsed.dimensions || {};
  const overallScore = parsed.overallScore || 0;

  let dimensions: PlatformQualityDimensions;
  if (platformId === 'gzh') dimensions = parseGzhDimensions(dims);
  else if (platformId === 'xhs') dimensions = parseXhsDimensions(dims);
  else dimensions = parseDouyinDimensions(dims);

  const dimValues = Object.values(dimensions as Record<string, number>);
  const calculatedScore = dimValues.reduce((sum, val) => sum + val, 0);
  const finalScore = overallScore || calculatedScore;
  const { probability, level } = calculateViralProbability(finalScore);

  // 构建 checklist：优先使用新格式的 evidence/reason，其次用旧的 checklist
  const checklist: QualityCheckItem[] = buildChecklistFromDimensions(dims, platformId);

  return {
    overallScore: finalScore,
    grade: calculateGrade(finalScore),
    viralProbability: probability,
    viralLevel: level,
    dimensions,
    checklist,
    platformId,
  };
}

/**
 * 从维度数据构建 Checklist（适配新格式的 evidence/reason）
 */
function buildChecklistFromDimensions(dims: Record<string, any>, platformId: PlatformId): QualityCheckItem[] {
  const config = PLATFORM_DIMENSION_CONFIG[platformId] || [];
  const checklist: QualityCheckItem[] = [];
  let index = 0;

  for (const [key, value] of Object.entries(dims)) {
    const score = getScore(value);
    const evidence = getEvidence(value);
    const reason = getReason(value);

    // 查找对应的维度配置
    const dimConfig = config.find(c => c.key === key || c.label.includes(key));
    const label = dimConfig?.label || key;
    const maxScore = dimConfig?.maxScore || 10;

    // 根据分数计算 rating
    const ratio = maxScore > 0 ? score / maxScore : 0;
    let rating: CheckRating = 'warning';
    if (ratio >= 0.8) rating = 'pass';
    else if (ratio < 0.5) rating = 'fail';

    checklist.push({
      id: String(++index),
      item: label,
      rating,
      score,
      maxScore,
      reason: reason || evidence || `得分${score}/${maxScore}`,
    });
  }

  return checklist;
}

/**
 * 从文本解析质检报告（降级方案）
 */
function parseFromText(content: string, platformId: PlatformId): QualityReport {
  const configs = PLATFORM_DIMENSION_CONFIG[platformId];
  let overallScore = 60;
  const dimScores: Record<string, number> = {};

  for (const config of configs || []) {
    const patterns = [
      new RegExp(`${config.label}[：:]*\\s*(\\d+(?:\\.\\d)?)`, 'i'),
      new RegExp(`(${config.key})[：:]*\\s*(\\d+(?:\\.\\d)?)`, 'i'),
    ];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) { dimScores[config.key] = parseFloat(m[1]); break; }
    }
  }

  const scores = Object.values(dimScores);
  if (scores.length > 0) overallScore = scores.reduce((sum, s) => sum + s, 0);
  const { probability, level } = calculateViralProbability(overallScore);

  const checklist: QualityCheckItem[] = [];
  const checkLines = content.split(/\n/).filter(line =>
    line.includes('通过') || line.includes('达标') || line.includes('❌') || line.includes('✅') || line.includes('⚠️')
  );
  checkLines.forEach((item, index) => {
    const rating: CheckRating = item.includes('✅') || item.includes('达标') ? 'pass' : item.includes('⚠️') ? 'warning' : 'fail';
    checklist.push({
      id: String(index + 1),
      item: item.replace(/^[✅❌⚠️\s]+/, '').trim(),
      rating,
      score: rating === 'pass' ? 10 : rating === 'warning' ? 6 : 3,
      maxScore: 10,
      reason: item,
    });
  });

  let dimensions: PlatformQualityDimensions;
  if (platformId === 'gzh') dimensions = dimScores as unknown as GzhQualityDimensions;
  else if (platformId === 'xhs') dimensions = dimScores as unknown as XhsQualityDimensions;
  else dimensions = dimScores as unknown as DouyinQualityDimensions;

  return {
    overallScore,
    grade: calculateGrade(overallScore),
    viralProbability: probability,
    viralLevel: level,
    dimensions,
    checklist,
    platformId,
  };
}

/**
 * 统一解析入口
 */
export function parseQualityReport(content: string, platformId: PlatformId): QualityReport {
  try {
    const jsonStr = extractJson(content);
    const parsed = JSON.parse(jsonStr);
    return parseFromJSON(parsed, platformId);
  } catch {
    return parseFromText(content, platformId);
  }
}

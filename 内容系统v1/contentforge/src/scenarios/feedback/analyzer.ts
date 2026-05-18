import type { FeedbackRecord, FeedbackSignal, GapAnalysis, WeakPattern, FeedbackStats } from './types.js';

function calcEngagement(r: FeedbackRecord): number {
  const reads = r.fields.阅读量;
  if (!reads) return 0;
  return (r.fields.点赞数 + r.fields.评论数 + r.fields.转发数) / reads;
}

function safeAvg(values: number[]): number {
  const nonZero = values.filter(v => v > 0);
  if (nonZero.length === 0) return 0;
  return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
}

function groupBy<T>(records: T[], keyFn: (r: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const r of records) {
    const k = keyFn(r);
    if (!k) continue;
    if (!map[k]) map[k] = [];
    map[k].push(r);
  }
  return map;
}

/**
 * Compute per-dimension stats (avg reads, avg engagement) for feedback records.
 */
export function computeFeedbackStats(records: FeedbackRecord[]): FeedbackStats {
  const allReads = records.map(r => r.fields.阅读量).filter(v => v > 0);
  const allEng = records.map(calcEngagement).filter(v => v > 0);

  const byPlatform = groupBy(records, r => r.fields.平台);
  const byTag = groupBy(records, r => r.fields.主题标签.join(',')); // treat as composite key
  const byStructure = groupBy(records, r => r.fields.叙事结构);
  const byTone = groupBy(records, r => r.fields.情感调性);
  const byAngle = groupBy(records, r => r.fields.内容角度);

  function dimStats(grouped: Record<string, FeedbackRecord[]>): Record<string, { avgReads: number; avgEngagement: number; count: number }> {
    const result: Record<string, { avgReads: number; avgEngagement: number; count: number }> = {};
    for (const [k, recs] of Object.entries(grouped)) {
      if (!k) continue;
      result[k] = {
        avgReads: safeAvg(recs.map(r => r.fields.阅读量)),
        avgEngagement: safeAvg(recs.map(calcEngagement)),
        count: recs.length,
      };
    }
    return result;
  }

  return {
    totalArticles: records.length,
    avgReads: safeAvg(allReads),
    avgEngagement: safeAvg(allEng),
    byPlatform: dimStats(byPlatform),
    byTag: {}, // tags are multi-value, handled separately
    byStructure: dimStats(byStructure),
    byTone: dimStats(byTone),
    byAngle: dimStats(byAngle),
  };
}

/**
 * Identify the top N performing items across dimensions.
 */
export function topPerformers<T>(
  records: FeedbackRecord[],
  groupFn: (r: FeedbackRecord) => string,
  metricFn: (r: FeedbackRecord) => number,
  n = 5,
): { key: string; avg: number; count: number }[] {
  const grouped = groupBy(records, groupFn);
  const results: { key: string; avg: number; count: number }[] = [];
  for (const [k, recs] of Object.entries(grouped)) {
    if (!k) continue;
    results.push({ key: k, avg: safeAvg(recs.map(metricFn)), count: recs.length });
  }
  return results.sort((a, b) => b.avg - a.avg).slice(0, n);
}

/**
 * Identify weak patterns — dimensions where engagement is consistently below average.
 */
export function findWeakPatterns(records: FeedbackRecord[], avgEngagement: number): WeakPattern[] {
  const weak: WeakPattern[] = [];

  const structures = groupBy(records, r => r.fields.叙事结构);
  for (const [s, recs] of Object.entries(structures)) {
    if (!s) continue;
    const avg = safeAvg(recs.map(calcEngagement));
    if (avg > 0 && avg < avgEngagement * 0.7) {
      weak.push({
        dimension: 'structure',
        value: s,
        avgEngagement: avg,
        recommendation: `【叙事结构】${s}结构的内容互动偏低，建议生成时回避或改用故事型/对比型结构`,
      });
    }
  }

  const tones = groupBy(records, r => r.fields.情感调性);
  for (const [t, recs] of Object.entries(tones)) {
    if (!t) continue;
    const avg = safeAvg(recs.map(calcEngagement));
    if (avg > 0 && avg < avgEngagement * 0.7) {
      weak.push({
        dimension: 'tone',
        value: t,
        avgEngagement: avg,
        recommendation: `【情感调性】${t}调性的内容互动偏低，建议尝试温暖/励志等更易引发共鸣的调性`,
      });
    }
  }

  const angles = groupBy(records, r => r.fields.内容角度);
  for (const [a, recs] of Object.entries(angles)) {
    if (!a) continue;
    const avg = safeAvg(recs.map(calcEngagement));
    if (avg > 0 && avg < avgEngagement * 0.7) {
      weak.push({
        dimension: 'angle',
        value: a,
        avgEngagement: avg,
        recommendation: `【内容角度】"${a}"角度的内容互动偏低，建议尝试其他切入角度`,
      });
    }
  }

  return weak;
}

export function buildFeedbackSignal(records: FeedbackRecord[]): FeedbackSignal {
  const stats = computeFeedbackStats(records);

  const topPlat = topPerformers(records, r => r.fields.平台, calcEngagement, 1)[0];
  const topTags = topPerformers(records, r => r.fields.主题标签.join(','), calcEngagement, 5);
  const topAngles = topPerformers(records, r => r.fields.内容角度, calcEngagement, 5);
  const topStructures = topPerformers(records, r => r.fields.叙事结构, calcEngagement, 5);
  const topTones = topPerformers(records, r => r.fields.情感调性, calcEngagement, 5);

  const weakPatterns = findWeakPatterns(records, stats.avgEngagement);

  // Platform diff: avg engagement per platform
  const platformDiff: Record<string, number> = {};
  for (const [p, data] of Object.entries(stats.byPlatform)) {
    platformDiff[p] = data.avgEngagement;
  }

  return {
    topPlatform: topPlat?.key ?? '',
    topTags: topTags.map(t => t.key),
    topAngles: topAngles.map(a => a.key),
    topStructures: topStructures.map(s => s.key),
    topTones: topTones.map(t => t.key),
    engagementRate: stats.avgEngagement,
    platformDiff,
    weakPatterns,
  };
}

/**
 * Compare my feedback data with competitor data for the same tag.
 * Competitor data comes from the topic pipeline's Feishu records (via analyzer.ts).
 */
export function compareWithCompetitor(
  myRecords: FeedbackRecord[],
  competitorEngagementByTag: Record<string, number>,
): GapAnalysis[] {
  const myByTag: Record<string, FeedbackRecord[]> = {};
  for (const r of myRecords) {
    for (const tag of r.fields.主题标签) {
      if (!myByTag[tag]) myByTag[tag] = [];
      myByTag[tag].push(r);
    }
  }

  const gaps: GapAnalysis[] = [];
  for (const [tag, recs] of Object.entries(myByTag)) {
    const myAvg = safeAvg(recs.map(calcEngagement));
    const compAvg = competitorEngagementByTag[tag] ?? 0;
    const gap = myAvg - compAvg;
    const direction = gap > 0.01 ? 'mine_better' : gap < -0.01 ? 'competitor_better' : 'parity';

    let recommendation = '';
    if (direction === 'competitor_better') {
      recommendation = `【${tag}】竞品数据优于你，建议：①参考竞品爆款结构的叙事方式 ②优化标题和开头 ③加强内容深度`;
    } else if (direction === 'mine_better') {
      recommendation = `【${tag}】你的数据优于竞品，继续保持当前策略，可尝试放大差异化`;
    } else {
      recommendation = `【${tag}】与竞品基本持平，可关注结构创新寻找突破点`;
    }

    gaps.push({ myTag: tag, myAvgEngagement: myAvg, competitorAvgEngagement: compAvg, gap, direction, recommendation });
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}
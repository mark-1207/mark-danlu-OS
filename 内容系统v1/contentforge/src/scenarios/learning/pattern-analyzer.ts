// Pattern analyzer — extracts effective patterns from revision/feedback/competitor data

import type { PatternRecord, PlatformPreferences, CreativePreferences, Source } from './types.js';
import type { RevisionManifest } from '../revision/types.js';
import type { FeedbackRecord } from '../feedback/types.js';
import type { FeishuRecord } from '../topic/types.js';

interface AnalyzeOptions {
  minSampleSize?: number; // 最小样本量阈值
}

/**
 * 从 revision manifest 提取 title/hook 有效模式
 */
function extractRevisionPatterns(manifests: RevisionManifest[]): PatternRecord[] {
  const patterns: Map<string, PatternRecord> = new Map();

  for (const manifest of manifests) {
    for (const version of manifest.versions) {
      const meta = version.learningMetadata;
      if (!meta) continue;

      for (const m of meta) {
        const key = `${m.element}:${m.instructionDetail ?? m.instruction}:${m.platform}`;

        if (!patterns.has(key)) {
          patterns.set(key, {
            type: m.element as PatternRecord['type'],
            pattern: m.instructionDetail ?? m.instruction,
            source: 'revision',
            instruction: m.instruction,
            instructionDetail: m.instructionDetail,
            changeScope: m.changeScope,
            adoptionRate: 0,
            count: 0,
          });
        }

        const p = patterns.get(key)!;
        p.count += 1;
        if (m.adopted) {
          p.adoptionRate = ((p.adoptionRate ?? 0) * (p.count - 1) + 1) / p.count;
        }
      }
    }
  }

  return Array.from(patterns.values());
}

/**
 * 从 feedback records 计算各维度平均互动率
 * Future: normalize against competitor baseline per tag
 * For now: raw engagement rate = (likes + comments + shares) / reads
 */
function extractFeedbackPatterns(records: FeedbackRecord[]): PatternRecord[] {
  const patterns: PatternRecord[] = [];

  // 按叙事结构分组
  const byStructure = new Map<string, { totalEng: number; count: number }>();
  const byTone = new Map<string, { totalEng: number; count: number }>();
  const byAngle = new Map<string, { totalEng: number; count: number }>();
  const byTag = new Map<string, { totalEng: number; count: number }>();

  for (const r of records) {
    const reads = r.fields.阅读量 ?? 0;
    if (!reads) continue;
    const eng = ((r.fields.点赞数 ?? 0) + (r.fields.评论数 ?? 0) + (r.fields.转发数 ?? 0)) / reads;

    if (r.fields.叙事结构) {
      const e = byStructure.get(r.fields.叙事结构) ?? { totalEng: 0, count: 0 };
      byStructure.set(r.fields.叙事结构, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
    if (r.fields.情感调性) {
      const e = byTone.get(r.fields.情感调性) ?? { totalEng: 0, count: 0 };
      byTone.set(r.fields.情感调性, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
    if (r.fields.内容角度) {
      const e = byAngle.get(r.fields.内容角度) ?? { totalEng: 0, count: 0 };
      byAngle.set(r.fields.内容角度, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
    for (const tag of (r.fields.主题标签 ?? [])) {
      const e = byTag.get(tag) ?? { totalEng: 0, count: 0 };
      byTag.set(tag, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
  }

  for (const [structure, data] of byStructure) {
    patterns.push({
      type: 'structure',
      pattern: structure,
      source: 'feedback',
      engagementRate: data.totalEng / data.count,
      count: data.count,
    });
  }
  for (const [tone, data] of byTone) {
    patterns.push({
      type: 'tone',
      pattern: tone,
      source: 'feedback',
      engagementRate: data.totalEng / data.count,
      count: data.count,
    });
  }
  for (const [angle, data] of byAngle) {
    patterns.push({
      type: 'angle',
      pattern: angle,
      source: 'feedback',
      engagementRate: data.totalEng / data.count,
      count: data.count,
    });
  }

  return patterns;
}

/**
 * 从 competitor records 计算市场基准
 */
function extractCompetitorPatterns(records: FeishuRecord[]): PatternRecord[] {
  const patterns: PatternRecord[] = [];

  const byStructure = new Map<string, { totalEng: number; count: number }>();
  const byTone = new Map<string, { totalEng: number; count: number }>();

  for (const r of records) {
    const reads = r.fields.阅读数 ?? 0;
    if (!reads) continue;
    const eng = ((r.fields.点赞数 ?? 0) + (r.fields.评论数 ?? 0) + (r.fields.转发数 ?? 0)) / reads;

    if (r.fields.叙事结构) {
      const e = byStructure.get(r.fields.叙事结构) ?? { totalEng: 0, count: 0 };
      byStructure.set(r.fields.叙事结构, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
    if (r.fields.情感调性) {
      const e = byTone.get(r.fields.情感调性) ?? { totalEng: 0, count: 0 };
      byTone.set(r.fields.情感调性, { totalEng: e.totalEng + eng, count: e.count + 1 });
    }
  }

  for (const [structure, data] of byStructure) {
    patterns.push({
      type: 'structure',
      pattern: structure,
      source: 'competitor',
      engagementRate: data.totalEng / data.count,
      count: data.count,
    });
  }
  for (const [tone, data] of byTone) {
    patterns.push({
      type: 'tone',
      pattern: tone,
      source: 'competitor',
      engagementRate: data.totalEng / data.count,
      count: data.count,
    });
  }

  return patterns;
}

/**
 * 计算置信度
 */
function computeConfidence(count: number): 'low' | 'medium' | 'high' {
  if (count >= 20) return 'high';
  if (count >= 5) return 'medium';
  return 'low';
}

/**
 * 合并多源数据，计算平台偏好
 */
function buildPlatformPreferences(
  revisionRecords: PatternRecord[],
  feedbackRecords: PatternRecord[],
  competitorRecords: PatternRecord[],
): PlatformPreferences {
  // 计算结构偏好（feedback > competitor）
  const structurePrefs = new Map<string, { eng: number; revCount: number; fbCount: number; compCount: number }>();
  for (const p of [...feedbackRecords.filter(r => r.type === 'structure'), ...competitorRecords.filter(r => r.type === 'structure')]) {
    const e = structurePrefs.get(p.pattern) ?? { eng: 0, revCount: 0, fbCount: 0, compCount: 0 };
    if (p.source === 'feedback' && p.engagementRate) {
      e.eng = (e.eng * e.fbCount + p.engagementRate) / (e.fbCount + 1);
      e.fbCount += 1;
    }
    if (p.source === 'competitor' && p.engagementRate) {
      e.eng = (e.eng * e.compCount + p.engagementRate) / (e.compCount + 1);
      e.compCount += 1;
    }
    if (p.source === 'revision' && p.adoptionRate) {
      e.revCount += 1;
    }
    structurePrefs.set(p.pattern, e);
  }

  // 找最高互动率的结构
  let topStructure = { name: '', eng: 0, count: 0 };
  for (const [name, data] of structurePrefs) {
    const count = data.fbCount + data.compCount;
    if (data.eng > topStructure.eng) {
      topStructure = { name, eng: data.eng, count };
    }
  }

  // 计算调性偏好
  const tonePrefs = new Map<string, { eng: number; fbCount: number; compCount: number }>();
  for (const p of [...feedbackRecords.filter(r => r.type === 'tone'), ...competitorRecords.filter(r => r.type === 'tone')]) {
    const e = tonePrefs.get(p.pattern) ?? { eng: 0, fbCount: 0, compCount: 0 };
    if (p.engagementRate) {
      const weight = p.source === 'feedback' ? 1.5 : 1.0; // feedback 权重更高
      e.eng = (e.eng * (p.source === 'feedback' ? e.fbCount : e.compCount) + p.engagementRate * weight) / (e.fbCount + e.compCount + weight);
      if (p.source === 'feedback') e.fbCount += 1;
      else e.compCount += 1;
    }
    tonePrefs.set(p.pattern, e);
  }

  let topTone = { name: '', eng: 0, count: 0 };
  for (const [name, data] of tonePrefs) {
    const count = data.fbCount + data.compCount;
    if (data.eng > topTone.eng) {
      topTone = { name, eng: data.eng, count };
    }
  }

  // 从 revision 提取 title/hook 有效模式
  const titlePatterns = revisionRecords
    .filter(r => r.type === 'title' && r.count >= 1)
    .map(r => ({ pattern: r.pattern, adoptionRate: r.adoptionRate ?? 0, count: r.count }))
    .sort((a, b) => b.count - a.count);

  const hookPatterns = revisionRecords
    .filter(r => r.type === 'hook' && r.count >= 1)
    .map(r => ({ pattern: r.pattern, adoptionRate: r.adoptionRate ?? 0, count: r.count }))
    .sort((a, b) => b.count - a.count);

  return {
    structure: {
      preference: topStructure.name || '对比型',
      weight: topStructure.eng > 0 ? 1 + topStructure.eng : 1.0,
      engagementRate: topStructure.eng,
      sampleSize: topStructure.count,
      confidence: computeConfidence(topStructure.count),
    },
    tone: {
      preference: topTone.name || '励志',
      weight: topTone.eng > 0 ? 1 + topTone.eng : 1.0,
      engagementRate: topTone.eng,
      sampleSize: topTone.count,
      confidence: computeConfidence(topTone.count),
    },
    angle: {
      preference: '',
      weight: 1.0,
      engagementRate: 0,
      sampleSize: 0,
      confidence: 'low',
    },
    title: {
      effectivePatterns: titlePatterns.slice(0, 5),
      confidence: computeConfidence(titlePatterns.reduce((s, p) => s + p.count, 0)),
    },
    hook: {
      effectivePatterns: hookPatterns.slice(0, 5),
      confidence: computeConfidence(hookPatterns.reduce((s, p) => s + p.count, 0)),
    },
  };
}

/**
 * 分析所有数据源，生成创作偏好
 */
export function analyzePatterns(
  revisionManifests: RevisionManifest[],
  feedbackRecords: FeedbackRecord[],
  competitorRecords: FeishuRecord[],
  _options?: AnalyzeOptions,
): CreativePreferences {
  const revisionPatterns = extractRevisionPatterns(revisionManifests);
  const feedbackPatterns = extractFeedbackPatterns(feedbackRecords);
  const competitorPatterns = extractCompetitorPatterns(competitorRecords);

  // 暂时所有平台用相同的偏好（分开学需要更细粒度的数据）
  const prefs = buildPlatformPreferences(revisionPatterns, feedbackPatterns, competitorPatterns);

  return {
    wechat: prefs,
    xiaohongshu: prefs,
    douyin: prefs,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

// Creative preferences — load/update/query creative preferences from Feishu

import chalk from 'chalk';
import type { CreativePreferences, PlatformPreferences } from './types.js';
import type { Platform } from './types.js';
import { readCreativePreferences, writeCreativePreferences } from '../feedback/feishu-feedback.js';

// TODO: Replace with actual Feishu table for creative preferences
// For now, use a local cache in memory
let cachedPreferences: CreativePreferences | null = null;

export const DEFAULT_PREFERENCES: CreativePreferences = {
  wechat: {
    structure: { preference: '对比型', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    tone: { preference: '励志', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    title: { effectivePatterns: [], confidence: 'low' },
    hook: { effectivePatterns: [], confidence: 'low' },
  },
  xiaohongshu: {
    structure: { preference: '故事型', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    tone: { preference: '温暖', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    title: { effectivePatterns: [], confidence: 'low' },
    hook: { effectivePatterns: [], confidence: 'low' },
  },
  douyin: {
    structure: { preference: '清单型', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    tone: { preference: '犀利', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    angle: { preference: '', weight: 1.0, engagementRate: 0, sampleSize: 0, confidence: 'low' },
    title: { effectivePatterns: [], confidence: 'low' },
    hook: { effectivePatterns: [], confidence: 'low' },
  },
  lastUpdated: '',
};

/**
 * Load creative preferences from Feishu (future) or cache (current)
 */
export function loadCreativePreferences(): CreativePreferences {
  if (!cachedPreferences) {
    cachedPreferences = { ...DEFAULT_PREFERENCES, lastUpdated: '' };
  }
  return cachedPreferences;
}

/**
 * Load creative preferences from Feishu sheet.
 * Populates the in-memory cache and falls back to DEFAULT_PREFERENCES if empty/error.
 */
export async function loadCreativePreferencesFromFeishu(): Promise<CreativePreferences> {
  try {
    const records = await readCreativePreferences();

    if (records.length === 0) {
      cachedPreferences = { ...DEFAULT_PREFERENCES, lastUpdated: '' };
      return cachedPreferences;
    }

    const prefsFromFeishu: CreativePreferences = {
      wechat: DEFAULT_PREFERENCES.wechat,
      xiaohongshu: DEFAULT_PREFERENCES.xiaohongshu,
      douyin: DEFAULT_PREFERENCES.douyin,
      lastUpdated: '',
    };

    for (const record of records) {
      const platform = record.fields.platform;
      const jsonStr = record.fields.preferences_json;
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        if (platform === 'wechat' || platform === 'xiaohongshu' || platform === 'douyin') {
          prefsFromFeishu[platform] = parsed;
          if (record.fields.last_updated) {
            prefsFromFeishu.lastUpdated = record.fields.last_updated;
          }
        }
      } catch {
        // If parsing fails, keep default for this platform
      }
    }

    cachedPreferences = prefsFromFeishu;
    return cachedPreferences;
  } catch (error) {
    console.warn(`[creative-preferences] Failed to load from Feishu, using defaults: ${error}`);
    cachedPreferences = { ...DEFAULT_PREFERENCES, lastUpdated: '' };
    return cachedPreferences;
  }
}

/**
 * Get preferences for a specific platform
 */
export function getPlatformPreferences(platform: Platform): PlatformPreferences {
  const prefs = loadCreativePreferences();
  return prefs[platform];
}

/**
 * Check if preferences have enough data to apply
 */
export function hasEnoughData(platform: Platform): boolean {
  const prefs = getPlatformPreferences(platform);
  const { structure, tone } = prefs;
  return (structure.sampleSize + tone.sampleSize) >= 5;
}

/**
 * Apply structure preference weight to a score
 */
export function applyStructureWeight(
  baseScore: number,
  structureType: string,
  platform: Platform,
): number {
  const prefs = getPlatformPreferences(platform);
  if (structureType === prefs.structure.preference) {
    return baseScore * prefs.structure.weight;
  }
  return baseScore;
}

/**
 * Apply tone preference weight
 */
export function applyToneWeight(
  baseScore: number,
  toneType: string,
  platform: Platform,
): number {
  const prefs = getPlatformPreferences(platform);
  if (toneType === prefs.tone.preference) {
    return baseScore * prefs.tone.weight;
  }
  return baseScore;
}

/**
 * Get title patterns for the platform
 */
export function getEffectiveTitlePatterns(platform: Platform): string[] {
  const prefs = getPlatformPreferences(platform);
  return prefs.title.effectivePatterns.map(p => p.pattern);
}

/**
 * Get hook patterns for the platform
 */
export function getEffectiveHookPatterns(platform: Platform): string[] {
  const prefs = getPlatformPreferences(platform);
  return prefs.hook.effectivePatterns.map(p => p.pattern);
}

/**
 * Update creative preferences (in memory cache + Feishu write)
 */
export async function updateCreativePreferences(prefs: CreativePreferences): Promise<void> {
  cachedPreferences = {
    ...prefs,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  try {
    await writeCreativePreferences(prefs.wechat, prefs.xiaohongshu, prefs.douyin);
    console.log(`[creative-preferences] Updated preferences and wrote to Feishu, lastUpdated: ${cachedPreferences.lastUpdated}`);
  } catch (error) {
    console.warn(`[creative-preferences] Failed to write to Feishu, updated cache only: ${error}`);
  }
}

/**
 * Build prompt injection for creative preferences
 * Returns a string to be injected into prompts
 */
export function buildPreferencePrompt(platform: Platform): string {
  const prefs = getPlatformPreferences(platform);

  if (prefs.structure.confidence === 'low' && prefs.tone.confidence === 'low') {
    return '';
  }

  const parts: string[] = [];

  if (prefs.structure.confidence !== 'low') {
    parts.push(`叙事结构偏好（样本${prefs.structure.sampleSize}条，置信度${prefs.structure.confidence}）：推荐使用「${prefs.structure.preference}」结构`);
  }

  if (prefs.tone.confidence !== 'low') {
    parts.push(`情感调性偏好（样本${prefs.tone.sampleSize}条，置信度${prefs.tone.confidence}）：推荐使用「${prefs.tone.preference}」调性`);
  }

  if (prefs.competitorInsights) {
    const ci = prefs.competitorInsights;
    if (ci.structure.sampleSize > 0) {
      parts.push(`竞品高表现洞察：叙事结构「${ci.structure.preference}」平均互动率 ${(ci.structure.avgEngagement * 100).toFixed(1)}%（样本${ci.structure.sampleSize}条）`);
    }
    if (ci.tone.sampleSize > 0) {
      parts.push(`竞品高表现洞察：情感调性「${ci.tone.preference}」平均互动率 ${(ci.tone.avgEngagement * 100).toFixed(1)}%（样本${ci.tone.sampleSize}条）`);
    }
  }

  if (parts.length > 0) {
    return `\n\n【创作偏好参考】\n${parts.join('\n')}\n（仅供参考，不强制约束）`;
  }

  return '';
}

/**
 * Format preferences as a readable report or raw JSON
 */
export function formatPreferencesReport(prefs: CreativePreferences, json?: boolean): string {
  if (json) return JSON.stringify(prefs, null, 2);

  const lines: string[] = [];
  lines.push(chalk.bold('\n📊 创作偏好报告\n'));

  for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
    const p = prefs[platform];
    lines.push(chalk.bold(`\n【${platform}】`));

    // Structure
    const structIcon = p.structure.confidence === 'high' ? '✓' : p.structure.confidence === 'medium' ? '⚠️' : '✗';
    lines.push(`  ${structIcon} 叙事结构: ${p.structure.preference} (样本${p.structure.sampleSize}, 置信度 ${p.structure.confidence})`);

    // Tone
    const toneIcon = p.tone.confidence === 'high' ? '✓' : p.tone.confidence === 'medium' ? '⚠️' : '✗';
    lines.push(`  ${toneIcon} 情感调性: ${p.tone.preference} (样本${p.tone.sampleSize}, 置信度 ${p.tone.confidence})`);

    // Angle
    const angleIcon = p.angle.confidence === 'high' ? '✓' : p.angle.confidence === 'medium' ? '⚠️' : '✗';
    lines.push(`  ${angleIcon} 内容角度: ${p.angle.preference || '(未设置)'} (样本${p.angle.sampleSize}, 置信度 ${p.angle.confidence})`);

    // Competitor insights
    if (p.competitorInsights) {
      lines.push(chalk.gray(`  竞品结构偏好: ${p.competitorInsights.structure.preference} (${(p.competitorInsights.structure.avgEngagement * 100).toFixed(1)}%, n=${p.competitorInsights.structure.sampleSize})`));
      lines.push(chalk.gray(`  竞品调性偏好: ${p.competitorInsights.tone.preference} (${(p.competitorInsights.tone.avgEngagement * 100).toFixed(1)}%, n=${p.competitorInsights.tone.sampleSize})`));
    }

    // Effective patterns
    if (p.title.effectivePatterns.length > 0) {
      lines.push(chalk.gray(`  有效标题模式: ${p.title.effectivePatterns.map(x => x.pattern).join(', ')}`));
    }
    if (p.hook.effectivePatterns.length > 0) {
      lines.push(chalk.gray(`  有效钩子模式: ${p.hook.effectivePatterns.map(x => x.pattern).join(', ')}`));
    }
  }

  lines.push(chalk.green(`\n最后更新: ${prefs.lastUpdated || '从未'}\n`));
  return lines.join('\n');
}

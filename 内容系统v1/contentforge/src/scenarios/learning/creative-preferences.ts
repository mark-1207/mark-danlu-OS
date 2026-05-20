// Creative preferences — load/update/query creative preferences from Feishu

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

  if (parts.length > 0) {
    return `\n\n【创作偏好参考】\n${parts.join('\n')}\n（仅供参考，不强制约束）`;
  }

  return '';
}

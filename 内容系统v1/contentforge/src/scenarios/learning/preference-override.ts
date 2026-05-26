import fs from 'fs/promises';
import path from 'path';
import type { CreativePreferences } from './types.js';

const OVERRIDE_PATH = path.join(process.cwd(), 'output', 'corpus', 'preference-overrides.json');

export type OverrideDimension = 'structure' | 'tone' | 'angle';

export interface PlatformOverride {
  structure?: string | null;
  tone?: string | null;
  angle?: string | null;
}

export type PlatformOverrides = Record<'wechat' | 'xiaohongshu' | 'douyin', PlatformOverride>;

export function defaultOverrides(): PlatformOverrides {
  return {
    wechat: {},
    xiaohongshu: {},
    douyin: {},
  };
}

export async function loadOverrides(): Promise<PlatformOverrides> {
  try {
    const content = await fs.readFile(OVERRIDE_PATH, 'utf-8');
    return { ...defaultOverrides(), ...JSON.parse(content) };
  } catch {
    return defaultOverrides();
  }
}

export async function saveOverrides(overrides: PlatformOverrides): Promise<void> {
  await fs.mkdir(path.dirname(OVERRIDE_PATH), { recursive: true });
  await fs.writeFile(OVERRIDE_PATH, JSON.stringify(overrides, null, 2), 'utf-8');
}

export async function clearOverrides(): Promise<void> {
  await saveOverrides(defaultOverrides());
}

export function setOverride(
  overrides: PlatformOverrides,
  platform: 'wechat' | 'xiaohongshu' | 'douyin',
  dimension: OverrideDimension,
  value: string | null,
): PlatformOverrides {
  return {
    ...overrides,
    [platform]: {
      ...overrides[platform],
      [dimension]: value,
    },
  };
}

export function applyOverrides(prefs: CreativePreferences, overrides: PlatformOverrides): CreativePreferences {
  const result: CreativePreferences = {
    wechat: { ...prefs.wechat },
    xiaohongshu: { ...prefs.xiaohongshu },
    douyin: { ...prefs.douyin },
    lastUpdated: prefs.lastUpdated,
  };

  for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
    const over = overrides[platform];
    const p = result[platform];
    if (over.structure) p.structure = { ...p.structure, preference: over.structure };
    if (over.tone) p.tone = { ...p.tone, preference: over.tone };
    if (over.angle) p.angle = { ...p.angle, preference: over.angle };
  }

  return result;
}

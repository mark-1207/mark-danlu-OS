import type { StyleProfile, BlendConfig } from './types.js';
import { StyleProfileStore } from './profile-store.js';

export interface BlendResult {
  profile: StyleProfile;
  preview: string;
}

export async function blendStyles(
  stylesDir: string,
  config: BlendConfig,
): Promise<BlendResult> {
  const store = new StyleProfileStore(stylesDir);

  const sources: StyleProfile[] = [];
  for (const src of config.sources) {
    // Search all types to find the profile
    let profile = await store.load(src.profileName, 'personal');
    if (!profile) profile = await store.load(src.profileName, 'external');
    if (!profile) profile = await store.load(src.profileName, 'blend');
    if (!profile) throw new Error(`Profile not found: ${src.profileName}`);
    sources.push(profile);
  }

  const blendedDimensions = blendDimensions(sources, config.sources.map(s => s.ratio));
  const preview = generateBlendPreview(config, sources);

  const profile: StyleProfile = {
    name: config.resultName,
    type: 'blend',
    dimensions: blendedDimensions,
    sourceArticles: sources.flatMap(s => s.sourceArticles),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articleTags: {},
    blendSources: config.sources.map((src, i) => ({
      profileName: src.profileName,
      profileType: sources[i].type,
      ratio: src.ratio,
      snapshot: sources[i],
    })),
    version: '1',
  };

  await store.save(profile);

  return { profile, preview };
}

function blendDimensions(sources: StyleProfile[], ratios: number[]): StyleProfile['dimensions'] {
  // Weighted blend: high-ratio source wins (simplified approach)
  const topIdx = ratios.indexOf(Math.max(...ratios));
  const top = sources[topIdx];

  return {
    vocabularyWeights: {
      高频词: top.dimensions.vocabularyWeights.高频词,
      避免词: [...new Set(sources.flatMap(s => s.dimensions.vocabularyWeights.避免词))],
    },
    emotionalTone: top.dimensions.emotionalTone,
    structuralPreference: top.dimensions.structuralPreference,
    narrativeStyle: top.dimensions.narrativeStyle,
  };
}

function generateBlendPreview(config: BlendConfig, sources: StyleProfile[]): string {
  const parts = config.sources.map((src, i) => {
    const pct = Math.round(src.ratio * 100);
    return `${sources[i].name} ${pct}%`;
  });
  return `融合风格：${parts.join(' + ')}`;
}

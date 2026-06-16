import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { StyleProfileStore } from '../../../src/scenarios/style/profile-store.js';
import type { StyleProfile } from '../../../src/scenarios/style/types.js';

const testDir = path.join(process.cwd(), 'data', 'test-styles');

function makeTestProfile(name: string, type: StyleProfile['type']): StyleProfile {
  return {
    name,
    type,
    dimensions: {
      vocabularyWeights: { 高频词: ['test'], 避免词: [] },
      emotionalTone: '前压后起',
      structuralPreference: { hook: '反问', transition: '递进', closing: '留悬念' },
      narrativeStyle: { caseType: '职场', logicVsEmotion: '感性60%', dataUsage: '偶尔' },
    },
    sourceArticles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articleTags: {},
  };
}

describe('StyleProfileStore', () => {
  let store: StyleProfileStore;

  beforeEach(async () => {
    store = new StyleProfileStore(testDir);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('saves and loads a profile', async () => {
    const profile = makeTestProfile('mark', 'personal');
    await store.save(profile);
    const loaded = await store.load('mark', 'personal');
    expect(loaded?.name).toBe('mark');
    expect(loaded?.dimensions.emotionalTone).toBe('前压后起');
  });

  it('list returns all profiles', async () => {
    await store.save(makeTestProfile('a', 'personal'));
    await store.save(makeTestProfile('b', 'external'));
    const all = await store.list();
    expect(all).toHaveLength(2);
  });

  it('delete removes profile', async () => {
    await store.save(makeTestProfile('mark', 'personal'));
    const deleted = await store.delete('mark', 'personal');
    expect(deleted).toBe(true);
    expect(await store.load('mark', 'personal')).toBeNull();
  });
});
import path from 'path';
import fs from 'fs/promises';
import {
  type SentenceFragment,
  type ParagraphFragment,
  type FragmentLibrary,
  type StyleProfile,
  type StyleProfileDelta,
  type FragmentManifest,
  type FragmentManifestEntry,
  FragmentLibrarySchema,
  FragmentManifestSchema,
} from './types.js';

const LIBRARY_FILE = 'fragment-library.json';
const MANIFEST_FILE = 'fragment-manifest.json';

function genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Default empty library state
const emptyLibrary = (): FragmentLibrary => ({
  version: '1.0',
  sentences: {},
  paragraphs: {},
  styleProfile: {
    updatedAt: '',
    totalEdited: 0,
    totalExternal: 0,
    vocabularyWeights: {},
    emotionalTone: 'balanced',
    structuralPreference: '',
    platformPrefs: {},
    patternCounts: {
      hooks: 0,
      transitions: 0,
      ctas: 0,
      powerLines: 0,
      openings: 0,
      arguments: 0,
      closings: 0,
    },
  },
});

export class FragmentStore {
  private library: FragmentLibrary;
  private manifest: FragmentManifest = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private corpusDir: string) {
    this.library = emptyLibrary();
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._load();
    return this.loadPromise;
  }

  private async _load(): Promise<void> {
    const libPath = path.join(this.corpusDir, LIBRARY_FILE);
    const manifestPath = path.join(this.corpusDir, MANIFEST_FILE);

    try {
      const content = await fs.readFile(libPath, 'utf-8');
      this.library = FragmentLibrarySchema.parse(JSON.parse(content));
    } catch {
      this.library = emptyLibrary();
    }

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      this.manifest = FragmentManifestSchema.parse(JSON.parse(manifestContent));
    } catch {
      this.manifest = [];
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    if (this.loadPromise) await this.loadPromise;
    await fs.mkdir(this.corpusDir, { recursive: true });
    await fs.writeFile(path.join(this.corpusDir, LIBRARY_FILE), JSON.stringify(this.library, null, 2), 'utf-8');
    await fs.writeFile(path.join(this.corpusDir, MANIFEST_FILE), JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  // ─── ID generation ─────────────────────────────────────────────────

  newSentenceId(): string {
    return genId();
  }

  newParagraphId(): string {
    return genId();
  }

  // ─── Sentence fragments ─────────────────────────────────────────────

  getSentences(type?: SentenceFragment['type']): SentenceFragment[] {
    if (!type) return this.getAllSentences();
    return this.library.sentences[type] ?? [];
  }

  getAllSentences(includeExpired = false): SentenceFragment[] {
    const all = Object.values(this.library.sentences).flat();
    if (includeExpired) return all;
    return all.filter(f => f.decayLevel !== 'expired');
  }

  getSentenceById(id: string): SentenceFragment | undefined {
    for (const fragments of Object.values(this.library.sentences)) {
      const found = fragments.find(f => f.id === id);
      if (found) return found;
    }
    return undefined;
  }

  addSentence(fragment: SentenceFragment): void {
    const bucket = fragment.type;
    if (!this.library.sentences[bucket]) {
      this.library.sentences[bucket] = [];
    }
    this.library.sentences[bucket].push(fragment);
  }

  deleteSentence(id: string): boolean {
    for (const [bucket, fragments] of Object.entries(this.library.sentences)) {
      const idx = fragments.findIndex(f => f.id === id);
      if (idx !== -1) {
        fragments.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  clearSentencesByType(type: SentenceFragment['type']): void {
    this.library.sentences[type] = [];
  }

  // ─── Paragraph fragments ─────────────────────────────────────────

  getParagraphs(type?: ParagraphFragment['type']): ParagraphFragment[] {
    if (!type) return this.getAllParagraphs();
    return this.library.paragraphs[type] ?? [];
  }

  getAllParagraphs(includeExpired = false): ParagraphFragment[] {
    const all = Object.values(this.library.paragraphs).flat();
    if (includeExpired) return all;
    return all.filter(f => f.decayLevel !== 'expired');
  }

  getParagraphById(id: string): ParagraphFragment | undefined {
    for (const fragments of Object.values(this.library.paragraphs)) {
      const found = fragments.find(f => f.id === id);
      if (found) return found;
    }
    return undefined;
  }

  addParagraph(fragment: ParagraphFragment): void {
    const bucket = fragment.type;
    if (!this.library.paragraphs[bucket]) {
      this.library.paragraphs[bucket] = [];
    }
    this.library.paragraphs[bucket].push(fragment);
  }

  deleteParagraph(id: string): boolean {
    for (const [bucket, fragments] of Object.entries(this.library.paragraphs)) {
      const idx = fragments.findIndex(f => f.id === id);
      if (idx !== -1) {
        fragments.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  clearParagraphsByType(type: ParagraphFragment['type']): void {
    this.library.paragraphs[type] = [];
  }

  // ─── Delete by ID (any type) ─────────────────────────────────────

  deleteById(id: string): 'sentence' | 'paragraph' | null {
    if (this.deleteSentence(id)) return 'sentence';
    if (this.deleteParagraph(id)) return 'paragraph';
    // Also remove from manifest
    for (const entry of this.manifest) {
      const idx = entry.fragmentIds.indexOf(id);
      if (idx !== -1) {
        entry.fragmentIds.splice(idx, 1);
        break;
      }
    }
    return null;
  }

  // ─── Manifest ─────────────────────────────────────────────────────

  addManifestEntry(entry: FragmentManifestEntry): void {
    this.manifest.push(entry);
  }

  getManifest(): FragmentManifest {
    return this.manifest;
  }

  getManifestEntryByFragmentId(id: string): FragmentManifestEntry | undefined {
    return this.manifest.find(e => e.fragmentIds.includes(id));
  }

  // ─── Style profile ─────────────────────────────────────────────

  getStyleProfile(): StyleProfile {
    return this.library.styleProfile;
  }

  updateStyleProfile(delta: StyleProfileDelta): void {
    const current = this.library.styleProfile;
    this.library.styleProfile = {
      ...current,
      updatedAt: new Date().toISOString(),
      totalEdited: (delta.totalEdited ?? current.totalEdited) + 1,
      vocabularyWeights: { ...current.vocabularyWeights, ...(delta.vocabularyWeights ?? {}) },
      emotionalTone: delta.emotionalTone ?? current.emotionalTone,
      structuralPreference: delta.structuralPreference ?? current.structuralPreference,
      platformPrefs: { ...current.platformPrefs, ...(delta.platformPrefs ?? {}) },
    };
  }

  // ─── Decay tracking ─────────────────────────────────────────────

  /**
   * Mark a fragment as used (called when fragment is selected for injection).
   * Updates useCount and lastUsedAt; resets decayLevel to 'active'.
   */
  markFragmentUsed(id: string): boolean {
    const sentence = this.getSentenceById(id);
    if (sentence) {
      sentence.useCount = (sentence.useCount ?? 0) + 1;
      sentence.lastUsedAt = new Date().toISOString();
      sentence.decayLevel = 'active';
      return true;
    }
    const paragraph = this.getParagraphById(id);
    if (paragraph) {
      paragraph.useCount = (paragraph.useCount ?? 0) + 1;
      paragraph.lastUsedAt = new Date().toISOString();
      paragraph.decayLevel = 'active';
      return true;
    }
    return false;
  }

  /**
   * Apply decay rules to all fragments.
   * - dormant: lastUsedAt > 60 days ago OR useCount=0 and lastUsedAt > 30 days
   * - expired: lastUsedAt > 180 days ago
   * Returns counts of updated fragments.
   */
  decayFragments(): { dormant: number; expired: number } {
    const now = Date.now();
    const DORMANT_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000;
    const EXPIRED_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000;
    const DORMANT_NO_USE_MS = 30 * 24 * 60 * 60 * 1000;

    let dormant = 0;
    let expired = 0;

    const allSentences = Object.values(this.library.sentences).flat();
    for (const f of allSentences) {
      const lastUsed = f.lastUsedAt ? new Date(f.lastUsedAt).getTime() : 0;
      const age = now - lastUsed;
      if (f.decayLevel === 'expired') continue; // already expired, skip

      if (age > EXPIRED_THRESHOLD_MS) {
        f.decayLevel = 'expired';
        expired++;
      } else if (age > DORMANT_THRESHOLD_MS) {
        f.decayLevel = 'dormant';
        dormant++;
      } else if (lastUsed > 0 && f.useCount === 0 && age > DORMANT_NO_USE_MS) {
        f.decayLevel = 'dormant';
        dormant++;
      }
    }

    const allParagraphs = Object.values(this.library.paragraphs).flat();
    for (const f of allParagraphs) {
      const lastUsed = f.lastUsedAt ? new Date(f.lastUsedAt).getTime() : 0;
      const age = now - lastUsed;
      if (f.decayLevel === 'expired') continue;

      if (age > EXPIRED_THRESHOLD_MS) {
        f.decayLevel = 'expired';
        expired++;
      } else if (age > DORMANT_THRESHOLD_MS) {
        f.decayLevel = 'dormant';
        dormant++;
      } else if (lastUsed > 0 && f.useCount === 0 && age > DORMANT_NO_USE_MS) {
        f.decayLevel = 'dormant';
        dormant++;
      }
    }

    return { dormant, expired };
  }

  /**
   * Get decay statistics.
   */
  getDecayStats(): {
    total: number;
    active: number;
    dormant: number;
    expired: number;
  } {
    const sentences = Object.values(this.library.sentences).flat();
    const paragraphs = Object.values(this.library.paragraphs).flat();
    const all = [...sentences, ...paragraphs];
    return {
      total: all.length,
      active: all.filter(f => f.decayLevel === 'active').length,
      dormant: all.filter(f => f.decayLevel === 'dormant').length,
      expired: all.filter(f => f.decayLevel === 'expired').length,
    };
  }

  // ─── Stats ─────────────────────────────────────────────────────

  getStats(): {
    totalSentenceFragments: number;
    totalParagraphFragments: number;
    bySource: { edited: number; external: number };
    byType: Record<string, number>;
    manifestEntries: number;
    byDecay: { active: number; dormant: number; expired: number };
  } {
    const sentences = this.getAllSentences();
    const paragraphs = this.getAllParagraphs();
    const bySource = { edited: 0, external: 0 };
    const byType: Record<string, number> = {};

    for (const f of sentences) {
      bySource[f.source]++;
      byType[`sentence.${f.type}`] = (byType[`sentence.${f.type}`] ?? 0) + 1;
    }
    for (const f of paragraphs) {
      bySource[f.source]++;
      byType[`paragraph.${f.type}`] = (byType[`paragraph.${f.type}`] ?? 0) + 1;
    }

    const decayStats = this.getDecayStats();

    return {
      totalSentenceFragments: sentences.length,
      totalParagraphFragments: paragraphs.length,
      bySource,
      byType,
      manifestEntries: this.manifest.length,
      byDecay: { active: decayStats.active, dormant: decayStats.dormant, expired: decayStats.expired },
    };
  }
}

// Singleton per corpus directory
const stores = new Map<string, FragmentStore>();

export function getFragmentStore(corpusDir: string): FragmentStore {
  const resolved = path.resolve(corpusDir);
  if (!stores.has(resolved)) {
    stores.set(resolved, new FragmentStore(resolved));
  }
  return stores.get(resolved)!;
}

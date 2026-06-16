import { z } from 'zod';

// ─── Sentence-level fragments ─────────────────────────────────────

export const SentenceFragmentSchema = z.object({
  id: z.string(),
  type: z.enum(['hook', 'transition', 'cta', 'power-line', 'rhetorical-question', 'data-opener']),
  text: z.string(),
  structure: z.string(),        // e.g. "反问句 + 数据对比"
  source: z.enum(['edited', 'external']),
  sourceFile: z.string().optional(),
  platform: z.enum(['wechat', 'xiaohongshu', 'douyin', 'universal']).default('universal'),
  tags: z.array(z.string()).default([]),
  relevanceScore: z.number().optional(), // keyword overlap score when injected, set at runtime
  embedding: z.array(z.number()).optional(), // future: vector search
  // Decay tracking
  lastUsedAt: z.string().optional(), // ISO timestamp of last injection that used this fragment
  useCount: z.number().default(0),   // how many times this fragment was selected for injection
  decayLevel: z.enum(['active', 'dormant', 'expired']).default('active'),
});

export type SentenceFragment = z.infer<typeof SentenceFragmentSchema>;

// ─── Paragraph-level fragments ────────────────────────────────────

export const ParagraphFragmentSchema = z.object({
  id: z.string(),
  type: z.enum(['opening', 'argument', 'emotional-peak', 'closing', 'case-study']),
  content: z.string(),
  narrativeStructure: z.string(), // e.g. "问题共鸣→原因层层剥笋→方案给出"
  emotionalArc: z.string(),       // e.g. "平静→好奇→紧张→释放"
  source: z.enum(['edited', 'external']),
  sourceFile: z.string().optional(),
  platform: z.enum(['wechat', 'xiaohongshu', 'douyin', 'universal']).default('universal'),
  tags: z.array(z.string()).default([]),
  relevanceScore: z.number().optional(), // keyword overlap score when injected, set at runtime
  // Decay tracking
  lastUsedAt: z.string().optional(),
  useCount: z.number().default(0),
  decayLevel: z.enum(['active', 'dormant', 'expired']).default('active'),
});

export type ParagraphFragment = z.infer<typeof ParagraphFragmentSchema>;

// ─── Style profile ─────────────────────────────────────────────

const _StyleProfileBase = z.object({
  updatedAt: z.string(),
  totalEdited: z.number(),
  totalExternal: z.number(),
  vocabularyWeights: z.record(z.number()),
  emotionalTone: z.string(),
  structuralPreference: z.string(),
  platformPrefs: z.record(z.string()),
  patternCounts: z.object({
    hooks: z.number(),
    transitions: z.number(),
    ctas: z.number(),
    powerLines: z.number(),
    openings: z.number(),
    arguments: z.number(),
    closings: z.number(),
  }),
});

const StyleProfileDefaults = {
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
};

export const StyleProfileSchema = _StyleProfileBase.default(StyleProfileDefaults);

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

// ─── Fragment library ───────────────────────────────────────────

export const FragmentLibrarySchema = z.object({
  version: z.string().default('1.0'),
  sentences: z.record(z.string(), z.array(SentenceFragmentSchema)).default({}),
  paragraphs: z.record(z.string(), z.array(ParagraphFragmentSchema)).default({}),
  styleProfile: StyleProfileSchema,
}).default({ version: '1.0', sentences: {}, paragraphs: {}, styleProfile: StyleProfileDefaults });

export type FragmentLibrary = z.infer<typeof FragmentLibrarySchema>;

// ─── Analysis output ────────────────────────────────────────────

export const StyleProfileDeltaSchema = z.object({
  updatedAt: z.string().optional(),
  totalEdited: z.number().optional(),
  totalExternal: z.number().optional(),
  vocabularyWeights: z.record(z.number()).optional(),
  emotionalTone: z.string().optional(),
  structuralPreference: z.string().optional(),
  platformPrefs: z.record(z.string()).optional(),
  patternCounts: z.object({
    hooks: z.number().optional(),
    transitions: z.number().optional(),
    ctas: z.number().optional(),
    powerLines: z.number().optional(),
    openings: z.number().optional(),
    arguments: z.number().optional(),
    closings: z.number().optional(),
  }).optional(),
});

export type StyleProfileDelta = z.infer<typeof StyleProfileDeltaSchema>;

export const FragmentExtractionResultSchema = z.object({
  sentenceFragments: z.array(SentenceFragmentSchema),
  paragraphFragments: z.array(ParagraphFragmentSchema),
  styleProfileDelta: StyleProfileDeltaSchema,
});

export type FragmentExtractionResult = z.infer<typeof FragmentExtractionResultSchema>;

// ─── Fragment manifest — tracks analysis history ─────────────────────

export const FragmentManifestEntrySchema = z.object({
  /** Stable ID for this analysis run */
  manifestId: z.string(),
  /** When this was analyzed */
  analyzedAt: z.string(),
  /** Source type: 'edited-pair' | 'external' | 'single-original' */
  sourceType: z.enum(['edited-pair', 'external', 'single-original']),
  /** Path to the file(s) analyzed */
  sourcePaths: z.array(z.string()),
  /** runId if available (inferred from source file name for edited/ external) */
  runId: z.string().optional(),
  /** Number of sentence fragments extracted */
  sentenceCount: z.number(),
  /** Number of paragraph fragments extracted */
  paragraphCount: z.number(),
  /** IDs of fragments extracted in this analysis */
  fragmentIds: z.array(z.string()),
});

export type FragmentManifestEntry = z.infer<typeof FragmentManifestEntrySchema>;

export const FragmentManifestSchema = z.array(FragmentManifestEntrySchema);

export type FragmentManifest = z.infer<typeof FragmentManifestSchema>;

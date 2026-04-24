import { z } from 'zod';

export const ArticleTagSchema = z.enum(['representative', 'deviant', 'normal']);
export type ArticleTag = z.infer<typeof ArticleTagSchema>;

export const StyleDimensionsSchema = z.object({
  vocabularyWeights: z.object({
    高频词: z.array(z.string()).default([]),
    避免词: z.array(z.string()).default([]),
  }),
  emotionalTone: z.string(),
  structuralPreference: z.object({
    hook: z.string(),
    transition: z.string(),
    closing: z.string(),
  }),
  narrativeStyle: z.object({
    caseType: z.string(),
    logicVsEmotion: z.string(),
    dataUsage: z.string(),
  }),
});
export type StyleDimensions = z.infer<typeof StyleDimensionsSchema>;

export const StyleProfileSchema = z.object({
  name: z.string(),
  type: z.enum(['personal', 'external', 'blend']),
  dimensions: StyleDimensionsSchema,
  sourceArticles: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  articleTags: z.record(z.string(), ArticleTagSchema).default({}),
  blendSources: z.array(z.object({
    profileName: z.string(),
    profileType: z.enum(['personal', 'external', 'blend']),
    ratio: z.number(),
    snapshot: z.record(z.unknown()).optional(),
  })).optional(),
  version: z.string().optional(),
});
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const BlendConfigSchema = z.object({
  sources: z.array(z.object({
    profileName: z.string(),
    ratio: z.number(),
  })),
  resultName: z.string(),
});
export type BlendConfig = z.infer<typeof BlendConfigSchema>;

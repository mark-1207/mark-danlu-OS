import { z } from 'zod';

export const RevisionElementSchema = z.enum([
  'title', 'hook', 'body', 'cta', 'example', 'power-sentence'
]);
export type RevisionElement = z.infer<typeof RevisionElementSchema>;

export const RevisionSelectionSchema = z.object({
  element: RevisionElementSchema,
  platforms: z.array(z.enum(['wechat', 'xiaohongshu', 'douyin'])).default(['wechat', 'xiaohongshu', 'douyin']),
});
export type RevisionSelection = z.infer<typeof RevisionSelectionSchema>;

// 每次修订的 appliedTrigger 记录
export const AppliedRevisionSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  selections: z.array(RevisionSelectionSchema),
  userInstruction: z.string(),
  appliedTriggers: z.array(z.object({
    element: z.string(),
    action: z.string(),
    originalText: z.string().optional(),
    newText: z.string().optional(),
  })),
});
export type AppliedRevision = z.infer<typeof AppliedRevisionSchema>;

// revisions/manifest.json 结构
export const RevisionManifestSchema = z.object({
  parentRunId: z.string(),
  currentVersion: z.string(),
  versions: z.array(AppliedRevisionSchema),
});
export type RevisionManifest = z.infer<typeof RevisionManifestSchema>;
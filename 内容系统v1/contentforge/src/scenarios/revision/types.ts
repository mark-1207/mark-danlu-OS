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

// 学习元数据：每次修订记录的可学习信息
export const RevisionLearningMetadataSchema = z.object({
  // 用户选择的元素
  element: RevisionElementSchema,
  // 用户输入的修改指令（原始）
  instruction: z.string(),
  // LLM 推断的修改意图（具体改了什么维度）
  instructionDetail: z.string().optional(),
  // 改动范围：word(用词) / tone(语气) / length(长度) / structure(结构)
  changeScope: z.array(z.enum(['word', 'tone', 'length', 'structure'])),
  // 是否被采纳
  adopted: z.boolean(),
  // 涉及的平台
  platform: z.enum(['wechat', 'xiaohongshu', 'douyin']),
  // 来源上下文：二创 / 原创
  context: z.enum(['recreate', 'create']),
  // 修订触发来源：self(自己不满意) / feedback(他人反馈)
  feedbackTrigger: z.enum(['self', 'feedback']).default('self'),
});
export type RevisionLearningMetadata = z.infer<typeof RevisionLearningMetadataSchema>;

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
  // 学习元数据
  learningMetadata: z.array(RevisionLearningMetadataSchema).optional(),
});
export type AppliedRevision = z.infer<typeof AppliedRevisionSchema>;

// revisions/manifest.json 结构
export const RevisionManifestSchema = z.object({
  parentRunId: z.string(),
  currentVersion: z.string(),
  versions: z.array(AppliedRevisionSchema),
});
export type RevisionManifest = z.infer<typeof RevisionManifestSchema>;
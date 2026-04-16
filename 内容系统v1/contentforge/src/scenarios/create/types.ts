import { z } from 'zod';

// ─── Step 1: Topic Analysis ─────────────────────────────────────────

export const SubTopicSchema = z.object({
  name: z.string(),
  description: z.string(),
  heatLevel: z.enum(['high', 'medium', 'low']),
});

export const PainPointSchema = z.object({
  description: z.string(),
  targetAudience: z.string(),
  emotionalTrigger: z.string(),
});

export const TrendingAngleSchema = z.object({
  angle: z.string(),
  whyTrending: z.string(),
  suitablePlatforms: z.array(z.string()),
});

export const ControversySchema = z.object({
  topic: z.string(),
  sideA: z.string(),
  sideB: z.string(),
});

export const TargetDemographicSchema = z.object({
  group: z.string(),
  interests: z.array(z.string()),
  contentPreferences: z.array(z.string()),
});

export const TopicAnalysisSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicSchema).min(10).max(15),
  painPoints: z.array(PainPointSchema).min(5).max(8),
  trendingAngles: z.array(TrendingAngleSchema).min(5).max(8),
  controversies: z.array(ControversySchema).min(3).max(5),
  targetDemographics: z.array(TargetDemographicSchema).min(3).max(5),
});

export type TopicAnalysis = z.infer<typeof TopicAnalysisSchema>;

// ─── Step 2: Topic Assignment ──────────────────────────────────────

export const TopicCardSchema = z.object({
  platform: z.enum(['wechat', 'xiaohongshu', 'douyin']),
  angle: z.string(),
  titleDrafts: z.array(z.string()).length(3),
  coreArgument: z.string(),
  targetAudience: z.string(),
  tone: z.string(),
  wordCountRange: z.tuple([z.number(), z.number()]),
  contentType: z.string(),
  emotionalGoal: z.string(),
});

export const PlatformAssignmentsSchema = z.object({
  wechat: TopicCardSchema,
  xiaohongshu: TopicCardSchema,
  douyin: TopicCardSchema,
  overlapAnalysis: z.string(),
});

export type PlatformAssignments = z.infer<typeof PlatformAssignmentsSchema>;

// ─── Step 3: Outline Generation ────────────────────────────────────

export const WechatOutlineSchema = z.object({
  hook: z.object({
    technique: z.string(),
    content: z.string(),
  }),
  sections: z.array(z.object({
    title: z.string(),
    purpose: z.string(),
    keyPoints: z.array(z.string()),
    caseSlot: z.string(),
    wordCount: z.number(),
    emotionTarget: z.string(),
  })),
  conclusion: z.object({
    type: z.string(),
    direction: z.string(),
  }),
  estimatedTotalWords: z.number(),
});

export const XiaohongshuOutlineSchema = z.object({
  persona: z.object({
    identity: z.string(),
    credibilityHook: z.string(),
  }),
  tips: z.array(z.object({
    title: z.string(),
    content: z.string(),
    actionable: z.string(),
  })),
  closingHook: z.string(),
  hashtags: z.array(z.string()),
  estimatedTotalWords: z.number(),
});

export const DouyinOutlineSchema = z.object({
  hook3s: z.object({
    technique: z.string(),
    script: z.string(),
  }),
  corePoint: z.object({
    statement: z.string(),
    analogy: z.string(),
  }),
  miniCase: z.string(),
  closingPunch: z.string(),
  interactionGuide: z.string(),
  estimatedTotalWords: z.number(),
});

export type WechatOutline = z.infer<typeof WechatOutlineSchema>;
export type XiaohongshuOutline = z.infer<typeof XiaohongshuOutlineSchema>;
export type DouyinOutline = z.infer<typeof DouyinOutlineSchema>;

// ─── Step 4: Material Search ────────────────────────────────────────

export const MaterialSchema = z.object({
  forSection: z.string(),
  type: z.enum(['data', 'case', 'quote', 'story']),
  content: z.string(),
  source: z.string(),
  reliability: z.enum(['high', 'medium', 'low']),
});

export const MaterialCollectionSchema = z.object({
  platform: z.string(),
  materials: z.array(MaterialSchema),
});

export const MaterialSearchOutputSchema = z.object({
  wechat: z.array(MaterialSchema),
  xiaohongshu: z.array(MaterialSchema),
  douyin: z.array(MaterialSchema),
});

export type Material = z.infer<typeof MaterialSchema>;
export type MaterialSearchOutput = z.infer<typeof MaterialSearchOutputSchema>;

// ─── Step 5: Content Generation ─────────────────────────────────────

// Output is raw markdown string — no schema validation needed
export type ContentGenerationOutput = string;

// ─── Step 6: Review & Optimization ─────────────────────────────────

export const QualityScoreSchema = z.object({
  titleAttraction: z.number().min(1).max(10),
  hookRetention: z.number().min(1).max(10),
  contentValue: z.number().min(1).max(10),
  emotionalEngagement: z.number().min(1).max(10),
  interactionDesign: z.number().min(1).max(10),
});

export const ReviewChangeSchema = z.object({
  location: z.string(),
  original: z.string(),
  revised: z.string(),
  reason: z.string(),
});

export const PlatformComplianceSchema = z.object({
  wordCountOk: z.boolean(),
  sensitiveWordsFound: z.array(z.string()),
  formatOk: z.boolean(),
});

export const ReviewResultSchema = z.object({
  revisedContent: z.string(),
  titleOptions: z.array(z.string()).length(5),
  recommendedTitle: z.string(),
  qualityScore: QualityScoreSchema,
  changes: z.array(ReviewChangeSchema),
  platformCompliance: PlatformComplianceSchema,
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// ─── Final Output ──────────────────────────────────────────────────

export interface ArticleOutput {
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  titleOptions: string[];
  recommendedTitle: string;
  content: string;
  wordCount: number;
  qualityScore: {
    title: number;
    hook: number;
    value: number;
    emotion: number;
    interaction: number;
  };
  meta: {
    angle: string;
    audience: string;
    tone: string;
  };
}

export interface CreateFinalOutput {
  keyword: string;
  generatedAt: string;
  articles: ArticleOutput[];
  intermediateArtifacts: {
    topicAnalysis: TopicAnalysis;
    topicAssignments: PlatformAssignments;
    outlines: {
      wechat: WechatOutline;
      xiaohongshu: XiaohongshuOutline;
      douyin: DouyinOutline;
    };
  };
}

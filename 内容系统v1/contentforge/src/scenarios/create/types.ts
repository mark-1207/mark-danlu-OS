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

export const CompetitorInsightSchema = z.object({
  coveredAngles: z.array(z.object({
    angle: z.string(),
    sourceTitle: z.string(),
    platform: z.string(),
  })),
  opportunityAngles: z.array(z.object({
    angle: z.string(),
    whyOpportunity: z.string(),
  })),
  warning: z.string(),
});

export type CompetitorInsight = z.infer<typeof CompetitorInsightSchema>;

export const TopicAnalysisSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicSchema).min(10).max(15),
  painPoints: z.array(PainPointSchema).min(5).max(8),
  trendingAngles: z.array(TrendingAngleSchema).min(5).max(8),
  controversies: z.array(ControversySchema).min(3).max(5),
  targetDemographics: z.array(TargetDemographicSchema).min(3).max(5),
  competitorInsights: CompetitorInsightSchema.optional(),
});

export type TopicAnalysis = z.infer<typeof TopicAnalysisSchema>;

// ─── Step 2: Topic Assignment ──────────────────────────────────────

export const CognitiveTensionSchema = z.object({
  popularBelief: z.string().describe('大众以为'),
  reality: z.string().describe('现实是'),
});

export const TopicCardSchema = z.object({
  platform: z.enum(['wechat', 'xiaohongshu', 'douyin']),
  angle: z.string(),
  titleDrafts: z.array(z.string()).length(3),
  coreArgument: z.string(),
  targetAudience: z.string(),
  tone: z.string(),
  wordCountRange: z.tuple([z.number(), z.number()]),
  emotionalGoal: z.string(),
  // CCOS-inspired: cognitive tension for outline guidance
  cognitiveTension: CognitiveTensionSchema.optional(),
  // CCOS-inspired: recommended structure and progression
  structureType: z.enum(['认知升级型', '问题拆解型', '故事驱动型', '信息重构型']).optional(),
  progressionMode: z.array(z.enum(['冲突推进', '递进推进', '案例推进', '对比推进', '拆解推进', '情绪推进'])).max(2).optional(),
});

export const PlatformAssignmentsSchema = z.object({
  wechat: TopicCardSchema,
  xiaohongshu: TopicCardSchema,
  douyin: TopicCardSchema,
  overlapAnalysis: z.string(),
});

export type PlatformAssignments = z.infer<typeof PlatformAssignmentsSchema>;

// ─── Step 3: Outline Generation ────────────────────────────────────

export const CognitiveModuleSchema = z.enum(['HOOK', 'CASE', 'EXPLAIN', 'MODEL', 'COUNTER', 'EVIDENCE', 'ACTION', 'BOUNDARY']);

export const WechatOutlineSchema = z.object({
  hook: z.object({
    technique: z.string(),
    content: z.string(),
  }),
  // CCOS-inspired: cognitive tension that drives the outline
  cognitiveTension: z.object({
    popularBelief: z.string(),
    reality: z.string(),
  }).optional(),
  emotionalArc: z.object({
    hook: z.string().describe('钩子：极速拉升唤醒度，3秒抓住注意力'),
    context: z.string().describe('铺垫：效价平稳，建立"跟我有关"的预期'),
    twist: z.string().describe('冲突/反转：效价剧烈翻转，唤醒度峰值'),
    resonance: z.string().describe('共鸣：情绪转化为思考，"想通了"的爽感'),
    action: z.string().describe('行动：情绪回落前给出口，问题或动作收尾'),
  }),
  sections: z.array(z.object({
    title: z.string(),
    purpose: z.string(),
    keyPoints: z.array(z.string()),
    caseSlot: z.string(),
    wordCount: z.number(),
    emotionTarget: z.string(),
    arcPosition: z.enum(['hook', 'context', 'twist', 'resonance', 'action']).describe('该段落在情绪曲线中的位置'),
    // CCOS-inspired: cognitive module tag to guide content generation
    cognitiveModule: CognitiveModuleSchema.optional().describe('认知模块类型：HOOK制造停留/CASE建立真实感/EXPLAIN建立理解/MODEL提升认知密度/COUNTER制造记忆点/EVIDENCE增强可信度/ACTION提供落地行动/BOUNDARY提升高级感'),
    knowledgeTransfer: z.object({
      materialName: z.string().describe('引用的知识库素材名称'),
      usage: z.string().describe('如何将该素材融入本段落的写作指令'),
    }).optional().describe('知识迁移计划，如无可不填'),
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
    caseSlot: z.string().optional(),
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
  warmth: z.number().min(1).max(10).describe('温度：被理解，不是被说教'),
  vitality: z.number().min(1).max(10).describe('热度：文字有生命力，有呼吸感'),
  depth: z.number().min(1).max(10).describe('深度：有真东西，不肤浅'),
  richness: z.number().min(1).max(10).describe('厚度：旁征博引，信手拈来'),
  emotionalArc: z.number().min(1).max(10).describe('情绪曲线：每个段落拽着读者往下读'),
  knowledgeTransfer: z.number().min(1).max(10).describe('知识迁移：跨维度"原来如此"的闪电感'),
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
    warmth: number;
    vitality: number;
    depth: number;
    richness: number;
    emotionalArc: number;
    knowledgeTransfer: number;
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

// ─── 选题确认阶段 ────────────────────────────────────────────────

export const SubTopicDecisionSchema = z.object({
  index: z.number(),
  name: z.string(),
  description: z.string(),
  heatLevel: z.enum(['high', 'medium', 'low']),
  decision: z.enum(['pending', 'confirmed', 'rejected']),
});

export const ControversyDecisionSchema = z.object({
  index: z.number(),
  topic: z.string(),
  sideA: z.string(),
  sideB: z.string(),
  decision: z.enum(['pending', 'confirmed', 'rejected']),
});

export const TopicAnalysisReviewSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicDecisionSchema),
  painPoints: z.array(z.object({
    index: z.number(),
    description: z.string(),
    targetAudience: z.string(),
    emotionalTrigger: z.string(),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
  trendingAngles: z.array(z.object({
    index: z.number(),
    angle: z.string(),
    whyTrending: z.string(),
    suitablePlatforms: z.array(z.string()),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
  controversies: z.array(ControversyDecisionSchema),
  targetDemographics: z.array(z.object({
    index: z.number(),
    group: z.string(),
    interests: z.array(z.string()),
    contentPreferences: z.array(z.string()),
    decision: z.enum(['pending', 'confirmed', 'rejected']),
  })),
});

export type TopicAnalysisReview = z.infer<typeof TopicAnalysisReviewSchema>;

export interface TopicAnalysisConfirmed {
  topicAnalysis: TopicAnalysis;
  excludeDirections: string[];
  extraDirections?: string[];
}

export interface PlatformSelectionConfirmed {
  titleIndex: number;
  title: string;
  angleOverride?: string;
}

export interface TopicAssignmentConfirmed {
  topicAssignment: PlatformAssignments;
  selections: {
    wechat: PlatformSelectionConfirmed;
    xiaohongshu: PlatformSelectionConfirmed;
    douyin: PlatformSelectionConfirmed;
  };
}

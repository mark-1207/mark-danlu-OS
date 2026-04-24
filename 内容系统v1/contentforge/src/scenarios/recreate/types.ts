import { z } from 'zod';

// ─── Step 1: Viral Deconstruction ──────────────────────────────────

export const ViralGenomeSchema: z.ZodType<ViralGenome> = z.object({
  topicStrategy: z.object({
    painPoint: z.string(),
    emotionalTrigger: z.string(),
    targetAudience: z.string(),
    whyItWorks: z.string(),
  }),
  narrativeStructure: z.array(z.object({
    sectionIndex: z.number(),
    purpose: z.string(),
    wordRatio: z.number(),
    emotionMark: z.string(),
    technique: z.string(),
    // P0-2: 每段的论证方式（如"引用权威→对比→结论"、"问题共鸣→原因分析→方案"）
    argumentativePath: z.string(),
  })),
  hookTechnique: z.object({
    type: z.string(),
    mechanism: z.string(),
    template: z.string(),
  }),
  emotionCurve: z.array(z.object({
    position: z.number(),
    emotion: z.string(),
    intensity: z.number(),
  })),
  powerSentences: z.array(z.object({
    original: z.string(),
    structure: z.string(),
    whyPowerful: z.string(),
  })),
  viralFactors: z.array(z.string()),
  contentDensityScore: z.number(),
  estimatedReadTime: z.string(),
  // P0-1: 原文高光表达，禁止在二创中使用
  forbiddenExpressions: z.array(z.object({
    text: z.string(),
    reason: z.string(),
  })),
  // P0-3: 原文金句，二创必须避免直接使用
  goldQuotes: z.array(z.object({
    id: z.string(),
    text: z.string(),
    embedding: z.array(z.number()).optional(), // 预计算，不强制
    position: z.string(),
  })).default([]),
  // P0-2: 原文案例（人物/场景/故事），二创必须全部替换
  caseStudies: z.array(z.object({
    id: z.string(),
    protagonist: z.string(),        // 人物身份（如"外卖小哥"、"35岁程序员"）
    setting: z.string(),             // 场景背景
    story: z.string(),               // 故事核心（50字内）
    whyItWorks: z.string(),         // 为什么这个案例有效
  })),
  // P0-2: 原文关键数据（数字/统计），二创必须全部替换
  keyDataPoints: z.array(z.object({
    id: z.string(),
    data: z.string(),                // 原始数据描述（如"72%"、"3小时"、"2024年"）
    context: z.string(),             // 数据出现的上下文
    field: z.string(),               // 领域标签（如"就业率"、"用户留存"等）
  })),
}).strict().refine(
  (data) => data.forbiddenExpressions.length >= 3,
  {
    message: 'forbiddenExpressions must have at least 3 items (提取的高光表达过少，二创无法有效规避风险)',
    path: ['forbiddenExpressions'],
  },
).refine(
  (data) => data.caseStudies.length >= 1,
  {
    message: 'caseStudies must have at least 1 item (无案例的二创缺乏差异化锚点)',
    path: ['caseStudies'],
  },
).refine(
  (data) => data.keyDataPoints.length >= 1,
  {
    message: 'keyDataPoints must have at least 1 item (无数据的二创难以建立对比差异化)',
    path: ['keyDataPoints'],
  },
).refine(
  (data) => data.narrativeStructure.length >= 3,
  {
    message: 'narrativeStructure must have at least 3 sections (叙事结构段数过少，无法支撑完整文章)',
    path: ['narrativeStructure'],
  },
).refine(
  (data) => data.narrativeStructure.every((s) => s.argumentativePath.trim().length > 0),
  {
    message: 'Each narrativeStructure item must have a non-empty argumentativePath (每段必须有论证路径描述)',
    path: ['narrativeStructure'],
  },
).refine(
  (data) => data.emotionCurve.every((e) => e.intensity > 0),
  {
    message: 'Each emotionCurve entry must have intensity > 0 (情绪曲线强度值不能为0)',
    path: ['emotionCurve'],
  },
).refine(
  (data) => data.hookTechnique.template.trim().length > 0,
  {
    message: 'hookTechnique.template must be non-empty (钩子模板不能为空)',
    path: ['hookTechnique', 'template'],
  },
);

export type ViralGenome = z.infer<typeof ViralGenomeSchema>;

// ─── Step 2: Differentiation ───────────────────────────────────────

export const DifferentiationDirectionSchema = z.object({
  name: z.string(),
  perspectiveShift: z.string(),
  audienceShift: z.string(),
  contentShift: z.string(),
  newAngle: z.string(),
  sampleTitle: z.string(),
  differentiationScore: z.number(),
  feasibilityScore: z.number(),
  compositeScore: z.number(),
  // P2-5: 本方向的段落逻辑链（每个方向必须有不同的论证路径）
  structuralCommitment: z.string(),
});

export type DifferentiationDirection = z.infer<typeof DifferentiationDirectionSchema>;

export const DifferentiationOutputSchema = z.object({
  directions: z.array(DifferentiationDirectionSchema),
  selectedDirection: DifferentiationDirectionSchema.nullable(), // nullable for interactive mode
  selectionReason: z.string(),
});

export type DifferentiationOutput = z.infer<typeof DifferentiationOutputSchema>;

// ─── Step 3: New Outline ─────────────────────────────────────────────

export const NewOutlineSectionSchema = z.object({
  correspondingOriginalIndex: z.number(),
  originalPurpose: z.string(),
  newContent: z.object({
    argument: z.string(),
    caseDirection: z.string(),
    expressionStyle: z.string(),
  }),
  wordRatio: z.number(),
  emotionTarget: z.string(),
  // P1-3: 本段落的论证方式，必须与原文的 argumentativePath 不同
  argumentativePath: z.string(),
});

export const NewOutlineSchema = z.object({
  sections: z.array(NewOutlineSectionSchema),
  newHookDesign: z.object({
    technique: z.string(),
    draft: z.string(),
  }),
  newClosingDesign: z.object({
    technique: z.string(),
    direction: z.string(),
  }),
});

export type NewOutline = z.infer<typeof NewOutlineSchema>;

// ─── Step 4: Content Generation ─────────────────────────────────────
// Output is raw markdown string

// ─── Step 5: Dual Review ─────────────────────────────────────────────

export const FlaggedParagraphSchema = z.object({
  paragraphIndex: z.number(),
  recreationText: z.string(),
  similarOriginalText: z.string(),
  similarityType: z.enum(['expression', 'structure', 'example', 'metaphor']),
  severity: z.enum(['high', 'medium', 'low']),
});

export const OriginalityReportSchema = z.object({
  overallScore: z.number(),
  flaggedParagraphs: z.array(FlaggedParagraphSchema),
  passThreshold: z.boolean(),
});

export const ViralPotentialScoresSchema = z.object({
  titleAttraction: z.number().min(1).max(10),
  hookRetention: z.number().min(1).max(10),
  contentValue: z.number().min(1).max(10),
  emotionalEngagement: z.number().min(1).max(10),
  interactionDesign: z.number().min(1).max(10),
});

export const ViralPotentialReportSchema = z.object({
  scores: ViralPotentialScoresSchema,
  comparisonWithOriginal: z.object({
    originalScores: ViralPotentialScoresSchema,
    recreationScores: ViralPotentialScoresSchema,
    improvements: z.array(z.string()),
    regressions: z.array(z.string()),
  }),
  optimizationSuggestions: z.array(z.string()),
});

export const DualReviewResultSchema = z.object({
  originalityReport: OriginalityReportSchema,
  viralPotentialReport: ViralPotentialReportSchema,
  finalArticle: z.string(),
  needsRewrite: z.boolean(),
  // P1/P2 triggers — present when originality passes but element scores are below threshold
  needsLocalRewrite: z.boolean().default(false),
  optimizationTriggers: z.array(z.object({
    element: z.enum(['title', 'hook', 'section', 'cta', 'power-sentences', 'example']),
    score: z.number(),
    position: z.string().optional(), // e.g. "paragraph 3" or "opening" or "emotionCurve position 2"
    suggestion: z.string(),
    action: z.enum(['rewrite-title', 'rewrite-hook', 'rewrite-section', 'rewrite-cta', 'supplement-power-sentences', 'replace-example']),
  })).default([]),
});

export type DualReviewResult = z.infer<typeof DualReviewResultSchema>;

// ─── Local Rewrite ──────────────────────────────────────────────────

export const LocalRewriteResultSchema = z.object({
  originalArticle: z.string(),
  rewrittenArticle: z.string(),
  appliedTriggers: z.array(z.object({
    element: z.string(),
    action: z.string(),
    originalText: z.string().optional(),
    newText: z.string().optional(),
  })),
  remainingTriggers: z.array(z.string()), // actions that could not be applied
});

export type LocalRewriteResult = z.infer<typeof LocalRewriteResultSchema>;

// ─── Final Output ────────────────────────────────────────────────────

export interface RecreateFinalOutput {
  originalTitle: string;
  generatedAt: string;
  recreation: {
    titleOptions: string[];
    recommendedTitle: string;
    content: string;
    wordCount: number;
    directionUsed: z.infer<typeof DifferentiationDirectionSchema>;
    qualityScore: {
      title: number;
      hook: number;
      value: number;
      emotion: number;
      interaction: number;
    };
    originalityReport: {
      overallScore: number;
      flaggedParagraphs: z.infer<typeof FlaggedParagraphSchema>[];
      rewriteIterations: number;
    };
    comparisonWithOriginal: {
      originalScores: {
        title: number;
        hook: number;
        value: number;
        emotion: number;
        interaction: number;
      };
      recreationScores: {
        title: number;
        hook: number;
        value: number;
        emotion: number;
        interaction: number;
      };
      improvementAreas: string[];
      regressionAreas: string[];
    };
  };
  intermediateArtifacts: {
    viralGenome: ViralGenome;
    differentiationDirections: z.infer<typeof DifferentiationDirectionSchema>[];
    selectedDirection: z.infer<typeof DifferentiationDirectionSchema>;
    newOutline: NewOutline;
  };
}

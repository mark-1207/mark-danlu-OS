import { z } from 'zod';

// ─── Step 1: Viral Deconstruction ──────────────────────────────────

export const ViralGenomeSchema = z.object({
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
});

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
  needsLocalRewrite: z.boolean().optional(),
  optimizationTriggers: z.array(z.object({
    element: z.enum(['title', 'hook', 'section', 'cta', 'power-sentences', 'example']),
    score: z.number(),
    position: z.string().optional(), // e.g. "paragraph 3" or "opening" or "emotionCurve position 2"
    suggestion: z.string(),
    action: z.enum(['rewrite-title', 'rewrite-hook', 'rewrite-section', 'rewrite-cta', 'supplement-power-sentences', 'replace-example']),
  })).optional(),
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

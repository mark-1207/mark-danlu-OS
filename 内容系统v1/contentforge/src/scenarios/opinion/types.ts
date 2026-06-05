import { z } from 'zod';

export type OpinionType = 'comparison' | 'causal' | 'judgment';

export interface HKRScore {
  h: number; // Happy: 悬念感/吸引力
  k: number; // Knowledge: 信息量
  r: number; // Resonance: 情绪共鸣
}

export interface RefinedOpinion {
  originalOpinion: string;         // 用户原始输入
  refinedThesis: string;          // 锤炼后的核心论点（1-2句话）
  type: OpinionType;               // 观点类型
  evidence: string[];              // 支撑证据
  counterArguments: string[];      // 已考虑的反驳/反例
  boundaries: string;              // 论点适用边界
  whyNow: string;                 // 为什么现在说这件事
  hkrScore: HKRScore;             // HKR质检分数
  hkrFeedback?: {                  // HKR 反馈（可选）
    h?: string;
    k?: string;
    r?: string;
  };
  recommendedTitles: string[];     // 推荐标题列表
}

export interface ConfirmedOpinion {
  refinedThesis: string;          // 锤炼后的核心论点
  confirmedTitle: string;         // 用户确认的标题
  opinionType: OpinionType;       // 观点类型
  personalCase: string;           // 用户注入的真实案例/经历
  seedMaterial: string;           // 素材路径或内容
}

// HKR Score Schema
const HKRScoreSchema = z.object({
  h: z.number().min(0).max(100),
  k: z.number().min(0).max(100),
  r: z.number().min(0).max(100),
});

// RefinedOpinion Schema
export const RefinedOpinionSchema = z.object({
  originalOpinion: z.string().min(1),
  refinedThesis: z.string().min(1, 'refinedThesis cannot be empty'),
  type: z.enum(['comparison', 'causal', 'judgment']),
  evidence: z.array(z.string()),
  counterArguments: z.array(z.string()),
  boundaries: z.string(),
  whyNow: z.string(),
  hkrScore: HKRScoreSchema,
  recommendedTitles: z.array(z.string()),
});

// ConfirmedOpinion Schema
export const ConfirmedOpinionSchema = z.object({
  refinedThesis: z.string().min(1),
  confirmedTitle: z.string().min(1, 'confirmedTitle cannot be empty'),
  opinionType: z.enum(['comparison', 'causal', 'judgment']),
  personalCase: z.string().optional().default(''),
  seedMaterial: z.string().optional().default(''),
});

export function validateRefinedOpinion(data: unknown): RefinedOpinion {
  return RefinedOpinionSchema.parse(data);
}

export function validateConfirmedOpinion(data: unknown): ConfirmedOpinion {
  return ConfirmedOpinionSchema.parse(data);
}

// Intent result type extension
export interface OpinionIntent {
  type: 'opinion';
  opinion: string;
  platforms: string[];
  direction?: 'auto' | 'interactive';
}

export type IntentResult =
  | { type: 'create'; keyword: string; platforms: string[]; direction?: 'auto' | 'interactive' }
  | { type: 'recreate'; inputPath?: string; platforms: string[]; direction?: 'auto' | 'interactive' }
  | OpinionIntent;

// Learning types — shared across pattern-analyzer and creative-preferences

export type PatternType = 'title' | 'hook' | 'structure' | 'tone' | 'angle' | 'case';
export type Platform = 'wechat' | 'xiaohongshu' | 'douyin';
export type Source = 'revision' | 'feedback' | 'competitor';

// 从 revision manifest 提取的单一模式记录
export interface PatternRecord {
  type: PatternType;
  pattern: string;
  source: Source;
  // 来自 revision
  instruction?: string;
  instructionDetail?: string;
  changeScope?: string[];
  adoptionRate?: number;
  // 来自 feedback / competitor
  engagementRate?: number;
  count: number;
}

// 各平台的创作偏好
export interface PlatformPreferences {
  structure: {
    preference: string;
    weight: number;
    engagementRate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
  };
  tone: {
    preference: string;
    weight: number;
    engagementRate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
  };
  angle: {
    preference: string;
    weight: number;
    engagementRate: number;
    sampleSize: number;
    confidence: 'low' | 'medium' | 'high';
  };
  title: {
    effectivePatterns: Array<{
      pattern: string;
      adoptionRate: number;
      count: number;
    }>;
    confidence: 'low' | 'medium' | 'high';
  };
  hook: {
    effectivePatterns: Array<{
      pattern: string;
      adoptionRate: number;
      count: number;
    }>;
    confidence: 'low' | 'medium' | 'high';
  };
}

// 完整创作偏好（按平台分开）
export interface CreativePreferences {
  wechat: PlatformPreferences;
  xiaohongshu: PlatformPreferences;
  douyin: PlatformPreferences;
  lastUpdated: string;
}

export interface ComplianceIssue {
  type: 'sensitive' | 'forbidden' | 'format';
  severity: 'warn' | 'error';
  message: string;
  line?: number;
  matchedWord?: string;
}

export interface ComplianceResult {
  passed: boolean;
  issues: ComplianceIssue[];
  platform: string;
  fileName: string;
}

export type Platform = 'wechat' | 'xiaohongshu' | 'douyin' | 'universal';

export interface PlatformRules {
  titleMaxLength: number;
  bodyMinLength: number;
  bodyMaxLength: number;
  forbiddenWords: string[];
  sensitivePatterns: string[];
}

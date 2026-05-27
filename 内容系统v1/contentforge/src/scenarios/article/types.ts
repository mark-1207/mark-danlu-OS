export interface ArticleLineage {
  parentRunId: string | null;
  siblingRunIds: string[];
  topicPoolId: string | null;
}

export interface ArticleRecord {
  runId: string;
  scenario: 'create' | 'recreate';
  title: string;
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  filepath: string;
  status: 'completed' | 'partial' | 'failed';
  completedSteps: string[];
  keyword: string;
  angle: string;
  startedAt: string;
  completedAt: string | null;
  tokenCost: number;
  reviewScore: number | null;
  lineage: ArticleLineage;
}

export interface ArticleIndex {
  lastRebuiltAt: string;
  records: ArticleRecord[];
}

export type PlatformFilter = 'wechat' | 'xiaohongshu' | 'douyin';
export type StatusFilter = 'completed' | 'partial' | 'failed';
export type ScenarioFilter = 'create' | 'recreate';

export interface ArticleQuery {
  platform?: PlatformFilter;
  status?: StatusFilter;
  scenario?: ScenarioFilter;
  since?: string;
  until?: string;
  limit?: number;
}
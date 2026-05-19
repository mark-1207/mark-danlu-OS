export interface FeedbackRecord {
  record_id: string;
  fields: {
    文章ID: string;
    内容标题: string;
    原文链接: string;
    平台: 'wechat' | 'xiaohongshu' | 'video';
    主题标签: string[];
    内容角度: string;
    叙事结构: '故事型' | '清单型' | '对比型' | '分析型' | '混合型' | '';
    情感调性: '励志' | '冷静' | '温暖' | '犀利' | '幽默' | '';
    发布日期: string;
    数据周期: '7日' | '14日' | '30日';
    阅读量: number;
    点赞数: number;
    评论数: number;
    转发数: number;
    完播率: number;
    收藏数: number;
    数据备注: string;
    下次更新时间: string;
  };
}

export interface FeedbackSignal {
  topPlatform: string;
  topTags: string[];
  topAngles: string[];
  topStructures: string[];
  topTones: string[];
  engagementRate: number; // 互动率 = (点赞+评论+转发) / 阅读量
  platformDiff: Record<string, number>; // 各平台平均互动率差异
  weakPatterns: WeakPattern[];
}

export interface WeakPattern {
  dimension: 'angle' | 'structure' | 'tone';
  value: string;
  avgEngagement: number;
  recommendation: string;
}

export interface GapAnalysis {
  myTag: string;
  myAvgEngagement: number;
  competitorAvgEngagement: number;
  gap: number; // 正=我优于竞品，负=我弱于竞品
  direction: 'mine_better' | 'competitor_better' | 'parity';
  recommendation: string;
}

export interface FeedbackStats {
  totalArticles: number;
  avgReads: number;
  avgEngagement: number;
  byPlatform: Record<string, { avgReads: number; avgEngagement: number; count: number }>;
  byTag: Record<string, { avgReads: number; avgEngagement: number; count: number }>;
  byStructure: Record<string, { avgReads: number; avgEngagement: number; count: number }>;
  byTone: Record<string, { avgReads: number; avgEngagement: number; count: number }>;
  byAngle: Record<string, { avgReads: number; avgEngagement: number; count: number }>;
}
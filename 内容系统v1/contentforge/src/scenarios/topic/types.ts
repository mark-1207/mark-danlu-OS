// src/scenarios/topic/types.ts

export type Platform = 'wechat' | 'zhihu' | 'bilibili' | 'xiaohongshu' | 'twitter' | 'youtube' | 'xiaoyuzhou' | 'reddit' | 'medium';

export type SourceType = 'crawled' | 'manual' | 'external';

export type AnalysisStatus = 'pending' | 'analyzed' | 'stored';

export interface CompetitorArticle {
  id: string;
  title: string;
  url: string;
  platform: Platform;
  interactionData?: string; // 点赞/收藏/阅读
  summary?: string;          // AI 提取的核心观点
  viralStructure?: string;   // AI 提取的叙事结构
  topicAngle?: string;       // AI 提取的切入角度
  tags: string[];
  source: SourceType;
  isFavorite: boolean;
  status: AnalysisStatus;
  crawledAt: string;
  storedAt?: string;         // 碎片入库时间
}

export interface TopicAnalysisResult {
  summary: string;
  viralStructure: string;
  topicAngle: string;
  tags: string[];
}

export interface CompetitorInsight {
  summary: string;
  viralStructure: string;
  topicAngle: string;
  tags: string[];
  topArticles: CompetitorArticle[];
}

// 飞书表格字段映射
export interface FeishuRecord {
  record_id: string;
  fields: {
    原文标题: string;
    原始链接: string;
    平台: Platform;
    互动数据?: string;
    内容摘要?: string;
    爆款结构?: string;
    选题角度?: string;
    标签?: string[];
    来源类型: SourceType;
    收藏: boolean;
    状态: AnalysisStatus;
    抓取时间: string;
    碎片提取时间?: string;
  };
}

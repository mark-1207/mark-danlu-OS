export type TopicStatus = 'new' | 'selected' | 'generated' | 'dismissed';

export interface TopicItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  publishedAt: string;
  fetchedAt: string;
  status: TopicStatus;
}

export interface TopicPool {
  topics: TopicItem[];
  lastFetchedAt: string;
}

export interface FeedSource {
  name: string;
  rssUrl: string;
  enabled: boolean;
}

export interface CompetitorSource {
  id: string;
  name: string;
  type: 'rss';
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
}

export interface CompetitorSources {
  sources: CompetitorSource[];
  lastWatchedAt: string | null;
}

export interface ScrapedArticle {
  title: string;
  url: string;
  publishedAt: string;
  snippet: string;
  source: string;
}

export interface WatchResult {
  newCount: number;
  duplicateCount: number;
  failedSources: Array<{ id: string; name: string; error: string }>;
  totalScraped: number;
}
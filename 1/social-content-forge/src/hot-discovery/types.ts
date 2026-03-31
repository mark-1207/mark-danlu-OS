import { HotTopic } from '../../types';

export interface FetcherConfig {
  name: string;
  rateLimitMs: number;
  maxItems: number;
}

export interface SourceConfig {
  enabled: boolean;
  rateLimitMs: number;
  maxItems: number;
}

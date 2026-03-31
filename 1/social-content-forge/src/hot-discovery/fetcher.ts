import axios from 'axios';
import { HotTopic } from '../../types';

export abstract class BaseFetcher {
  protected platform: string;
  protected rateLimitMs: number = 1000;
  protected maxItems: number = 20;

  abstract async fetch(): Promise<HotTopic[]>;

  protected async fetchWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.sleep(this.rateLimitMs);
    return fn();
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected baseTopic(overrides: Partial<HotTopic>): HotTopic {
    return {
      id: `${this.platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platform: this.platform as HotTopic['platform'],
      title: '',
      fetchedAt: new Date(),
      ...overrides,
    };
  }
}

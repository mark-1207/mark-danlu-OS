import axios from 'axios';
import { BaseFetcher } from '../fetcher';
import { HotTopic } from '../../types';

export class XiaohongshuFetcher extends BaseFetcher {
  protected platform = 'xiaohongshu';

  async fetch(): Promise<HotTopic[]> {
    try {
      // Note: Xiaohongshu doesn't have a public API.
      // Using third-party data or web scraping would be needed in production
      // For now, returning empty array as placeholder
      // Real implementation would use: https://www.xiaohongshu.com/explore
      console.log('Xiaohongshu fetcher: API not available, returning empty');
      return [];
    } catch (error) {
      console.error('Xiaohongshu fetch error:', error);
      return [];
    }
  }
}

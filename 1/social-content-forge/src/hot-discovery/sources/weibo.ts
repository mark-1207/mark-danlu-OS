import axios from 'axios';
import { BaseFetcher } from '../fetcher';
import { HotTopic } from '../../types';

export class WeiboFetcher extends BaseFetcher {
  protected platform = 'weibo';

  async fetch(): Promise<HotTopic[]> {
    try {
      // Using a public hot search API endpoint
      // Note: In production, use official Weibo API or approved third-party service
      const response = await axios.get('https://weibo.com/ajax/side/hotSearch', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const data = response.data;
      if (!data?.data?.realtime) {
        return [];
      }

      return data.data.realtime.slice(0, this.maxItems).map((item: any) =>
        this.baseTopic({
          title: item.word || item.topic,
          heatScore: item.raw_hot || item.num,
          category: item.category || '综合',
          link: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.topic)}`,
        })
      );
    } catch (error) {
      console.error('Weibo fetch error:', error);
      return [];
    }
  }
}

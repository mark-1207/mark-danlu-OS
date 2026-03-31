import axios from 'axios';
import { BaseFetcher } from '../fetcher';
import { HotTopic } from '../../types';

export class GoogleFetcher extends BaseFetcher {
  protected platform = 'google';

  async fetch(): Promise<HotTopic[]> {
    try {
      // Using Google Trends API via unofficial endpoint
      // In production, use official Google Trends API or SerpAPI
      const response = await axios.get('https://trends.google.com/trends/api/breakingnews', {
        timeout: 5000,
        params: { hl: 'zh-CN' },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }).catch(() => ({ data: { stories: [] } }));

      const stories = response.data?.stories || [];

      return stories.slice(0, this.maxItems).map((item: any) =>
        this.baseTopic({
          title: item.title || item.storyTitle,
          heatScore: item.articles?.[0]?.trends?.[0]?.title ? 1000 : 500,
          category: item.ids?.[0] || '综合',
          link: item.url || item.articleUrl,
        })
      );
    } catch (error) {
      console.error('Google fetch error:', error);
      return [];
    }
  }
}

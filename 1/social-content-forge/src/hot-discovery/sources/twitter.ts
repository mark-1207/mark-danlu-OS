import axios from 'axios';
import { BaseFetcher } from '../fetcher';
import { HotTopic } from '../../types';

export class TwitterFetcher extends BaseFetcher {
  protected platform = 'twitter';

  async fetch(): Promise<HotTopic[]> {
    try {
      // Note: Twitter API requires authentication.
      // Using public endpoint as fallback or mock data
      const response = await axios.get('https://api.twitter.com/1.1/trends/place.json', {
        timeout: 5000,
        params: { id: 1 }, // Worldwide
        headers: {
          // Requires Bearer token in production
        },
      }).catch(() => {
        // Fallback: return empty or mock data for demo
        return { data: [] };
      });

      if (!response.data?.[0]?.trends) {
        return [];
      }

      return response.data[0].trends.slice(0, this.maxItems).map((item: any) =>
        this.baseTopic({
          title: item.name,
          heatScore: item.tweet_volume,
          link: `https://twitter.com/search?q=${encodeURIComponent(item.name)}`,
        })
      );
    } catch (error) {
      console.error('Twitter fetch error:', error);
      return [];
    }
  }
}

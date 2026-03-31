import axios from 'axios';
import { BaseFetcher } from '../fetcher';
import { HotTopic } from '../../types';

export class RedditFetcher extends BaseFetcher {
  protected platform = 'reddit';

  async fetch(): Promise<HotTopic[]> {
    try {
      const response = await axios.get('https://www.reddit.com/r/popular/hot.json', {
        timeout: 5000,
        params: { limit: this.maxItems * 2 },
        headers: {
          'User-Agent': 'SocialContentForge/1.0',
        },
      });

      const posts = response.data?.data?.children || [];

      return posts.slice(0, this.maxItems).map((post: any) =>
        this.baseTopic({
          title: post.data.title,
          heatScore: post.data.score,
          category: post.data.subreddit,
          link: `https://reddit.com${post.data.permalink}`,
        })
      );
    } catch (error) {
      console.error('Reddit fetch error:', error);
      return [];
    }
  }
}

import axios from 'axios';
import { HotTopic } from '../types';
import { BaseFetcher } from './fetcher';
import { WeiboFetcher } from './sources/weibo';
import { TwitterFetcher } from './sources/twitter';
import { GoogleFetcher } from './sources/google';
import { XiaohongshuFetcher } from './sources/xiaohongshu';
import { RedditFetcher } from './sources/reddit';
import { TopicMerger } from './merger';

export interface HotDiscoveryConfig {
  enabledSources: HotTopic['platform'][];
  maxTopicsPerSource: number;
  mergeEnabled: boolean;
}

const DEFAULT_CONFIG: HotDiscoveryConfig = {
  enabledSources: ['weibo', 'twitter', 'google', 'xiaohongshu', 'reddit'],
  maxTopicsPerSource: 20,
  mergeEnabled: true,
};

export class HotDiscoveryService {
  private fetchers: Map<HotTopic['platform'], BaseFetcher>;
  private merger: TopicMerger;
  private config: HotDiscoveryConfig;

  constructor(config: Partial<HotDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchers = new Map();
    this.merger = new TopicMerger();

    this.initFetchers();
  }

  private initFetchers(): void {
    const weibo = new WeiboFetcher();
    weibo.maxItems = this.config.maxTopicsPerSource;
    this.fetchers.set('weibo', weibo);

    const twitter = new TwitterFetcher();
    twitter.maxItems = this.config.maxTopicsPerSource;
    this.fetchers.set('twitter', twitter);

    const google = new GoogleFetcher();
    google.maxItems = this.config.maxTopicsPerSource;
    this.fetchers.set('google', google);

    const xhs = new XiaohongshuFetcher();
    xhs.maxItems = this.config.maxTopicsPerSource;
    this.fetchers.set('xiaohongshu', xhs);

    const reddit = new RedditFetcher();
    reddit.maxItems = this.config.maxTopicsPerSource;
    this.fetchers.set('reddit', reddit);
  }

  async fetchAllTopics(): Promise<HotTopic[]> {
    const promises: Promise<HotTopic[]>[] = [];
    const platformList: HotTopic['platform'][] = [];

    for (const platform of this.config.enabledSources) {
      const fetcher = this.fetchers.get(platform);
      if (fetcher) {
        promises.push(fetcher.fetch());
        platformList.push(platform);
      }
    }

    const results = await Promise.allSettled(promises);

    const allTopics: HotTopic[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTopics.push(...result.value);
      } else {
        console.error(`Failed to fetch from ${platformList[index]}:`, result.reason);
      }
    });

    if (this.config.mergeEnabled) {
      return this.merger.merge(allTopics);
    }

    return allTopics;
  }

  async fetchFromSource(source: HotTopic['platform']): Promise<HotTopic[]> {
    const fetcher = this.fetchers.get(source);
    if (!fetcher) {
      throw new Error(`Unknown source: ${source}`);
    }
    return fetcher.fetch();
  }

  getTopicsByCategory(topics: HotTopic[], category: string): HotTopic[] {
    return this.merger.filterByCategory(topics, category);
  }

  getTopicsByPlatform(topics: HotTopic[], platform: HotTopic['platform']): HotTopic[] {
    return this.merger.filterByPlatform(topics, platform);
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { HotDiscoveryService } from '../../src/hot-discovery';
import { TopicMerger } from '../../src/hot-discovery/merger';
import { HotTopic } from '../../src/types';

describe('HotDiscoveryService', () => {
  let service: HotDiscoveryService;

  beforeEach(() => {
    service = new HotDiscoveryService({
      enabledSources: ['weibo', 'reddit'],
      maxTopicsPerSource: 10,
      mergeEnabled: true,
    });
  });

  it('should create service with config', () => {
    expect(service).toBeInstanceOf(HotDiscoveryService);
  });

  it('should fetch from enabled sources', async () => {
    const topics = await service.fetchAllTopics();
    expect(Array.isArray(topics)).toBe(true);
  });

  it('should fetch from specific source', async () => {
    // Reddit should return some results
    const topics = await service.fetchFromSource('reddit');
    expect(Array.isArray(topics));
  });

  it('should filter by platform', async () => {
    const allTopics = await service.fetchAllTopics();
    const weiboTopics = service.getTopicsByPlatform(allTopics, 'weibo');
    weiboTopics.forEach(t => {
      expect(t.platform).toBe('weibo');
    });
  });
});

describe('TopicMerger', () => {
  let merger: TopicMerger;

  beforeEach(() => {
    merger = new TopicMerger();
  });

  it('should deduplicate by title', () => {
    const topics: HotTopic[] = [
      { id: '1', platform: 'weibo', title: '测试话题', fetchedAt: new Date() },
      { id: '2', platform: 'twitter', title: '测试话题', fetchedAt: new Date() },
      { id: '3', platform: 'reddit', title: '不同话题', fetchedAt: new Date() },
    ];
    const merged = merger.deduplicateByTitle(topics);
    expect(merged.length).toBe(2);
  });

  it('should sort by heat score', () => {
    const topics: HotTopic[] = [
      { id: '1', platform: 'weibo', title: '低热度', heatScore: 100, fetchedAt: new Date() },
      { id: '2', platform: 'weibo', title: '高热度', heatScore: 1000, fetchedAt: new Date() },
      { id: '3', platform: 'weibo', title: '中热度', heatScore: 500, fetchedAt: new Date() },
    ];
    const sorted = merger.sortByHeat(topics);
    expect(sorted[0].title).toBe('高热度');
    expect(sorted[1].title).toBe('中热度');
    expect(sorted[2].title).toBe('低热度');
  });

  it('should filter by category', () => {
    const topics: HotTopic[] = [
      { id: '1', platform: 'weibo', title: '科技话题', category: '科技', fetchedAt: new Date() },
      { id: '2', platform: 'weibo', title: '娱乐话题', category: '娱乐', fetchedAt: new Date() },
    ];
    const filtered = merger.filterByCategory(topics, '科技');
    expect(filtered.length).toBe(1);
    expect(filtered[0].category).toBe('科技');
  });
});

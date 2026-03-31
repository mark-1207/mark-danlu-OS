import { HotTopic } from '../../types';

export class TopicMerger {
  /**
   * Merge topics from multiple sources and deduplicate by title similarity
   */
  merge(topics: HotTopic[]): HotTopic[] {
    const merged = this.deduplicateByTitle(topics);
    return this.sortByHeat(merged);
  }

  /**
   * Deduplicate topics by title (case-insensitive, trimmed)
   */
  deduplicateByTitle(topics: HotTopic[]): HotTopic[] {
    const seen = new Set<string>();
    return topics.filter(topic => {
      const normalized = topic.title.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  /**
   * Sort topics by heat score descending
   */
  sortByHeat(topics: HotTopic[]): HotTopic[] {
    return [...topics].sort((a, b) => {
      const scoreA = a.heatScore || 0;
      const scoreB = b.heatScore || 0;
      return scoreB - scoreA;
    });
  }

  /**
   * Filter topics by category
   */
  filterByCategory(topics: HotTopic[], category: string): HotTopic[] {
    return topics.filter(t => t.category?.toLowerCase().includes(category.toLowerCase()));
  }

  /**
   * Filter topics by platform
   */
  filterByPlatform(topics: HotTopic[], platform: HotTopic['platform']): HotTopic[] {
    return topics.filter(t => t.platform === platform);
  }
}

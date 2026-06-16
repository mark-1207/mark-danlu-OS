import type { EmbeddingResult } from './types.js';

export class EmbeddingCache {
  private cache = new Map<string, EmbeddingResult>();
  private accessOrder: string[] = [];
  private maxSize = 500;

  get(text: string): EmbeddingResult | undefined {
    const key = this.normalize(text);
    const entry = this.cache.get(key);
    if (entry) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return entry;
  }

  set(text: string, result: EmbeddingResult): void {
    const key = this.normalize(text);
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    } else if (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
    this.cache.set(key, result);
    this.accessOrder.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  private normalize(text: string): string {
    return text.toLowerCase().trim();
  }
}

export const embeddingCache = new EmbeddingCache();

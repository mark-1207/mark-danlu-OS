import fs from 'fs/promises';
import path from 'path';
import type { TopicPool, TopicItem, TopicStatus } from './types.js';

const POOL_PATH = path.join(process.cwd(), 'output', 'corpus', 'topic-pool.json');

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = i;
  for (let i = 1; i <= an; i++) {
    let prev = i;
    for (let j = 1; j <= bn; j++) {
      const val = a[i - 1] === b[j - 1] ? matrix[j - 1] : Math.min(matrix[j - 1] + 1, prev + 1, matrix[j] + 1);
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[bn] = prev;
  }
  return matrix[bn];
}

function titleSimilar(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.length === 0) return 1;
  return 1 - levenshtein(shorter, longer) / longer.length;
}

export async function loadPool(): Promise<TopicPool> {
  try {
    const content = await fs.readFile(POOL_PATH, 'utf-8');
    return JSON.parse(content) as TopicPool;
  } catch {
    return { topics: [], lastFetchedAt: '' };
  }
}

export async function savePool(pool: TopicPool): Promise<void> {
  await fs.mkdir(path.dirname(POOL_PATH), { recursive: true });
  await fs.writeFile(POOL_PATH, JSON.stringify(pool, null, 2), 'utf-8');
}

export function addToPool(pool: TopicPool, items: TopicItem[]): { added: number; duplicates: number } {
  let added = 0;
  let duplicates = 0;

  for (const item of items) {
    const isDuplicate = pool.topics.some(
      (existing) =>
        existing.url === item.url ||
        titleSimilar(existing.title, item.title) > 0.85,
    );
    if (isDuplicate) {
      duplicates++;
    } else {
      pool.topics.push(item);
      added++;
    }
  }

  return { added, duplicates };
}

export function updateStatus(pool: TopicPool, id: string, status: TopicStatus): boolean {
  const topic = pool.topics.find((t) => t.id === id);
  if (!topic) return false;
  topic.status = status;
  return true;
}

export function getTopicsByStatus(pool: TopicPool, status?: TopicStatus): TopicItem[] {
  if (!status) return [...pool.topics];
  return pool.topics.filter((t) => t.status === status);
}

export function getTopicById(pool: TopicPool, id: string): TopicItem | undefined {
  return pool.topics.find((t) => t.id === id);
}

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { CompetitorSource, CompetitorSources } from './types.js';

const SOURCES_PATH = path.join(process.cwd(), 'output', 'corpus', 'competitor-sources.json');

export function defaultSources(): CompetitorSources {
  return { sources: [], lastWatchedAt: null };
}

export async function loadSources(): Promise<CompetitorSources> {
  try {
    const content = await fs.readFile(SOURCES_PATH, 'utf-8');
    return JSON.parse(content) as CompetitorSources;
  } catch {
    return defaultSources();
  }
}

export async function saveSources(sources: CompetitorSources): Promise<void> {
  await fs.mkdir(path.dirname(SOURCES_PATH), { recursive: true });
  await fs.writeFile(SOURCES_PATH, JSON.stringify(sources, null, 2), 'utf-8');
}

export function addSource(
  sources: CompetitorSources,
  name: string,
  url: string,
  type: 'rss' = 'rss',
): CompetitorSource {
  const source: CompetitorSource = {
    id: crypto.randomUUID(),
    name,
    type,
    url,
    enabled: true,
    lastFetchedAt: null,
  };
  sources.sources.push(source);
  return source;
}

export function removeSource(sources: CompetitorSources, id: string): boolean {
  const idx = sources.sources.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  sources.sources.splice(idx, 1);
  return true;
}

export function getSourceById(sources: CompetitorSources, id: string): CompetitorSource | null {
  return sources.sources.find((s) => s.id === id) ?? null;
}

export function getEnabledSources(sources: CompetitorSources): CompetitorSource[] {
  return sources.sources.filter((s) => s.enabled);
}

export function updateLastFetched(sources: CompetitorSources, id: string): void {
  const source = getSourceById(sources, id);
  if (source) {
    source.lastFetchedAt = new Date().toISOString();
  }
}

export function updateLastWatched(sources: CompetitorSources): void {
  sources.lastWatchedAt = new Date().toISOString();
}
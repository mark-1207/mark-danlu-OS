import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import type { ArticleRecord, ArticleIndex, PlatformFilter } from './types.js';

const INDEX_PATH = path.join(process.cwd(), 'output', 'corpus', 'article-index.json');

interface RunMeta {
  runId: string;
  scenario: 'create' | 'recreate';
  status: string;
  startedAt: string;
  completedAt: string | null;
  completedSteps: string[];
  tokenUsage: { estimatedCost: number };
}

interface TopicAnalysis {
  keyword: string;
  subTopics?: Array<{ name: string; description?: string }>;
}

interface TopicAssignment {
  wechat?: { primaryAngle: string; candidateTitles?: string[] };
  xiaohongshu?: { primaryAngle: string; candidateTitles?: string[] };
  douyin?: { primaryAngle: string; candidateTitles?: string[] };
}

function platformFromStep(stepName: string): 'wechat' | 'xiaohongshu' | 'douyin' | null {
  if (stepName.endsWith('-wechat')) return 'wechat';
  if (stepName.endsWith('-xiaohongshu')) return 'xiaohongshu';
  if (stepName.endsWith('-douyin')) return 'douyin';
  return null;
}

function platformFromFilename(filename: string): 'wechat' | 'xiaohongshu' | 'douyin' | null {
  if (filename.endsWith('.wechat.md')) return 'wechat';
  if (filename.endsWith('.xhs.md')) return 'xiaohongshu';
  if (filename.endsWith('.douyin.md')) return 'douyin';
  return null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function scanRunDirectory(runDir: string, runMeta: RunMeta): Promise<ArticleRecord[]> {
  const records: ArticleRecord[] = [];
  const runId = runMeta.runId;

  // Detect platforms from completed steps
  const platforms = new Set<'wechat' | 'xiaohongshu' | 'douyin'>();
  for (const step of runMeta.completedSteps) {
    const p = platformFromStep(step);
    if (p) platforms.add(p);
  }

  // Also detect from markdown files (in case steps were partial)
  const files = await fs.readdir(runDir);
  for (const file of files) {
    const p = platformFromFilename(file);
    if (p) platforms.add(p);
  }

  // Read topic-analysis.json for keyword
  const topicAnalysis = await readJsonFile<TopicAnalysis>(
    path.join(runDir, 'topic-analysis.json')
  );

  // Read topic-assignment.json for angles
  const topicAssignment = await readJsonFile<TopicAssignment>(
    path.join(runDir, 'topic-assignment.json')
  );

  const keyword = topicAnalysis?.keyword ?? '';
  const subTopicNames = topicAnalysis?.subTopics?.map((s) => s.name).join(' ') ?? '';

  for (const platform of platforms) {
    // Title from markdown file
    const mdExt = platform === 'wechat' ? '.wechat.md' : platform === 'xiaohongshu' ? '.xhs.md' : '.douyin.md';
    const mdFiles = files.filter((f) => f.endsWith(mdExt));
    const title = mdFiles[0]?.replace(mdExt, '').replace(/\.md$/, '') ?? `${runId} ${platform}`;

    // Review score
    const reviewData = await readJsonFile<{ score?: number; weightedScore?: number }>(
      path.join(runDir, `review-${platform}.json`)
    );
    const reviewScore = reviewData?.weightedScore ?? reviewData?.score ?? null;

    // Angle from assignment
    const assignment = topicAssignment?.[platform];
    const angle = assignment?.primaryAngle ?? '';

    // Filepath
    const filepath = `${runDir}/${mdFiles[0] ?? ''}`;

    records.push({
      runId: `${runId}-${platform}`,
      scenario: runMeta.scenario,
      title,
      platform,
      filepath: mdFiles[0] ? `${runId}/${mdFiles[0]}` : '',
      status: runMeta.status === 'completed' ? 'completed' : runMeta.status === 'failed' ? 'failed' : 'partial',
      completedSteps: runMeta.completedSteps.filter((s) => s.includes(platform)),
      keyword: `${keyword} ${subTopicNames}`.trim(),
      angle,
      startedAt: runMeta.startedAt,
      completedAt: runMeta.completedAt,
      tokenCost: runMeta.tokenUsage.estimatedCost,
      reviewScore,
      lineage: {
        parentRunId: null,
        siblingRunIds: [],
        topicPoolId: null,
      },
    });
  }

  return records;
}

function buildSiblingMap(records: ArticleRecord[]): void {
  // Group by runId prefix (before the -platform suffix)
  const runGroups = new Map<string, ArticleRecord[]>();
  for (const record of records) {
    const runPrefix = record.runId.replace(/-(wechat|xiaohongshu|douyin)$/, '');
    if (!runGroups.has(runPrefix)) runGroups.set(runPrefix, []);
    runGroups.get(runPrefix)!.push(record);
  }

  // Set siblingRunIds for records in the same run group
  for (const [, group] of runGroups) {
    if (group.length <= 1) continue;
    for (const record of group) {
      record.lineage.siblingRunIds = group
        .filter((r) => r.runId !== record.runId)
        .map((r) => r.runId);
    }
  }
}

export async function rebuildIndex(): Promise<ArticleIndex> {
  const outputDir = path.join(process.cwd(), 'output');
  const corpusDir = path.join(outputDir, 'corpus');

  const allRecords: ArticleRecord[] = [];

  let entries: import('fs/promises').Dirent[];
  try {
    entries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch (err) {
    logger.error('[article-scanner] cannot read output directory:', String(err));
    return { lastRebuiltAt: new Date().toISOString(), records: [] };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(outputDir, entry.name);

    const runMeta = await readJsonFile<RunMeta>(path.join(runDir, 'run-meta.json'));
    if (!runMeta) continue;
    if (runMeta.scenario !== 'create' && runMeta.scenario !== 'recreate') continue;

    const records = await scanRunDirectory(runDir, runMeta);
    allRecords.push(...records);
  }

  // Build sibling relationships
  buildSiblingMap(allRecords);

  // Sort by startedAt descending
  allRecords.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Save index
  const index: ArticleIndex = {
    lastRebuiltAt: new Date().toISOString(),
    records: allRecords,
  };

  await fs.mkdir(corpusDir, { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');

  logger.info(`[article-scanner] indexed ${allRecords.length} articles from ${outputDir}`);
  return index;
}

export async function loadIndex(): Promise<ArticleIndex> {
  try {
    const content = await fs.readFile(INDEX_PATH, 'utf-8');
    return JSON.parse(content) as ArticleIndex;
  } catch {
    return { lastRebuiltAt: '', records: [] };
  }
}

export function queryIndex(
  index: ArticleIndex,
  filters: { platform?: PlatformFilter; since?: string; limit?: number }
): ArticleRecord[] {
  let records = index.records;

  if (filters.platform) {
    records = records.filter((r) => r.platform === filters.platform);
  }
  if (filters.since) {
    records = records.filter((r) => r.startedAt >= filters.since!);
  }
  if (filters.limit) {
    records = records.slice(0, filters.limit);
  }

  return records;
}

export function searchIndex(index: ArticleIndex, keyword: string): ArticleRecord[] {
  const lower = keyword.toLowerCase();
  return index.records.filter(
    (r) =>
      r.title.toLowerCase().includes(lower) ||
      r.keyword.toLowerCase().includes(lower) ||
      r.angle.toLowerCase().includes(lower)
  );
}

export function getRecordById(index: ArticleIndex, runId: string): ArticleRecord | null {
  return index.records.find((r) => r.runId === runId) ?? null;
}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('article-scanner', () => {
  const tmpDir = path.join(os.tmpdir(), `contentforge-test-${Date.now()}`);
  const outputDir = path.join(tmpDir, 'output');
  const corpusDir = path.join(outputDir, 'corpus');
  const indexPath = path.join(corpusDir, 'article-index.json');

  beforeEach(async () => {
    await fs.mkdir(corpusDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  // T1: rebuildIndex scans output dirs and creates index
  it('T1: rebuildIndex scans output dirs and creates index', async () => {
    const runDir = path.join(outputDir, 'create_1234567890000');
    await fs.mkdir(runDir);

    await fs.writeFile(
      path.join(runDir, 'run-meta.json'),
      JSON.stringify({
        runId: 'create_1234567890000',
        scenario: 'create',
        status: 'completed',
        startedAt: '2026-05-27T10:00:00.000Z',
        completedAt: '2026-05-27T10:05:00.000Z',
        completedSteps: ['topic-analysis', 'topic-assignment', 'outline-wechat', 'content-wechat', 'review-wechat'],
        tokenUsage: { estimatedCost: 0.15 },
      })
    );

    await fs.writeFile(
      path.join(runDir, 'topic-analysis.json'),
      JSON.stringify({
        keyword: 'AI时代职场转型',
        subTopics: [{ name: '职业规划' }],
      })
    );

    await fs.writeFile(
      path.join(runDir, 'review-wechat.json'),
      JSON.stringify({ weightedScore: 78 })
    );

    await fs.writeFile(path.join(runDir, 'AI时代职场转型.wechat.md'), '# AI时代职场转型');

    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { rebuildIndex } = await import('../../../src/scenarios/article/scanner.js');
      const index = await rebuildIndex();

      expect(index.lastRebuiltAt).toBeTruthy();
      expect(index.records.length).toBeGreaterThan(0);

      const record = index.records.find((r) => r.runId.includes('create_1234567890000'));
      expect(record).toBeDefined();
      expect(record!.scenario).toBe('create');
      expect(record!.platform).toBe('wechat');
      expect(record!.title).toContain('AI时代职场转型');
      expect(record!.status).toBe('completed');
      expect(record!.reviewScore).toBe(78);
      expect(record!.tokenCost).toBe(0.15);
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T2: loadIndex reads from disk
  it('T2: loadIndex reads from disk and returns cached index', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const testIndex = {
        lastRebuiltAt: '2026-05-27T10:00:00.000Z',
        records: [
          {
            runId: 'test-run-wechat',
            scenario: 'create',
            title: '测试文章',
            platform: 'wechat',
            filepath: 'test/测试.wechat.md',
            status: 'completed',
            completedSteps: ['topic-analysis', 'content-wechat'],
            keyword: '测试',
            angle: '测试角度',
            startedAt: '2026-05-27T10:00:00.000Z',
            completedAt: null,
            tokenCost: 0.05,
            reviewScore: 75,
            lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null },
          },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(testIndex));

      const { loadIndex } = await import('../../../src/scenarios/article/scanner.js');
      const index = await loadIndex();

      expect(index.records.length).toBe(1);
      expect(index.records[0].title).toBe('测试文章');
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T3: queryIndex filters by platform
  it('T3: queryIndex filters by platform', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const testIndex = {
        lastRebuiltAt: '2026-05-27T10:00:00.000Z',
        records: [
          { runId: 'run1-wechat', scenario: 'create', title: '文章1', platform: 'wechat', filepath: '', status: 'completed', completedSteps: [], keyword: '', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
          { runId: 'run1-xiaohongshu', scenario: 'create', title: '文章2', platform: 'xiaohongshu', filepath: '', status: 'completed', completedSteps: [], keyword: '', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
          { runId: 'run1-douyin', scenario: 'create', title: '文章3', platform: 'douyin', filepath: '', status: 'completed', completedSteps: [], keyword: '', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(testIndex));

      const { loadIndex, queryIndex } = await import('../../../src/scenarios/article/scanner.js');
      const index = await loadIndex();

      const wechatOnly = queryIndex(index, { platform: 'wechat' });
      expect(wechatOnly.length).toBe(1);
      expect(wechatOnly[0].platform).toBe('wechat');

      const xhsResults = queryIndex(index, { platform: 'xiaohongshu' });
      expect(xhsResults.length).toBe(1);
      expect(xhsResults[0].platform).toBe('xiaohongshu');
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T4: searchIndex matches title/keyword
  it('T4: searchIndex matches title and keyword', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const testIndex = {
        lastRebuiltAt: '2026-05-27T10:00:00.000Z',
        records: [
          { runId: 'run1-wechat', scenario: 'create', title: 'AI时代职场转型', platform: 'wechat', filepath: '', status: 'completed', completedSteps: [], keyword: 'AI 职场 转型', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
          { runId: 'run2-wechat', scenario: 'create', title: '小红书运营技巧', platform: 'wechat', filepath: '', status: 'completed', completedSteps: [], keyword: '小红书 运营', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(testIndex));

      const { loadIndex, searchIndex } = await import('../../../src/scenarios/article/scanner.js');
      const index = await loadIndex();

      const results1 = searchIndex(index, 'AI');
      expect(results1.length).toBe(1);
      expect(results1[0].title).toBe('AI时代职场转型');

      const results2 = searchIndex(index, '小红书');
      expect(results2.length).toBe(1);
      expect(results2[0].title).toBe('小红书运营技巧');

      const results3 = searchIndex(index, '职场');
      expect(results3.length).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T5: getRecordById finds by runId
  it('T5: getRecordById finds record by runId', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const testIndex = {
        lastRebuiltAt: '2026-05-27T10:00:00.000Z',
        records: [
          { runId: 'create_1234567890000-wechat', scenario: 'create', title: '测试文章', platform: 'wechat', filepath: '', status: 'completed', completedSteps: [], keyword: '', angle: '', startedAt: '2026-05-27T10:00:00.000Z', completedAt: null, tokenCost: 0.01, reviewScore: null, lineage: { parentRunId: null, siblingRunIds: [], topicPoolId: null } },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(testIndex));

      const { loadIndex, getRecordById } = await import('../../../src/scenarios/article/scanner.js');
      const index = await loadIndex();

      const found = getRecordById(index, 'create_1234567890000-wechat');
      expect(found).toBeDefined();
      expect(found!.title).toBe('测试文章');

      const notFound = getRecordById(index, 'non-existent-id');
      expect(notFound).toBeNull();
    } finally {
      process.cwd = originalCwd;
    }
  });
});
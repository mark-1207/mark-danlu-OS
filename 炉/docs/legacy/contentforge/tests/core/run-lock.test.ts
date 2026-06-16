import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { acquireRunLock, releaseRunLock } from '../../src/utils/run-lock.js';

const TEST_OUTPUT_DIR = path.join(os.tmpdir(), 'contentforge-lock-test');

describe('run-lock', () => {
  const runId = 'test_run_' + Date.now();

  beforeEach(async () => {
    await fs.mkdir(path.join(TEST_OUTPUT_DIR, runId), { recursive: true });
  });

  afterEach(async () => {
    await releaseRunLock(runId, TEST_OUTPUT_DIR).catch(() => {});
    try {
      await fs.rm(path.join(TEST_OUTPUT_DIR, runId), { recursive: true });
    } catch {}
  });

  it('acquires lock and writes lock file', async () => {
    const lock = await acquireRunLock(runId, TEST_OUTPUT_DIR);
    expect(lock.pid).toBe(process.pid);
    expect(lock.hostname).toBe(os.hostname());
    expect(lock.command).toContain('node');

    const lockFile = await fs.readFile(
      path.join(TEST_OUTPUT_DIR, runId, '.lock'),
      'utf-8',
    );
    const parsed = JSON.parse(lockFile);
    expect(parsed.pid).toBe(process.pid);
  });

  it('releases lock and removes lock file', async () => {
    await acquireRunLock(runId, TEST_OUTPUT_DIR);
    await releaseRunLock(runId, TEST_OUTPUT_DIR);

    const lockExists = await fs
      .access(path.join(TEST_OUTPUT_DIR, runId, '.lock'))
      .then(() => true)
      .catch(() => false);
    expect(lockExists).toBe(false);
  });

  it('releaseRunLock is idempotent', async () => {
    await releaseRunLock(runId, TEST_OUTPUT_DIR);
    await expect(releaseRunLock(runId, TEST_OUTPUT_DIR)).resolves.toBeUndefined();
  });

  it('acquiring same lock twice throws', async () => {
    await acquireRunLock(runId, TEST_OUTPUT_DIR);
    await expect(acquireRunLock(runId, TEST_OUTPUT_DIR)).rejects.toThrow(
      'already locked',
    );
  });

  it('stale lock is overwritten', async () => {
    const fakePid = 99999999;
    const staleLockPath = path.join(TEST_OUTPUT_DIR, runId, '.lock');
    await fs.writeFile(
      staleLockPath,
      JSON.stringify({
        pid: fakePid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString(),
        command: 'fake',
      }),
      'utf-8',
    );

    const lock = await acquireRunLock(runId, TEST_OUTPUT_DIR);
    expect(lock.pid).toBe(process.pid);
  });
});

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface RunLock {
  pid: number;
  hostname: string;
  startedAt: string;
  command: string;
}

const LOCK_FILE_NAME = '.lock';

/**
 * Acquire an exclusive lock for a runId.
 * Throws if the run is already locked by a running process.
 * Uses file-based locking with stale lock detection.
 */
export async function acquireRunLock(runId: string, outputDir: string): Promise<RunLock> {
  const runDir = path.join(outputDir, runId);
  const lockPath = path.join(runDir, LOCK_FILE_NAME);

  try {
    const lockContent = await fs.readFile(lockPath, 'utf-8');
    const lock: RunLock = JSON.parse(lockContent);

    // Check if the locking process is still running
    if (processExists(lock.pid)) {
      throw new Error(
        `Run "${runId}" is already locked by PID ${lock.pid} (${lock.command}) on ${lock.hostname}. ` +
        `Use "resume list" to check running processes, or manually delete ${lockPath} if the process has crashed.`,
      );
    }

    // Stale lock — process no longer running, safe to overwrite
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // No lock file exists — proceed
  }

  const lock: RunLock = {
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
    command: process.argv.slice(1, 4).join(' '),
  };

  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
  return lock;
}

/**
 * Release the lock for a runId.
 * Idempotent — does nothing if no lock exists.
 */
export async function releaseRunLock(runId: string, outputDir: string): Promise<void> {
  const lockPath = path.join(path.join(outputDir, runId), LOCK_FILE_NAME);
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // Already unlocked — no-op
  }
}

/**
 * Check if a process with the given PID exists.
 * On Windows, we check if the process is still running via tasklist.
 * On Unix, we send signal 0.
 */
function processExists(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      // Use tasklist on Windows — must parse output to check if PID actually appears
      const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
        stdio: 'pipe',
        timeout: 3000,
        encoding: 'utf-8',
      });
      // Output format: "imagename  PID  session#  mem_usage\r\nprocessname  12345  ..."
      // If PID appears in output, process exists
      return output.includes(String(pid));
    } else {
      // Unix: signal 0 checks if process exists without sending any signal
      execSync(`kill -0 ${pid}`, { stdio: 'pipe', timeout: 3000 });
      return true;
    }
  } catch {
    return false;
  }
}

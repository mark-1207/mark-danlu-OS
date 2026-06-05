import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { execLarkCli } from '../../../src/utils/feishu-cli.js';
import { execSync } from 'child_process';
import { writeFile, unlink } from 'fs/promises';

const execSyncMock = vi.mocked(execSync);
const writeFileMock = vi.mocked(writeFile);
const unlinkMock = vi.mocked(unlink);

beforeEach(() => {
  vi.clearAllMocks();
  execSyncMock.mockReturnValue('ok' as unknown as Buffer);
});

describe('execLarkCli', () => {
  it('T1: passes args to npx @larksuite/cli@1.0.1', async () => {
    await execLarkCli(['base', '+record-list', '--limit', '10']);
    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('npx @larksuite/cli@1.0.1 base +record-list --limit 10'),
      expect.objectContaining({ encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }),
    );
  });

  it('T2: returns stdout from execSync', async () => {
    execSyncMock.mockReturnValue('{"records":[]}' as unknown as Buffer);
    const result = await execLarkCli(['base', '+record-list']);
    expect(result).toBe('{"records":[]}');
  });

  it('T3: writes JSON to temp file when --json value is inline', async () => {
    await execLarkCli(['base', '+record-batch-create', '--json', '{"records":[1]}']);
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringMatching(/^lark-temp-.*\.json$/),
      '{"records":[1]}',
      'utf-8',
    );
    const calledArgs = execSyncMock.mock.calls[0][0] as string;
    expect(calledArgs).toMatch(/@lark-temp-.*\.json/);
    expect(calledArgs).not.toContain('{"records":[1]}');
  });

  it('T4: skips temp file when --json value starts with @', async () => {
    await execLarkCli(['base', '+record-batch-create', '--json', '@existing.json']);
    expect(writeFileMock).not.toHaveBeenCalled();
    const calledArgs = execSyncMock.mock.calls[0][0] as string;
    expect(calledArgs).toContain('@existing.json');
  });

  it('T5: cleans up temp file after exec', async () => {
    await execLarkCli(['base', '+record-batch-create', '--json', '{"x":1}']);
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringMatching(/^lark-temp-.*\.json$/));
  });

  it('T6: cleans up temp file even if execSync throws', async () => {
    execSyncMock.mockImplementation(() => { throw new Error('CLI failed'); });
    await expect(execLarkCli(['base', '--json', '{"x":1}'])).rejects.toThrow('lark-cli 执行失败');
    expect(unlinkMock).toHaveBeenCalled();
  });

  it('T7: wraps error with lark-cli prefix', async () => {
    execSyncMock.mockImplementation(() => { throw new Error('network timeout'); });
    await expect(execLarkCli(['base', '+record-list'])).rejects.toThrow('lark-cli 执行失败: network timeout');
  });
});

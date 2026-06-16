import { execSync } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

const CLI_PACKAGE = '@larksuite/cli@1.0.1';

async function writeJsonTemp(jsonValue: string): Promise<string> {
  const tempFile = `lark-temp-${randomUUID()}.json`;
  await writeFile(tempFile, jsonValue, 'utf-8');
  return tempFile;
}

async function removeTempFile(path: string): Promise<void> {
  try { await unlink(path); } catch { /* ignore */ }
}

export async function execLarkCli(args: string[]): Promise<string> {
  const jsonArgIndex = args.indexOf('--json');
  let tempFile: string | null = null;
  let finalArgs = args;

  if (jsonArgIndex !== -1 && args[jsonArgIndex + 1] && !args[jsonArgIndex + 1].startsWith('@')) {
    const jsonValue = args[jsonArgIndex + 1];
    tempFile = await writeJsonTemp(jsonValue);
    finalArgs = [...args.slice(0, jsonArgIndex + 1), `@${tempFile}`, ...args.slice(jsonArgIndex + 2)];
  }

  try {
    return execSync(`npx ${CLI_PACKAGE} ${finalArgs.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`lark-cli 执行失败: ${msg}`);
  } finally {
    if (tempFile) await removeTempFile(tempFile);
  }
}

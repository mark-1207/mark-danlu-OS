import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { FeedbackRecord } from './types.js';

const FEISHU_FEEDBACK_TABLE_APP_TOKEN = process.env.FEISHU_FEEDBACK_TABLE_APP_TOKEN ?? '';
const FEISHU_FEEDBACK_TABLE_ID = process.env.FEISHU_FEEDBACK_TABLE_ID ?? '';

async function writeJsonTemp(jsonValue: string): Promise<string> {
  const tempFile = `lark-temp-${randomUUID()}.json`;
  await writeFile(tempFile, jsonValue, 'utf-8');
  return tempFile;
}

async function removeTempFile(path: string): Promise<void> {
  try { await unlink(path); } catch { /* ignore */ }
}

async function execLarkCli(args: string[]): Promise<string> {
  const jsonArgIndex = args.indexOf('--json');
  let tempFile: string | null = null;
  let finalArgs = args;

  if (jsonArgIndex !== -1 && args[jsonArgIndex + 1] && !args[jsonArgIndex + 1].startsWith('@')) {
    const jsonValue = args[jsonArgIndex + 1];
    tempFile = await writeJsonTemp(jsonValue);
    finalArgs = [...args.slice(0, jsonArgIndex + 1), `@${tempFile}`, ...args.slice(jsonArgIndex + 2)];
  }

  try {
    return execSync(`npx @larksuite/cli@1.0.1 ${finalArgs.join(' ')}`, {
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

/**
 * Read all feedback records from the Feishu table.
 */
export async function readFeedbackRecords(): Promise<FeedbackRecord[]> {
  if (!FEISHU_FEEDBACK_TABLE_APP_TOKEN || !FEISHU_FEEDBACK_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_FEEDBACK_TABLE_APP_TOKEN / FEISHU_FEEDBACK_TABLE_ID');
  }

  const records: FeedbackRecord[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const output = await execLarkCli([
      'base', '+record-list',
      '--base-token', FEISHU_FEEDBACK_TABLE_APP_TOKEN,
      '--table-id', FEISHU_FEEDBACK_TABLE_ID,
      '--offset', String(offset),
      '--limit', String(limit),
    ]);

    const data = JSON.parse(output);
    const items: unknown[][] = data?.data?.data ?? [];
    const fieldNames: string[] = data?.data?.fields ?? [];
    const recordIds: string[] = data?.data?.record_id_list ?? [];

    if (items.length === 0) break;

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const recordId = recordIds[i];
      const fields: Record<string, unknown> = {};
      for (let j = 0; j < fieldNames.length; j++) {
        fields[fieldNames[j]] = row[j];
      }

      const platformRaw = fields['平台'] as string | string[];
      const platform = (Array.isArray(platformRaw) ? platformRaw[0] : platformRaw) as FeedbackRecord['fields']['平台'] ?? '';

      records.push({
        record_id: recordId,
        fields: {
          内容标题: (fields['内容标题'] as string) ?? '',
          原文链接: (fields['原文链接'] as string) ?? '',
          平台: platform as FeedbackRecord['fields']['平台'],
          主题标签: normalizeTags(fields['主题标签']),
          内容角度: (fields['内容角度'] as string) ?? '',
          叙事结构: (fields['叙事结构'] as string) as FeedbackRecord['fields']['叙事结构'] ?? '',
          情感调性: (fields['情感调性'] as string) as FeedbackRecord['fields']['情感调性'] ?? '',
          发布日期: (fields['发布日期'] as string) ?? '',
          数据周期: (fields['数据周期'] as string) as FeedbackRecord['fields']['数据周期'] ?? '',
          阅读量: Number(fields['阅读量']) || 0,
          点赞数: Number(fields['点赞数']) || 0,
          评论数: Number(fields['评论数']) || 0,
          转发数: Number(fields['转发数']) || 0,
          完播率: Number(fields['完播率']) || 0,
          收藏数: Number(fields['收藏数']) || 0,
          数据备注: (fields['数据备注'] as string) ?? '',
          下次更新时间: (fields['下次更新时间'] as string) ?? '',
        },
      });
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return records;
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}
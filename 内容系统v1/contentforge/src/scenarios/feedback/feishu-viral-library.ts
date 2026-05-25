import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { ViralGenome } from '../../scenarios/recreate/types.js';

const FEISHU_VIRAL_LIBRARY_APP_TOKEN = process.env.FEISHU_VIRAL_LIBRARY_APP_TOKEN ?? '';
const FEISHU_VIRAL_LIBRARY_TABLE_ID = process.env.FEISHU_VIRAL_LIBRARY_TABLE_ID ?? '';
const FEISHU_TABLE_APP_TOKEN = process.env.FEISHU_TOPIC_TABLE_APP_TOKEN ?? '';
const FEISHU_TABLE_ID = process.env.FEISHU_TOPIC_TABLE_ID ?? '';

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
    return execSync(`npx lark-cli ${finalArgs.join(' ')}`, {
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

interface InteractionData {
  阅读数?: number;
  点赞数?: number;
  评论数?: number;
  转发数?: number;
  收藏数?: number;
}

/**
 * Look up interaction data from the competitor table by URL.
 * Returns empty object if URL not found.
 */
async function lookupInteractionData(url: string): Promise<InteractionData> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    return {};
  }

  try {
    const output = await execLarkCli([
      'base', '+record-list',
      '--base-token', FEISHU_TABLE_APP_TOKEN,
      '--table-id', FEISHU_TABLE_ID,
      '--limit', '1',
    ]);

    const data = JSON.parse(output);
    const items: unknown[][] = data?.data?.data ?? [];
    const fieldNames: string[] = data?.data?.fields ?? [];

    for (const row of items) {
      const fields: Record<string, unknown> = {};
      for (let j = 0; j < fieldNames.length; j++) {
        fields[fieldNames[j]] = row[j];
      }

      const recordUrl = (fields['原始链接'] as string) ?? '';
      if (recordUrl === url) {
        return {
          阅读数: Number(fields['阅读数']) || 0,
          点赞数: Number(fields['点赞数']) || 0,
          评论数: Number(fields['评论数']) || 0,
          转发数: Number(fields['转发数']) || 0,
          收藏数: Number(fields['收藏数']) || 0,
        };
      }
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Write a ViralGenome record to the Feishu Viral Genome Library table.
 * Uses upsert by URL so duplicate URLs update rather than create.
 */
export async function writeViralGenomeToFeishu(record: {
  url: string;
  title: string;
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  viralGenome: ViralGenome;
}): Promise<string> {
  if (!FEISHU_VIRAL_LIBRARY_APP_TOKEN || !FEISHU_VIRAL_LIBRARY_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_VIRAL_LIBRARY_APP_TOKEN / FEISHU_VIRAL_LIBRARY_TABLE_ID');
  }

  // Look up interaction data from competitor table
  const interaction = await lookupInteractionData(record.url);
  const interactionJson = JSON.stringify(interaction);

  const fields = {
    '原文标题': record.title,
    '原始链接': record.url,
    '平台': record.platform,
    '互动数据': interactionJson,
    '抓取时间': new Date().toISOString().slice(0, 10),
    'ViralGenomeJSON': JSON.stringify(record.viralGenome),
  };

  const output = await execLarkCli([
    'base', '+record-upsert',
    '--base-token', FEISHU_VIRAL_LIBRARY_APP_TOKEN,
    '--table-id', FEISHU_VIRAL_LIBRARY_TABLE_ID,
    '--json', JSON.stringify(fields),
  ]);

  const data = JSON.parse(output);
  return data.data.record.record_id_list?.[0] as string ?? data.data.record_id as string;
}

/**
 * Load a ViralGenome record from the Feishu Viral Genome Library by record_id.
 * Throws if record not found.
 */
export async function loadViralGenomeFromFeishu(recordId: string): Promise<ViralGenome> {
  if (!FEISHU_VIRAL_LIBRARY_APP_TOKEN || !FEISHU_VIRAL_LIBRARY_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_VIRAL_LIBRARY_APP_TOKEN / FEISHU_VIRAL_LIBRARY_TABLE_ID');
  }

  const output = await execLarkCli([
    'base', '+record-list',
    '--base-token', FEISHU_VIRAL_LIBRARY_APP_TOKEN,
    '--table-id', FEISHU_VIRAL_LIBRARY_TABLE_ID,
    '--offset', '0',
    '--limit', '200',
  ]);

  const data = JSON.parse(output);
  const items: unknown[][] = data?.data?.data ?? [];
  const fieldNames: string[] = data?.data?.fields ?? [];
  const recordIds: string[] = data?.data?.record_id_list ?? [];

  const idx = recordIds.indexOf(recordId);
  if (idx === -1) {
    throw new Error(`ViralGenome record "${recordId}" 不存在`);
  }

  const row = items[idx];
  const fields: Record<string, unknown> = {};
  for (let j = 0; j < fieldNames.length; j++) {
    fields[fieldNames[j]] = row[j];
  }

  const viralJson = (fields['ViralGenomeJSON'] as string) ?? '{}';
  return JSON.parse(viralJson) as ViralGenome;
}
// src/scenarios/topic/feishu-sync.ts
import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { CompetitorArticle, FeishuRecord, SourceType, AnalysisStatus } from './types.js';

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

function execLarkCliSync(args: string[]): string {
  return execSync(`npx lark-cli ${args.join(' ')}`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

// 来源类型转换（内部 → 中文）
function sourceToChinese(source: SourceType): '我的创作' | '竞品抓取' | '手动录入' {
  switch (source) {
    case 'crawled': return '竞品抓取';
    case 'manual': return '手动录入';
    case 'external': return '我的创作';
  }
}

// 来源类型转换（中文 → 内部）
function chineseToSource(s: string | string[]): SourceType {
  const v = Array.isArray(s) ? s[0] : s;
  if (v === '竞品抓取') return 'crawled';
  if (v === '手动录入') return 'manual';
  return 'external';
}

// 状态转换（内部 → 中文）
function statusToChinese(status: AnalysisStatus): '待分析' | '已分析' | '已入库' {
  switch (status) {
    case 'pending': return '待分析';
    case 'analyzed': return '已分析';
    case 'stored': return '已入库';
  }
}

// 状态转换（中文 → 内部）
function chineseToStatus(s: string): AnalysisStatus {
  if (s === '待分析') return 'pending';
  if (s === '已分析') return 'analyzed';
  if (s === '已入库') return 'stored';
  return 'pending';
}

/**
 * 读取飞书表格所有记录（分页）
 */
export async function readFeishuRecords(): Promise<FeishuRecord[]> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const records: FeishuRecord[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const output = await execLarkCli([
      'base', '+record-list',
      '--base-token', FEISHU_TABLE_APP_TOKEN,
      '--table-id', FEISHU_TABLE_ID,
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
      records.push({
        record_id: recordId,
        fields: {
          原文标题: (fields['原文标题'] as string) ?? '',
          原文: fields['原文'] as string | undefined,
          原始链接: (fields['原始链接'] as string) ?? '',
          平台: (fields['平台'] as string) as FeishuRecord['fields']['平台'],
          互动数据: fields['互动数据'] as string | undefined,
          内容摘要: fields['内容摘要'] as string | undefined,
          爆款结构: fields['爆款结构'] as string | undefined,
          选题角度: fields['选题角度'] as string | undefined,
          标签: Array.isArray(fields['标签']) ? (fields['标签'] as string[]) : typeof fields['标签'] === 'string' ? (fields['标签'] as string).split(',').filter(Boolean) : [],
          来源类型: chineseToSource(fields['来源类型'] as string | string[]) as FeishuRecord['fields']['来源类型'],
          收藏: Array.isArray(fields['收藏']) ? (fields['收藏'] as string[]).includes('是') : (fields['收藏'] as string) === '是',
          状态: chineseToStatus((fields['状态'] as string) ?? '') as FeishuRecord['fields']['状态'],
          抓取时间: (fields['抓取时间'] as string) ?? '',
          创建时间: fields['创建时间'] as string | undefined,
          发布时间: fields['发布计划时间'] as string | undefined,
          碎片提取时间: fields['碎片提取时间'] as string | undefined,
        },
      });
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return records;
}

/**
 * 写入单条记录到飞书表格
 */
export async function writeFeishuRecord(article: CompetitorArticle): Promise<string> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const fields = {
    '原文标题': article.title,
    '原文': article.content ?? '',
    '原始链接': article.url,
    '平台': article.platform,
    '互动数据': article.interactionData ?? '',
    '内容摘要': article.summary ?? '',
    '爆款结构': article.viralStructure ?? '',
    '选题角度': article.topicAngle ?? '',
    '标签': article.tags,
    '来源类型': sourceToChinese(article.source),
    '收藏': article.isFavorite ? ['是'] : [],
    '状态': statusToChinese(article.status),
    '抓取时间': article.crawledAt,
    '创建时间': article.crawledAt,
  };

  const output = await execLarkCli([
    'base', '+record-upsert',
    '--base-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--json', JSON.stringify(fields),
  ]);

  const data = JSON.parse(output);
  return data.data.record.record_id_list?.[0] as string ?? data.data.record_id as string;
}

/**
 * 更新飞书表格记录状态
 */
export async function updateFeishuRecordStatus(
  recordId: string,
  status: AnalysisStatus,
  extraFields?: Record<string, unknown>
): Promise<void> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }

  const fields: Record<string, unknown> = { '状态': statusToChinese(status) };
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      fields[key] = value;
    }
  }

  await execLarkCli([
    'base', '+record-upsert',
    '--base-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--record-id', recordId,
    '--json', JSON.stringify(fields),
  ]);
}

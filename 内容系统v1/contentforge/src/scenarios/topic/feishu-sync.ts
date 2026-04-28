// src/scenarios/topic/feishu-sync.ts
import { execSync } from 'child_process';
import type { CompetitorArticle, FeishuRecord, SourceType, AnalysisStatus } from './types.js';

const FEISHU_TABLE_APP_TOKEN = process.env.FEISHU_TOPIC_TABLE_APP_TOKEN ?? '';
const FEISHU_TABLE_ID = process.env.FEISHU_TOPIC_TABLE_ID ?? '';

function execLarkCli(args: string[]): string {
  try {
    return execSync(`npx lark-cli ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`lark-cli 执行失败: ${msg}`);
  }
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
function chineseToSource(s: string): SourceType {
  if (s === '竞品抓取') return 'crawled';
  if (s === '手动录入') return 'manual';
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

export async function readFeishuRecords(): Promise<FeishuRecord[]> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }
  const output = execLarkCli([
    'table', 'read',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--page-size', '500',
  ]);
  try {
    const raw = JSON.parse(output);
    // raw 是 Chinese display values，需要转换
    const records: FeishuRecord[] = raw.map((r: Record<string, unknown>) => ({
      record_id: r.record_id as string,
      fields: {
        原文标题: r['原文标题'] as string,
        原始链接: r['原始链接'] as string,
        平台: r['平台'] as FeishuRecord['fields']['平台'],
        互动数据: r['互动数据'] as string | undefined,
        内容摘要: r['内容摘要'] as string | undefined,
        爆款结构: r['爆款结构'] as string | undefined,
        选题角度: r['选题角度'] as string | undefined,
        标签: r['标签'] as string[] | undefined,
        来源类型: chineseToSource(r['来源类型'] as string) as FeishuRecord['fields']['来源类型'],
        收藏: (r['收藏'] as string) === '是', // boolean
        状态: chineseToStatus(r['状态'] as string) as FeishuRecord['fields']['状态'],
        抓取时间: r['抓取时间'] as string,
        碎片提取时间: r['碎片提取时间'] as string | undefined,
      },
    }));
    return records;
  } catch {
    throw new Error(`解析飞书记录失败: ${output.slice(0, 200)}`);
  }
}

export async function writeFeishuRecord(article: CompetitorArticle): Promise<string> {
  if (!FEISHU_TABLE_APP_TOKEN || !FEISHU_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_TOPIC_TABLE_APP_TOKEN / FEISHU_TOPIC_TABLE_ID');
  }
  const fields = {
    '原文标题': article.title,
    '原始链接': article.url,
    '平台': article.platform,
    '互动数据': article.interactionData ?? '',
    '内容摘要': article.summary ?? '',
    '爆款结构': article.viralStructure ?? '',
    '选题角度': article.topicAngle ?? '',
    '标签': article.tags,
    '来源类型': sourceToChinese(article.source),
    '收藏': article.isFavorite ? '是' : '',
    '状态': statusToChinese(article.status),
    '抓取时间': article.crawledAt,
  };
  const output = execLarkCli([
    'table', 'create',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--fields', JSON.stringify(fields),
  ]);
  const result = JSON.parse(output);
  return result.record_id as string;
}

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
  execLarkCli([
    'table', 'update',
    '--app-token', FEISHU_TABLE_APP_TOKEN,
    '--table-id', FEISHU_TABLE_ID,
    '--record-id', recordId,
    '--fields', JSON.stringify(fields),
  ]);
}
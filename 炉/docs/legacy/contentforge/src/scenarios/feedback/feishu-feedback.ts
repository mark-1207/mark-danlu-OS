import 'dotenv/config';
import { execLarkCli } from '../../utils/feishu-cli.js';
import type { FeedbackRecord, CreativePreferencesRecord } from './types.js';

const FEISHU_FEEDBACK_TABLE_APP_TOKEN = process.env.FEISHU_FEEDBACK_TABLE_APP_TOKEN ?? '';
const FEISHU_FEEDBACK_TABLE_ID = process.env.FEISHU_FEEDBACK_TABLE_ID ?? '';
const FEISHU_CREATIVE_PREFERENCES_SHEET_ID = process.env.FEISHU_CREATIVE_PREFERENCES_SHEET_ID ?? '';

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
          文章ID: (fields['文章ID'] as string) ?? '',
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

/**
 * Read all creative preferences records from the Feishu sheet.
 */
export async function readCreativePreferences(): Promise<CreativePreferencesRecord[]> {
  if (!FEISHU_FEEDBACK_TABLE_APP_TOKEN || !FEISHU_FEEDBACK_TABLE_ID || !FEISHU_CREATIVE_PREFERENCES_SHEET_ID) {
    throw new Error('缺少飞书配置: FEISHU_FEEDBACK_TABLE_APP_TOKEN / FEISHU_FEEDBACK_TABLE_ID / FEISHU_CREATIVE_PREFERENCES_SHEET_ID');
  }

  const records: CreativePreferencesRecord[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const output = await execLarkCli([
      'base', '+record-list',
      '--base-token', FEISHU_FEEDBACK_TABLE_APP_TOKEN,
      '--table-id', FEISHU_FEEDBACK_TABLE_ID,
      '--sheet-id', FEISHU_CREATIVE_PREFERENCES_SHEET_ID,
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
          platform: (fields['platform'] as 'wechat' | 'xiaohongshu' | 'douyin') ?? 'wechat',
          preferences_json: (fields['preferences_json'] as string) ?? '{}',
          last_updated: (fields['last_updated'] as string) ?? '',
        },
      });
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return records;
}

/**
 * Write a feedback record to the Feishu table.
 * Minimal fields required: 文章ID, 内容标题, 平台, 阅读量, 点赞数, 评论数, 转发数
 */
export async function writeFeedbackRecord(record: {
  articleId: string;
  title: string;
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  reads: number;
  likes: number;
  comments: number;
  shares: number;
  tags?: string[];
  angle?: string;
  structure?: string;
  tone?: string;
  publishDate?: string;
  dataPeriod?: '7日' | '14日' | '30日';
  notes?: string;
}): Promise<void> {
  if (!FEISHU_FEEDBACK_TABLE_APP_TOKEN || !FEISHU_FEEDBACK_TABLE_ID) {
    throw new Error('缺少飞书配置: FEISHU_FEEDBACK_TABLE_APP_TOKEN / FEISHU_FEEDBACK_TABLE_ID');
  }

  const records = [{
    文章ID: record.articleId,
    内容标题: record.title,
    原文链接: '',
    平台: record.platform,
    主题标签: record.tags ?? [],
    内容角度: record.angle ?? '',
    叙事结构: (record.structure ?? '') as FeedbackRecord['fields']['叙事结构'],
    情感调性: (record.tone ?? '') as FeedbackRecord['fields']['情感调性'],
    发布日期: record.publishDate ?? new Date().toISOString().slice(0, 10),
    数据周期: (record.dataPeriod ?? '7日') as FeedbackRecord['fields']['数据周期'],
    阅读量: record.reads,
    点赞数: record.likes,
    评论数: record.comments,
    转发数: record.shares,
    完播率: 0,
    收藏数: 0,
    数据备注: record.notes ?? '',
    下次更新时间: '',
  }];

  const jsonArg = JSON.stringify({ records });
  await execLarkCli([
    'base', '+record-batch-create',
    '--base-token', FEISHU_FEEDBACK_TABLE_APP_TOKEN,
    '--table-id', FEISHU_FEEDBACK_TABLE_ID,
    '--json', jsonArg,
  ]);
}

/**
 * Write creative preferences records to Feishu (upsert by platform).
 * Updates existing rows or creates new ones, preventing unbounded row growth.
 */
export async function writeCreativePreferences(
  wechatPrefs: object,
  xiaohongshuPrefs: object,
  douyinPrefs: object,
): Promise<void> {
  if (!FEISHU_FEEDBACK_TABLE_APP_TOKEN || !FEISHU_FEEDBACK_TABLE_ID || !FEISHU_CREATIVE_PREFERENCES_SHEET_ID) {
    throw new Error('缺少飞书配置: FEISHU_FEEDBACK_TABLE_APP_TOKEN / FEISHU_FEEDBACK_TABLE_ID / FEISHU_CREATIVE_PREFERENCES_SHEET_ID');
  }

  // Read existing records to get record_ids for upsert
  const existing = await readCreativePreferences();
  const idByPlatform = new Map(existing.map(r => [r.fields.platform, r.record_id]));

  const today = new Date().toISOString().slice(0, 10);
  const platforms = [
    { platform: 'wechat', prefs: wechatPrefs },
    { platform: 'xiaohongshu', prefs: xiaohongshuPrefs },
    { platform: 'douyin', prefs: douyinPrefs },
  ] as const;

  for (const { platform, prefs } of platforms) {
    const fields = {
      platform,
      preferences_json: JSON.stringify(prefs),
      last_updated: today,
    };
    const args = [
      'base', '+record-upsert',
      '--base-token', FEISHU_FEEDBACK_TABLE_APP_TOKEN,
      '--table-id', FEISHU_FEEDBACK_TABLE_ID,
      '--sheet-id', FEISHU_CREATIVE_PREFERENCES_SHEET_ID,
      '--json', JSON.stringify(fields),
    ];
    const existingId = idByPlatform.get(platform);
    if (existingId) args.push('--record-id', existingId);
    await execLarkCli(args);
  }
}
/**
 * 飞书多维表格同步模块
 * 将生成的内容自动同步到飞书多维表格
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;  // 多维表格的 app_token
  tableId: string;   // 表格内的 table_id
}

interface ContentRecord {
  contentId: string;
  title: string;
  sourceType: 'url' | 'search' | 'material';
  sourceUrl?: string;
  overallScore: number;
  emotionScore: number;
  utilityScore: number;
  narrativeScore: number;
  status: '草稿' | '已确认' | '已发布';
  // v2: Full content strings (Feishu API truncates to 100 chars, file path used as fallback)
  wechatContent?: string;
  xiaohongshuContent?: string;
  twitterContent?: string;
  // Backwards compatibility: file paths
  wechatPath?: string;
  xiaohongshuPath?: string;
  twitterPath?: string;
  createdAt: string;
}

interface TokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface RecordResponse {
  code: number;
  msg: string;
  data: {
    record: {
      record_id: string;
    };
  };
}

let cachedToken: { token: string; expireAt: number } | null = null;

/**
 * 获取飞书 Tenant Access Token
 */
async function getTenantToken(config: FeishuConfig): Promise<string> {
  // 检查缓存
  if (cachedToken && Date.now() < cachedToken.expireAt) {
    return cachedToken.token;
  }

  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axios.post<TokenResponse>(url, {
        app_id: config.appId,
        app_secret: config.appSecret
      }, { timeout: 10000 });

      if (response.data.code === 0) {
        cachedToken = {
          token: response.data.tenant_access_token,
          expireAt: Date.now() + (response.data.expire - 60) * 1000 // 提前1分钟过期
        };
        return cachedToken.token;
      }

      console.error(`[Feishu] Token获取失败: ${response.data.msg}`);
    } catch (error) {
      console.error(`[Feishu] Token请求失败 (尝试 ${attempt + 1}/3):`, error);
      if (attempt < 2) await new Promise(r => setTimeout(r, [2000, 4000, 8000][attempt]));
    }
  }

  throw new Error('飞书Token获取失败');
}

/**
 * 同步内容记录到飞书多维表格
 */
export async function syncToFeishu(
  config: FeishuConfig,
  record: ContentRecord
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const token = await getTenantToken(config);

    const fields: Record<string, any> = {
      'content_id': record.contentId,
      '标题': record.title.substring(0, 100), // 飞书文本限制
      '来源类型': record.sourceType,
      '综合评分': record.overallScore,
      '情绪分': record.emotionScore,
      '实用分': record.utilityScore,
      '叙事分': record.narrativeScore,
      '状态': record.status,
    };

    if (record.sourceUrl) {
      fields['原始链接'] = record.sourceUrl;
    }

    // v2: Full content strings (Feishu truncates to 100 chars, full content stored locally)
    // Prefer content strings over file paths for backwards compatibility
    if (record.wechatContent) {
      fields['微信版本'] = record.wechatContent.substring(0, 100);
    } else if (record.wechatPath) {
      fields['微信版本'] = record.wechatPath;
    }

    if (record.xiaohongshuContent) {
      fields['小红书版本'] = record.xiaohongshuContent.substring(0, 100);
    } else if (record.xiaohongshuPath) {
      fields['小红书版本'] = record.xiaohongshuPath;
    }

    if (record.twitterContent) {
      fields['Twiter版本'] = record.twitterContent.substring(0, 100);
    } else if (record.twitterPath) {
      fields['Twiter版本'] = record.twitterPath;
    }

    // 飞书 datetime 字段需要时间戳格式（毫秒）
    const createdTime = new Date(record.createdAt).getTime();
    fields['创建时间'] = createdTime;

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`;

    const response = await axios.post<RecordResponse>(
      url,
      { fields },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (response.data.code === 0) {
      return {
        success: true,
        recordId: response.data.data.record.record_id
      };
    }

    return {
      success: false,
      error: response.data.msg
    };

  } catch (error: any) {
    console.error('[Feishu] 同步失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 创建内容记录
 * v2: 支持完整内容字符串，而不仅是文件路径
 */
export function createContentRecord(
  title: string,
  sourceType: 'url' | 'search' | 'material',
  sourceUrl: string | undefined,
  evaluation: {
    overallScore: number;
    emotionScore: number;
    utilityScore: number;
    narrativeScore: number;
  },
  platformContent: {
    wechat?: string;
    xiaohongshu?: string;
    twitter?: string;
  }
): ContentRecord {
  return {
    contentId: uuidv4(),
    title,
    sourceType,
    sourceUrl,
    overallScore: evaluation.overallScore,
    emotionScore: evaluation.emotionScore,
    utilityScore: evaluation.utilityScore,
    narrativeScore: evaluation.narrativeScore,
    status: '草稿',
    // v2: Full content strings
    wechatContent: platformContent.wechat,
    xiaohongshuContent: platformContent.xiaohongshu,
    twitterContent: platformContent.twitter,
    createdAt: new Date().toISOString()
  };
}

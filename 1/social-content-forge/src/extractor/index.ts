/**
 * 内容提取模块
 * 支持URL提取、主题搜索、素材解析
 */

import axios from 'axios';
import type { ExtractedContent, InputType } from '../types.js';

/**
 * 识别输入类型
 */
export function identifyInputType(input: string): InputType {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }
  if (trimmed.includes('mp.weixin.qq.com')) {
    return 'url';
  }
  if (trimmed.length < 200 && !trimmed.includes('\n')) {
    return 'search';
  }
  return 'material';
}

/**
 * 从输入中提取URL（处理触发词前缀）
 */
export function extractUrlFromInput(input: string): string | null {
  const trimmed = input.trim();
  // 匹配 https?:// 开头或包含 mp.weixin.qq.com 的 URL
  const urlMatch = trimmed.match(/https?:\/\/[^\s\u3000-\u9fff]+/);
  if (urlMatch) {
    return urlMatch[0];
  }
  const wxMatch = trimmed.match(/(https?:\/\/[^\s]*mp\.weixin\.qq\.com[^\s]*)/);
  if (wxMatch) {
    return wxMatch[1];
  }
  return null;
}

/**
 * 提取微信公众号内容
 * 通过抓取页面获取文章内容
 */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  try {
    // 使用 axios 获取页面
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = response.data as string;

    // 提取标题
    const titleMatch = html.match(/<title>(.*?)<\/title>/i) ||
                       html.match(/"title":\s*"(.*?)"/) ||
                       html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '未识别标题';

    // 提取作者
    const authorMatch = html.match(/"author":\s*"(.*?)"/) ||
                        html.match(/<span[^>]*id="js_name"[^>]*>(.*?)<\/span>/i);
    const author = authorMatch ? authorMatch[1] : '未知作者';

    // 提取发布时间
    const publishTimeMatch = html.match(/"publish_time":\s*"(.*?)"/) ||
                             html.match(/<em[^>]*>(.*?)<\/em>/i);
    const publishTime = publishTimeMatch ? publishTimeMatch[1] : new Date().toISOString();

    // 提取正文内容 (简化版，实际项目应使用专门的解析库)
    const contentMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>/i) ||
                         html.match(/class="rich_media_content"[^>]*>([\s\S]*?)<\/div>/i) ||
                         html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    let content = '';
    if (contentMatch) {
      content = extractTextFromHtml(contentMatch[1]);
    }

    // 如果提取失败，使用原始数据提示
    if (content.length < 100) {
      content = `无法直接提取正文内容。请访问原始链接获取完整内容。\n\n链接: ${url}\n\n建议：复制文章全文作为素材输入，或使用 wechat-article-extractor skill 进行提取。`;
    }

    return {
      type: 'url',
      source: url,
      content,
      metadata: {
        title,
        author,
        publishTime,
        source: '微信公众号',
      },
    };
  } catch (error: any) {
    throw new Error(`提取失败: ${error.message}`);
  }
}

/**
 * 从HTML中提取纯文本
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 解码HTML实体
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  return text.replace(/&[a-z]+;/gi, match => entities[match] || match);
}

/**
 * 搜索主题相关内容
 */
export async function searchTopic(keyword: string): Promise<ExtractedContent> {
  return {
    type: 'search',
    source: keyword,
    content: `[搜索关键词: ${keyword}]\n\n请基于此主题搜索相关高阅读量文章作为参考。\n\n提示：在实际使用中，可以通过 WebSearch 工具搜索相关爆款文章内容。`,
    metadata: {
      source: '搜索',
    },
  };
}

/**
 * 解析素材内容
 */
export function parseMaterial(content: string, title?: string): ExtractedContent {
  const cleanedContent = content.trim();

  let extractedTitle = title;
  if (!extractedTitle) {
    const titleMatch = cleanedContent.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      extractedTitle = titleMatch[1];
    } else {
      extractedTitle = cleanedContent.split('\n')[0].slice(0, 50);
    }
  }

  return {
    type: 'material',
    source: 'user-input',
    content: cleanedContent,
    metadata: {
      title: extractedTitle,
      source: '用户素材',
    },
  };
}

/**
 * 主提取函数
 */
export async function extract(input: string, userProvidedTitle?: string): Promise<ExtractedContent> {
  const inputType = identifyInputType(input);

  switch (inputType) {
    case 'url': {
      const url = extractUrlFromInput(input);
      if (!url) {
        throw new Error('无法从输入中提取有效URL');
      }
      return extractFromUrl(url);
    }
    case 'search':
      return searchTopic(input);
    case 'material':
      return parseMaterial(input, userProvidedTitle);
    default:
      throw new Error(`不支持的输入类型: ${inputType}`);
  }
}

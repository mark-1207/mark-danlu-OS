/**
 * 内容提取模块
 * 支持URL提取、主题搜索、素材解析
 */

import axios from 'axios';
import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
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
 * 优先使用 wechat-article-extractor skill，失败时降级
 */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  // 如果是微信文章，优先使用 wechat-article-extractor
  if (url.includes('mp.weixin.qq.com')) {
    const wxResult = await tryWechatExtractor(url);
    if (wxResult.content.length > 100) {
      return wxResult;
    }
  }

  // 尝试直接抓取
  const directResult = await tryDirectExtract(url);
  if (directResult.content.length > 100) {
    return directResult;
  }

  // 通过 Sogou 搜索获取（适用于微信文章）
  const sogouResult = await trySogouExtract(url);
  if (sogouResult.content.length > 100) {
    return sogouResult;
  }

  // 如果都失败，返回提示
  return {
    type: 'url',
    source: url,
    content: `无法提取正文内容。请访问原始链接获取完整内容。\n\n链接: ${url}\n\n建议：复制文章全文作为素材输入。`,
    metadata: {
      title: '未识别标题',
      author: '未知作者',
      publishTime: new Date().toISOString(),
      source: '微信公众号',
    },
  };
}

/**
 * 使用 wechat-article-extractor skill 提取微信文章
 */
async function tryWechatExtractor(url: string): Promise<ExtractedContent> {
  try {
    const skillPath = 'C:\\Users\\admin\\.claude\\skills\\wechat-article-extractor';
    const scriptPath = join(skillPath, 'scripts', 'extract.js');

    // 使用 node 执行提取脚本
    const result = execSync(`node -e "const {extract}=require('${scriptPath.replace(/\\/g, '\\\\')}');extract('${url}').then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(e)));"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const data = JSON.parse(result);
    if (data.done && data.code === 0 && data.data) {
      const article = data.data;
      // 从 HTML 内容中提取纯文本
      const textContent = extractTextFromHtml(article.msg_content || '');

      return {
        type: 'url',
        source: url,
        content: textContent,
        metadata: {
          title: article.msg_title || '未识别标题',
          author: article.msg_author || '未知作者',
          publishTime: article.msg_publish_time || new Date().toISOString(),
          source: article.account_name || '微信公众号',
        },
      };
    }
  } catch (error: any) {
    console.error('[WechatExtractor]', error.message);
  }

  return { type: 'url', source: url, content: '', metadata: { title: '', author: '', publishTime: '', source: '微信公众号' } };
}

/**
 * 直接抓取页面（适用于已渲染的文章）
 */
async function tryDirectExtract(url: string): Promise<ExtractedContent> {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const html = response.data as string;

  // 尝试从 JSON 数据中提取
  const jsonMatch = html.match(/var\s+biz\s*=\s*"?([^";\s]+)/);
  const nicknameMatch = html.match(/"nickname"\s*:\s*"([^"]+)"/);
  const titleMatch = html.match(/"title"\s*:\s*"([^"]+)"/) ||
                     html.match(/<title>(.*?)<\/title>/i);
  const authorMatch = html.match(/"author"\s*:\s*"([^"]+)"/);
  const contentMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/class="rich_media_content"[^>]*>([\s\S]*?)<\/div>/i);

  let content = '';
  if (contentMatch) {
    content = extractTextFromHtml(contentMatch[1]);
  }

  return {
    type: 'url',
    source: url,
    content,
    metadata: {
      title: titleMatch ? decodeHtmlEntities(titleMatch[1]) : '未识别标题',
      author: authorMatch ? authorMatch[1] : (nicknameMatch ? nicknameMatch[1] : '未知作者'),
      publishTime: new Date().toISOString(),
      source: '微信公众号',
    },
  };
}

/**
 * 通过 Sogou 搜索API提取微信文章内容
 */
async function trySogouExtract(url: string): Promise<ExtractedContent> {
  // 从 URL 中提取 biz 和 mid
  const urlMatch = url.match(/__biz=([^&]+).*?mid=(\d+)/);
  if (!urlMatch) {
    return { type: 'url', source: url, content: '', metadata: { title: '', author: '', publishTime: '', source: '微信公众号' } };
  }

  const biz = urlMatch[1];
  const mid = urlMatch[2];

  // 调用 Sogou 搜索 API
  const searchUrl = `https://weixin.sogou.com/weixin?type=1&s_from=input&query=${biz}&ie=utf8&_sug_=n&_sug_type_=`;
  const response = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });

  const html = response.data as string;

  // 提取标题和链接
  const articleMatch = html.match(new RegExp(`href="(https://mp\\.weixin\\.qq\\.com/s\\?[^"]*${mid}[^"]*)"[^>]*>([^<]+)<`));
  if (articleMatch) {
    const articleUrl = articleMatch[1].replace(/\\&amp;/g, '&');
    const articleTitle = decodeHtmlEntities(articleMatch[2]);

    // 抓取文章详情
    return tryDirectExtract(articleUrl);
  }

  return { type: 'url', source: url, content: '', metadata: { title: '', author: '', publishTime: '', source: '微信公众号' } };
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

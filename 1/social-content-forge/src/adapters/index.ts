/**
 * 平台适配器统一导出
 */

export { wechatAdapter, adaptWechat } from './wechat/index.js';
export { xiaohongshuAdapter, adaptXiaohongshu } from './xiaohongshu/index.js';
export { twitterAdapter, adaptTwitter } from './twitter/index.js';
export type { PlatformAdapter, AdaptedContent, CheckResult, ContentContext } from './types.js';

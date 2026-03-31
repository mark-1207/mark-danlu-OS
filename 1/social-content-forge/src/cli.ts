/**
 * CLI 入口文件
 */

import { generateContent } from './index.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Social Content Forge CLI

用法:
  npx tsx src/cli.ts <输入内容或URL>
  npx tsx src/cli.ts --no-sync-feishu <输入内容或URL>

说明:
  - 飞书同步默认启用
  - 使用 --no-sync-feishu 禁用飞书同步

示例:
  npx tsx src/cli.ts "https://mp.weixin.qq.com/s/xxxxx"
  npx tsx src/cli.ts --no-sync-feishu "AI如何改变内容创作行业"
`);
  process.exit(0);
}

// 飞书同步默认启用，使用 --no-sync-feishu 禁用
const noSyncFeishu = args.includes('--no-sync-feishu');
const syncFeishu = !noSyncFeishu;
const input = args.filter(a => !a.startsWith('--')).join(' ');

console.log('Starting Social Content Forge...');
console.log(`Input: ${input}`);
console.log(`Sync Feishu: ${syncFeishu ? 'enabled' : 'disabled'}`);

generateContent(input, { syncFeishu })
  .then(result => {
    console.log('\n=== Generation Complete ===');
    console.log(`Content ID: ${result.contentId}`);
    console.log(`Overall Score: ${result.evaluation.overallScore}/100`);
    console.log(`Outputs: ${result.outputs.length} files`);
    if (result.feishuRecordId) {
      console.log(`Feishu Record ID: ${result.feishuRecordId}`);
    }
  })
  .catch(error => {
    console.error('\n=== Generation Failed ===');
    console.error(error);
    process.exit(1);
  });

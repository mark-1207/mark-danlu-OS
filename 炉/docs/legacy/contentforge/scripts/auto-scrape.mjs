#!/usr/bin/env node
/**
 * 竞品文章自动抓取脚本
 * 从 scrape-urls.txt 读取 URL，逐条抓取+分析+写入飞书
 *
 * 用法：node scripts/auto-scrape.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const URLS_FILE = join(__dirname, 'scrape-urls.txt');
const LOG_FILE = join(ROOT, 'output', 'scrape-log.txt');

// ── 读取 URL 列表 ────────────────────────────────────────────────────

function loadUrls() {
  if (!existsSync(URLS_FILE)) {
    // 创建示例文件
    writeFileSync(URLS_FILE, [
      '# 竞品文章 URL 列表',
      '# 每行一个 URL，# 开头为注释',
      '# 空行自动跳过',
      '',
      '# 示例：',
      '# https://mp.weixin.qq.com/s/xxxxxxx',
      '# https://www.xiaohongshu.com/explore/xxxxxxx',
    ].join('\n'), 'utf-8');
    return [];
  }

  const lines = readFileSync(URLS_FILE, 'utf-8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  return lines;
}

// ── 抓取单条 ──────────────────────────────────────────────────────────

function scrapeOne(url) {
  try {
    const output = execSync(
      `node dist/index.js topic scrape --url "${url}" --no-interactive`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return { success: true, output };
  } catch (err) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    return { success: false, output: stdout + stderr, error: err.message };
  }
}

// ── 解析分析结果 ──────────────────────────────────────────────────────

function parseAnalysis(output) {
  const match = output.match(/--- 竞品分析 ---([\s\S]*?)--- end ---/);
  if (!match) return null;

  const block = match[1];
  const get = (key) => {
    const m = block.match(new RegExp(`${key}: (.+)`));
    return m ? m[1].trim() : '';
  };

  return {
    title: get('标题'),
    platform: get('平台'),
    summary: get('摘要'),
    tags: get('标签'),
  };
}

// ── 主流程 ────────────────────────────────────────────────────────────

function main() {
  const now = new Date();
  const timestamp = now.toLocaleString('zh-CN');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  竞品文章自动抓取');
  console.log(`  ${timestamp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const urls = loadUrls();
  if (urls.length === 0) {
    console.log('⚠️  URL 列表为空');
    console.log(`   请编辑: ${URLS_FILE}`);
    console.log('   每行一个 URL，# 开头为注释\n');
    console.log('按任意键退出...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return;
  }

  console.log(`📋 待抓取: ${urls.length} 条\n`);

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[${i + 1}/${urls.length}] ${url}`);

    const { success, output, error } = scrapeOne(url);
    const analysis = parseAnalysis(output);

    if (success && analysis) {
      console.log(`  ✅ ${analysis.title}`);
      console.log(`     平台: ${analysis.platform} | 标签: ${analysis.tags}`);
      results.push({ url, success: true, ...analysis });
    } else if (success) {
      console.log(`  ✅ 抓取成功（无法解析分析数据）`);
      results.push({ url, success: true, title: '(解析失败)', platform: '', summary: '', tags: '' });
    } else {
      const errMsg = error?.includes('timeout') ? '超时' : (error || '未知错误');
      console.log(`  ❌ 失败: ${errMsg.slice(0, 80)}`);
      results.push({ url, success: false, error: errMsg });
    }
    console.log('');
  }

  // ── 汇总 ──────────────────────────────────────────────────────────

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📊 抓取汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  总计: ${urls.length}`);
  console.log(`  成功: ${succeeded.length}`);
  console.log(`  失败: ${failed.length}`);
  console.log(`  已推送飞书: ${succeeded.length} 条`);
  console.log('');

  if (succeeded.length > 0) {
    console.log('  ✅ 成功列表:');
    for (const r of succeeded) {
      console.log(`     ${r.title || r.url}`);
    }
    console.log('');
  }

  if (failed.length > 0) {
    console.log('  ❌ 失败列表:');
    for (const r of failed) {
      console.log(`     ${r.url}`);
      console.log(`     原因: ${(r.error || '').slice(0, 60)}`);
    }
    console.log('');
  }

  // ── 写入日志 ──────────────────────────────────────────────────────

  const logDir = dirname(LOG_FILE);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const logLines = [
    `抓取时间: ${timestamp}`,
    `总计: ${urls.length} | 成功: ${succeeded.length} | 失败: ${failed.length}`,
    '',
    '--- 成功 ---',
    ...succeeded.map(r => `  ${r.title || r.url} [${r.platform}] ${r.tags}`),
    '',
    '--- 失败 ---',
    ...failed.map(r => `  ${r.url} — ${r.error || '未知'}`),
    '',
    '=== END ===',
    '',
  ];
  writeFileSync(LOG_FILE, logLines.join('\n'), { flag: 'a', encoding: 'utf-8' });

  console.log(`📝 日志已写入: ${LOG_FILE}`);
  console.log('\n按任意键退出...');

  // 等待按键后退出
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
}

main();

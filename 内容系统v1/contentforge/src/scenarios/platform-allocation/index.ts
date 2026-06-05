import chalk from 'chalk';
import { loadIndex } from '../article/index.js';

export async function analyzePlatformAllocation(): Promise<void> {
  const index = await loadIndex();
  if (index.records.length === 0) {
    console.log(chalk.yellow('  索引为空，先运行 article index --rebuild\n'));
    return;
  }

  const byPlatform = { wechat: 0, xiaohongshu: 0, douyin: 0 };
  const avgScore = { wechat: 0, xiaohongshu: 0, douyin: 0 };
  const countScore = { wechat: 0, xiaohongshu: 0, douyin: 0 };

  for (const rec of index.records) {
    byPlatform[rec.platform]++;
    if (rec.reviewScore !== null) {
      avgScore[rec.platform] += rec.reviewScore;
      countScore[rec.platform]++;
    }
  }

  const total = index.records.length;
  const labels: Record<string, string> = {
    wechat: '公众号',
    xiaohongshu: '小红书',
    douyin: '抖音',
  };

  console.log(chalk.bold('\n🎯 平台配比分析\n'));

  console.log(chalk.gray('  当前产出分布:'));
  for (const [p, count] of Object.entries(byPlatform)) {
    const pct = ((count / total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round((count / total) * 30));
    const label = labels[p] ?? p;
    console.log(`    ${label}: ${chalk.cyan(pct.padStart(3) + '%')} ${chalk.gray(bar)} (${count}篇)`);
  }
  console.log('');

  console.log(chalk.gray('  平均评分:'));
  for (const [p, sum] of Object.entries(avgScore)) {
    const label = labels[p as keyof typeof labels] ?? p;
    if ((countScore as Record<string, number>)[p] > 0) {
      const avg = (sum / (countScore as Record<string, number>)[p]).toFixed(1);
      console.log(`    ${label}: ${chalk.cyan(avg.padStart(5))} (${(countScore as Record<string, number>)[p]}篇评分)`);
    } else {
      console.log(`    ${label}: ${chalk.gray('无评分数据')}`);
    }
  }
  console.log('');

  // Simple suggestions based on data
  const xhsCount = byPlatform.xiaohongshu;
  const douyinCount = byPlatform.douyin;
  const wechatCount = byPlatform.wechat;

  console.log(chalk.bold('  💡 配比建议:'));
  if (xhsCount < 10) {
    console.log(`    • 小红书产出偏少 (${xhsCount}篇)，建议补充 5-10 篇`);
  }
  if (douyinCount < 10) {
    console.log(`    • 抖音产出偏少 (${douyinCount}篇)，建议补充 3-5 篇`);
  }
  if (xhsCount > 0 && douyinCount > 0) {
    console.log(`    • 当前配比: 公众号${wechatCount}/小红书${xhsCount}/抖音${douyinCount}`);
  }
  console.log(chalk.gray('\n  提示: 飞书反馈数据接入后可获得更精准的配比建议\n'));
  console.log(chalk.gray('  相关: learn --feedback 录入发布后的真实互动数据\n'));
}
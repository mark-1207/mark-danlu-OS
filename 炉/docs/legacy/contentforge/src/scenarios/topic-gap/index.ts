import chalk from 'chalk';
import { loadIndex } from '../article/index.js';
import { getObsidianReader } from '../../io/obsidian/reader.js';
import { getCachedConfig } from '../../config/loader.js';

export async function analyzeTopicGap(): Promise<void> {
  const index = await loadIndex();
  if (index.records.length === 0) {
    console.log(chalk.yellow('  索引为空，先运行 article index --rebuild\n'));
    return;
  }

  // Count by platform
  const byPlatform = { wechat: 0, xiaohongshu: 0, douyin: 0 };
  const byKeyword = new Map<string, number>();

  for (const rec of index.records) {
    byPlatform[rec.platform]++;
    // Simple word extraction for topic counting
    const words = rec.keyword.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      byKeyword.set(word, (byKeyword.get(word) ?? 0) + 1);
    }
  }

  console.log(chalk.bold('\n📊 选题缺口分析\n'));

  // Platform coverage
  console.log(chalk.gray('  平台覆盖:'));
  for (const [p, count] of Object.entries(byPlatform)) {
    const label = p === 'wechat' ? '公众号' : p === 'xiaohongshu' ? '小红书' : '抖音';
    const bar = '●'.repeat(Math.min(count, 20));
    const note =
      count < 10 ? chalk.yellow(' ← 建议补充') : count < 20 ? chalk.gray(' ← 可提升') : chalk.green(' ← 充足');
    console.log(`    ${label}: ${chalk.cyan(count.toString().padStart(3))} ${chalk.gray(bar)} ${note}`);
  }
  console.log('');

  // Obsidian material gaps
  const config = getCachedConfig();
  const obsidianConfig = config.obsidian;
  if (obsidianConfig?.vaultPath) {
    try {
      const reader = getObsidianReader(obsidianConfig.vaultPath, obsidianConfig.readDirs);
      await reader.load();

      const cardCount = reader.count;
      const indexedTopics = new Set(index.records.map((r) => r.keyword.split(' ')[0]).filter(Boolean));
      const unusedTopics: string[] = [];

      // Sample some cards not mentioned in existing articles
      const allCards = reader.query({});
      for (const card of allCards.slice(0, 20)) {
        if (!indexedTopics.has(card.name)) {
          unusedTopics.push(card.name);
        }
      }

      if (unusedTopics.length > 0) {
        console.log(chalk.gray('  素材空白（Obsidian 有素材但未产出）:'));
        for (const topic of unusedTopics.slice(0, 5)) {
          console.log(`    • ${chalk.yellow(topic)} ${chalk.gray('← 建议写入')}`);
        }
        console.log('');
      }

      console.log(chalk.gray(`  知识库卡片: ${chalk.cyan(cardCount)} 张`));
    } catch (err) {
      console.log(chalk.gray('  知识库: 无法读取\n'));
    }
  }

  // Hot topics from index (top keywords)
  if (byKeyword.size > 0) {
    const topKeywords = [...byKeyword.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
    console.log(chalk.gray('  高频主题:'));
    for (const { word, count } of topKeywords) {
      console.log(`    ${word} (${count}篇)`);
    }
    console.log('');
  }

  console.log(chalk.gray('  提示: 运行 topic-engine fetch 查看热点选题\n'));
}
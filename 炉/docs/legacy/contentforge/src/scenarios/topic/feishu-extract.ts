import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getCachedConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import { readFeishuRecords, updateFeishuRecordStatus } from './feishu-sync.js';
import { extractSentenceFragments, extractParagraphFragments } from './extractor.js';
import type { CompetitorArticle, FeishuRecord } from './types.js';

/**
 * Convert a FeishuRecord to CompetitorArticle (for the extractor).
 */
function recordToArticle(record: FeishuRecord): CompetitorArticle {
  return {
    id: record.record_id,
    title: record.fields.原文标题,
    url: record.fields.原始链接,
    platform: record.fields.平台,
    interactionData: JSON.stringify({
      阅读数: record.fields.阅读数,
      点赞数: record.fields.点赞数,
      评论数: record.fields.评论数,
      转发数: record.fields.转发数,
      收藏数: record.fields.收藏数,
    }),
    summary: record.fields.内容摘要,
    viralStructure: record.fields.爆款结构,
    topicAngle: record.fields.选题角度,
    tags: record.fields.标签 ?? [],
    source: record.fields.来源类型,
    isFavorite: record.fields.收藏,
    status: 'analyzed',
    crawledAt: record.fields.抓取时间,
    content: record.fields.原文,
  };
}

/**
 * Convert a sentence fragment to Obsidian atom card markdown.
 */
function sentenceToAtomCard(
  fragment: { type: string; text: string; structure: string; tags: string[] },
  sourceTitle: string,
  sourceUrl: string,
): { filename: string; content: string } {
  const now = new Date().toISOString().slice(0, 10);
  const name = `${fragment.type}-${fragment.text.slice(0, 20).replace(/[\n\r]/g, '').replace(/[\\/:*?"<>|]/g, '_')}`;

  const frontmatter = [
    '---',
    'type: atom',
    `subtype: ${fragment.type}`,
    'status: active',
    `topics: [${fragment.tags.join(', ')}]`,
    'quality_score: 7',
    'usage_count: 0',
    `source_note: "${sourceTitle}"`,
    `source_url: "${sourceUrl}"`,
    `created: ${now}`,
    `updated: ${now}`,
    '---',
  ].join('\n');

  const body = [
    `# ${fragment.text.slice(0, 50)}`,
    '',
    '## 原子内容',
    `> ${fragment.text}`,
    '',
    '## 结构特征',
    fragment.structure,
    '',
    '## 适用场景',
    `- 适用于${fragment.type === 'hook' ? '文章开头' : fragment.type === 'cta' ? '结尾号召' : '段落衔接'}场景`,
    '',
    '## 来源',
    `- 竞品文章：${sourceTitle}`,
  ].join('\n');

  return { filename: `${name}.md`, content: `${frontmatter}\n\n${body}\n` };
}

/**
 * Convert a paragraph fragment to Obsidian atom card markdown.
 */
function paragraphToAtomCard(
  fragment: { type: string; text: string; structure: string; tags: string[] },
  sourceTitle: string,
  sourceUrl: string,
): { filename: string; content: string } {
  const now = new Date().toISOString().slice(0, 10);
  const name = `${fragment.type}-${fragment.text.slice(0, 20).replace(/[\n\r]/g, '').replace(/[\\/:*?"<>|]/g, '_')}`;

  const frontmatter = [
    '---',
    'type: atom',
    `subtype: ${fragment.type}`,
    'status: active',
    `topics: [${fragment.tags.join(', ')}]`,
    'quality_score: 7',
    'usage_count: 0',
    `source_note: "${sourceTitle}"`,
    `source_url: "${sourceUrl}"`,
    `created: ${now}`,
    `updated: ${now}`,
    '---',
  ].join('\n');

  const body = [
    `# ${fragment.type}段落`,
    '',
    '## 原子内容',
    '',
    fragment.text,
    '',
    '## 结构特征',
    fragment.structure,
    '',
    '## 来源',
    `- 竞品文章：${sourceTitle}`,
  ].join('\n');

  return { filename: `${name}.md`, content: `${frontmatter}\n\n${body}\n` };
}

/**
 * Write a fallback atom card when no fragments were extracted.
 * Uses the analyzed fields (title + topic angle + tags) as the card content.
 */
function writeFallbackAtomCard(
  record: FeishuRecord,
): { filename: string; content: string } {
  const title = record.fields.原文标题;
  const topicAngle = record.fields.选题角度 ?? '';
  const tags = record.fields.标签 ?? [];
  const summary = record.fields.内容摘要 ?? '';
  const sourceUrl = record.fields.原始链接;
  const now = new Date().toISOString().slice(0, 10);

  const name = `fallback-${title.slice(0, 20).replace(/[\n\r]/g, '').replace(/[\\/:*?"<>|]/g, '_')}`;

  const frontmatter = [
    '---',
    'type: atom',
    'subtype: fallback',
    'status: active',
    `topics: [${tags.join(', ')}]`,
    'quality_score: 6',
    'usage_count: 0',
    `source_note: "${title}"`,
    `source_url: "${sourceUrl}"`,
    `created: ${now}`,
    `updated: ${now}`,
    '---',
  ].join('\n');

  const body = [
    `# ${title}`,
    '',
    '## 选题角度',
    topicAngle || '（未提取到有效角度）',
    '',
    '## 内容摘要',
    summary || '（无摘要）',
    '',
    '## 标签',
    tags.length > 0 ? tags.join('、') : '（无标签）',
    '',
    '## 说明',
    '⚠️ 碎片提取为 0，以此分析结果字段代替写入，仅作素材积累',
  ].join('\n');

  return { filename: `${name}.md`, content: `${frontmatter}\n\n${body}\n` };
}

/**
 * Extract fragments from analyzed feishu records and write to Obsidian.
 */
export async function runFragmentExtraction(): Promise<{
  total: number;
  extracted: number;
  skipped: number;
  errors: number;
  cardsWritten: number;
}> {
  const config = getCachedConfig();
  const obsidianConfig = config.obsidian;
  if (!obsidianConfig?.vaultPath) {
    throw new Error('obsidian.vaultPath not configured');
  }

  const atomDir = path.join(obsidianConfig.vaultPath, '40_知识库', '原子库');
  await fs.mkdir(atomDir, { recursive: true });

  const records = await readFeishuRecords();
  const analyzed = records.filter((r) => r.fields.状态 === 'analyzed');

  logger.info(`[feishu-extract] ${records.length} total, ${analyzed.length} analyzed`);

  let extracted = 0;
  let skipped = 0;
  let errors = 0;
  let cardsWritten = 0;

  for (const record of analyzed) {
    const title = record.fields.原文标题;
    const content = record.fields.原文;

    if (!content || content.trim().length < 200) {
      logger.warn(`[feishu-extract] skipping "${title}" — content too short`);
      skipped++;
      continue;
    }

    try {
      logger.info(`[feishu-extract] extracting: "${title}"`);
      const article = recordToArticle(record);

      // Extract sentence fragments
      const sentences = await extractSentenceFragments(article, content);
      // Extract paragraph fragments
      const paragraphs = await extractParagraphFragments(article, content);

      // Write atom cards to Obsidian
      for (const s of sentences) {
        const { filename, content: cardContent } = sentenceToAtomCard(s, title, record.fields.原始链接);
        await fs.writeFile(path.join(atomDir, filename), cardContent, 'utf-8');
        cardsWritten++;
      }

      for (const p of paragraphs) {
        const { filename, content: cardContent } = paragraphToAtomCard(p, title, record.fields.原始链接);
        await fs.writeFile(path.join(atomDir, filename), cardContent, 'utf-8');
        cardsWritten++;
      }

      const totalFragments = sentences.length + paragraphs.length;
      if (totalFragments === 0) {
        // Fallback: write a card using analyzed fields (title + angle + tags)
        const { filename, content: cardContent } = writeFallbackAtomCard(record);
        await fs.writeFile(path.join(atomDir, filename), cardContent, 'utf-8');
        cardsWritten++;
        logger.info(`[feishu-extract] ⚠️ "${title}" — no fragments, wrote fallback card`);
      } else {
        // Write atom cards to Obsidian
        for (const s of sentences) {
          const { filename, content: cardContent } = sentenceToAtomCard(s, title, record.fields.原始链接);
          await fs.writeFile(path.join(atomDir, filename), cardContent, 'utf-8');
          cardsWritten++;
        }

        for (const p of paragraphs) {
          const { filename, content: cardContent } = paragraphToAtomCard(p, title, record.fields.原始链接);
          await fs.writeFile(path.join(atomDir, filename), cardContent, 'utf-8');
          cardsWritten++;
        }

        // Update feishu status only when fragments were actually extracted
        await updateFeishuRecordStatus(record.record_id, 'stored', {
          '碎片提取时间': new Date().toISOString(),
        });

        logger.info(`[feishu-extract] ✅ "${title}" — ${sentences.length} sentences + ${paragraphs.length} paragraphs`);
      }
    } catch (err) {
      logger.error(`[feishu-extract] ❌ "${title}": ${String(err)}`);
      errors++;
    }
  }

  return { total: records.length, extracted, skipped, errors, cardsWritten };
}

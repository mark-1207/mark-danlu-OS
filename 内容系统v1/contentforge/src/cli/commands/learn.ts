import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig } from '../../config/loader.js';
import { runFragmentAnalysis } from '../../fragment-library/analyzer.js';
import { getFragmentStore } from '../../fragment-library/fragment-store.js';
import { logger } from '../../utils/logger.js';

export async function runLearn(options: {
  corpusDir?: string;
  list?: boolean;
  listBySource?: boolean;
  stats?: boolean;
  delete?: string;
  clearType?: string;
  inspect?: string;
  decay?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  const baseDir = path.resolve(options.corpusDir ?? config.output?.dir ?? './output');
  const resolvedCorpusDir = path.join(baseDir, 'corpus');

  // Ensure corpus dir exists
  try {
    await fs.access(resolvedCorpusDir);
  } catch {
    console.log(chalk.yellow('corpus 目录不存在，请先运行 create/recreate 生成内容。'));
    return;
  }

  const store = getFragmentStore(resolvedCorpusDir);
  await store.ensureLoaded();

  // ── --stats ──────────────────────────────────────────────────────────
  if (options.stats) {
    const stats = store.getStats();
    const profile = store.getStyleProfile();
    console.log(chalk.bold('\n📊 碎片库统计\n'));
    console.log(`句式碎片: ${stats.totalSentenceFragments} 个`);
    console.log(`段落碎片: ${stats.totalParagraphFragments} 个`);
    console.log(`分析记录: ${stats.manifestEntries} 条`);
    console.log(`\n来源分布:`);
    console.log(`  来自我的改写 (edited): ${stats.bySource.edited} 个`);
    console.log(`  来自外部参考 (external): ${stats.bySource.external} 个`);
    console.log(`\n各类型数量:`);
    for (const [type, count] of Object.entries(stats.byType).sort()) {
      console.log(`  ${type}: ${count}`);
    }
    console.log(`\nDecay 状态:`);
    console.log(`  active: ${stats.byDecay.active} 个`);
    console.log(`  dormant: ${stats.byDecay.dormant} 个`);
    console.log(`  expired: ${stats.byDecay.expired} 个`);
    console.log(`\n风格画像:`);
    console.log(`  情绪基调: ${profile.emotionalTone || '未设置'}`);
    console.log(`  结构偏好: ${profile.structuralPreference || '未设置'}`);
    console.log(`  已分析 edited: ${profile.totalEdited} 篇`);
    console.log(`  已分析 external: ${profile.totalExternal} 篇`);
    console.log('');
    return;
  }

  // ── --decay ─────────────────────────────────────────────────────────
  if (options.decay) {
    const before = store.getDecayStats();
    const { dormant, expired } = store.decayFragments();
    await store.save();
    console.log(chalk.bold('\n🔄 碎片 decay 扫描完成\n'));
    console.log(`扫描前状态:`);
    console.log(`  active: ${before.active} 个`);
    console.log(`  dormant: ${before.dormant} 个`);
    console.log(`  expired: ${before.expired} 个`);
    console.log(`\n本次更新:`);
    console.log(`  新增 dormant: ${dormant} 个`);
    console.log(`  新增 expired: ${expired} 个`);
    const after = store.getDecayStats();
    console.log(`\n扫描后状态:`);
    console.log(`  active: ${after.active} 个`);
    console.log(`  dormant: ${after.dormant} 个`);
    console.log(`  expired: ${after.expired} 个`);
    console.log('');
    return;
  }

  // ── --delete <id> ──────────────────────────────────────────────────
  if (options.delete) {
    const id = options.delete;
    const deleted = store.deleteById(id);
    if (deleted) {
      await store.save();
      console.log(chalk.green(`✅ 已删除碎片 ${id} (类型: ${deleted})`));
    } else {
      console.log(chalk.red(`错误: 未找到碎片 ${id}`));
    }
    return;
  }

  // ── --clear-type <type> ────────────────────────────────────────────
  if (options.clearType) {
    const type = options.clearType as Parameters<typeof store.clearSentencesByType>[0];
    const validSentenceTypes = ['hook', 'transition', 'cta', 'power-line', 'rhetorical-question', 'data-opener'];
    const validParagraphTypes = ['opening', 'argument', 'emotional-peak', 'closing', 'case-study'];
    if (validSentenceTypes.includes(type)) {
      store.clearSentencesByType(type as Parameters<typeof store.clearSentencesByType>[0]);
      await store.save();
      console.log(chalk.green(`✅ 已清空句式碎片: ${type}`));
    } else if (validParagraphTypes.includes(type)) {
      store.clearParagraphsByType(type as Parameters<typeof store.clearParagraphsByType>[0]);
      await store.save();
      console.log(chalk.green(`✅ 已清空段落碎片: ${type}`));
    } else {
      console.log(chalk.red(`错误: 无效类型 ${type}`));
      console.log(`有效句式类型: ${validSentenceTypes.join(', ')}`);
      console.log(`有效段落类型: ${validParagraphTypes.join(', ')}`);
    }
    return;
  }

  // ── --inspect <runId> ──────────────────────────────────────────────
  if (options.inspect) {
    const runId = options.inspect;
    const manifest = store.getManifest();
    const entries = manifest.filter(e => e.runId === runId || e.sourcePaths.some(p => p.includes(runId)));
    if (entries.length === 0) {
      console.log(chalk.yellow(`未找到与 "${runId}" 相关的分析记录。`));
      console.log(chalk.gray('提示: manifest 缺失时无法追踪旧碎片的来源，请先运行 learn 重新分析。\n'));
      return;
    }
    for (const entry of entries) {
      console.log(chalk.bold(`\n🔍 manifestId: ${entry.manifestId}`));
      console.log(`  分析时间: ${entry.analyzedAt}`);
      console.log(`  来源类型: ${entry.sourceType}`);
      console.log(`  关联文件:`);
      for (const p of entry.sourcePaths) {
        console.log(`    - ${path.basename(p)}`);
      }
      if (entry.runId) console.log(`  runId: ${entry.runId}`);
      console.log(`  句式碎片: ${entry.sentenceCount} 个`);
      console.log(`  段落碎片: ${entry.paragraphCount} 个`);
      console.log(`  碎片 IDs: ${entry.fragmentIds.join(', ')}`);
    }
    console.log('');
    return;
  }

  // ── --list ─────────────────────────────────────────────────────────
  if (options.list) {
    const bySource = options.listBySource;
    const sentences = store.getAllSentences();
    const paragraphs = store.getAllParagraphs();
    const all = [...sentences, ...paragraphs];

    if (all.length === 0) {
      console.log(chalk.yellow('\n碎片库为空，请先放入文章并运行 learn。\n'));
      return;
    }

    if (bySource) {
      const editedFrags = all.filter(f => f.source === 'edited');
      const externalFrags = all.filter(f => f.source === 'external');
      console.log(chalk.bold(`\n📚 碎片库 (共 ${all.length} 个碎片)\n`));
      if (editedFrags.length > 0) {
        console.log(chalk.bold(`来自我的改写 (edited) — ${editedFrags.length} 个`));
        for (const f of editedFrags) {
          const shortText = f.text.slice(0, 40).replace(/\n/g, ' ');
          const id = f.id;
          const type = 'sourceFile' in f ? '句式' : '段落';
          const fragType = f.type;
          const src = f.sourceFile ?? '';
          console.log(`  [${id}] ${fragType}: "${shortText}${shortText.length >= 40 ? '...' : ''}"`);
          console.log(chalk.gray(`    来源: ${src}`));
        }
        console.log('');
      }
      if (externalFrags.length > 0) {
        console.log(chalk.bold(`\n来自外部参考 (external) — ${externalFrags.length} 个`));
        for (const f of externalFrags) {
          const shortText = f.text.slice(0, 40).replace(/\n/g, ' ');
          const id = f.id;
          const fragType = f.type;
          const src = f.sourceFile ?? '';
          console.log(`  [${id}] ${fragType}: "${shortText}${shortText.length >= 40 ? '...' : ''}"`);
          console.log(chalk.gray(`    来源: ${src}`));
        }
        console.log('');
      }
    } else {
      // Group by type
      const sentenceTypes = ['hook', 'transition', 'cta', 'power-line', 'rhetorical-question', 'data-opener'];
      const paragraphTypes = ['opening', 'argument', 'emotional-peak', 'closing', 'case-study'];

      console.log(chalk.bold(`\n📚 碎片库 (共 ${all.length} 个碎片)\n`));
      console.log(chalk.bold('句式碎片'));
      for (const t of sentenceTypes) {
        const frags = sentences.filter(f => f.type === t);
        if (frags.length === 0) continue;
        console.log(`  ${t} (${frags.length}):`);
        for (const f of frags) {
          const shortText = f.text.slice(0, 40).replace(/\n/g, ' ');
          const src = f.sourceFile ?? 'unknown';
          const tag = f.source === 'edited' ? '[edited]' : '[external]';
          console.log(`    [${f.id}] ${tag} "${shortText}${shortText.length >= 40 ? '...' : ''}"`);
          console.log(chalk.gray(`      来源: ${path.basename(src)}`));
        }
      }

      console.log(chalk.bold('\n段落碎片'));
      for (const t of paragraphTypes) {
        const frags = paragraphs.filter(f => f.type === t);
        if (frags.length === 0) continue;
        console.log(`  ${t} (${frags.length}):`);
        for (const f of frags) {
          const shortContent = f.content.slice(0, 50).replace(/\n/g, ' ');
          const src = f.sourceFile ?? 'unknown';
          const tag = f.source === 'edited' ? '[edited]' : '[external]';
          console.log(`    [${f.id}] ${tag} "${shortContent}${shortContent.length >= 50 ? '...' : ''}"`);
          console.log(chalk.gray(`      来源: ${path.basename(src)}`));
        }
      }
      console.log('');
    }
    return;
  }

  // ── Default: run analysis ────────────────────────────────────────────
  const profile = store.getStyleProfile();
  const sentences = store.getAllSentences();
  const paragraphs = store.getAllParagraphs();

  console.log(chalk.bold('\n📚 碎片库当前状态\n'));
  console.log(`句式碎片: ${sentences.length} 个`);
  console.log(`段落碎片: ${paragraphs.length} 个`);
  console.log(`分析记录: ${store.getManifest().length} 条`);
  console.log(`分析文章: ${profile.totalEdited} 篇 edited + ${profile.totalExternal} 篇 external`);
  console.log(`风格基调: ${profile.emotionalTone || '未设置'}`);

  console.log(chalk.bold('\n🔍 开始增量分析...\n'));

  const result = await runFragmentAnalysis(resolvedCorpusDir);

  console.log(chalk.green('\n✅ 分析完成\n'));
  console.log(`分析了 ${result.editedAnalyzed} 个 edited 配对`);
  console.log(`分析了 ${result.externalAnalyzed} 个 external 文章`);
  console.log(`新增碎片: ${result.fragmentsAdded} 个`);

  const updatedSentences = store.getAllSentences();
  const updatedParagraphs = store.getAllParagraphs();
  console.log(`\n碎片库最新统计：`);
  console.log(`  句式碎片: ${updatedSentences.length} 个`);
  console.log(`  段落碎片: ${updatedParagraphs.length} 个`);
}

export function registerLearnCommand(program: Command): void {
  program
    .command('learn')
    .description('碎片库管理：分析增量 / --list / --stats / --delete / --inspect / --decay')
    .option('-c, --corpus-dir <path>', 'corpus 目录路径（默认: output/corpus）')
    .option('--list', '列出所有碎片（默认按 type 分组）')
    .option('--by-source', '按来源（edited/external）分组展示，需配合 --list 使用')
    .option('--stats', '展示碎片库统计信息（含 decay 状态）')
    .option('--delete <id>', '按 ID 删除碎片')
    .option('--clear-type <type>', '清空指定类型的所有碎片（句式: hook/transition/cta/power-line/rhetorical-question/data-opener，段落: opening/argument/emotional-peak/closing/case-study）')
    .option('--inspect <runId>', '查看某个 runId 或文件的碎片来源详情')
    .option('--decay', '对碎片库执行 decay 扫描，更新老旧碎片状态')
    .action(async (opts) => {
      try {
        await runLearn({
          corpusDir: opts.corpusDir,
          list: opts.list,
          listBySource: opts.bySource,
          stats: opts.stats,
          delete: opts.delete,
          clearType: opts.clearType,
          inspect: opts.inspect,
          decay: opts.decay,
        });
      } catch (error) {
        logger.error('learn command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

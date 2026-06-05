import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { loadConfig, setCachedConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import { runFragmentAnalysis } from '../../fragment-library/analyzer.js';
import { getFragmentStore } from '../../fragment-library/fragment-store.js';
import { logger } from '../../utils/logger.js';
import { readFeedbackRecords } from '../../scenarios/feedback/feishu-feedback.js';
import { buildFeedbackSignal, computeFeedbackStats, compareWithCompetitor } from '../../scenarios/feedback/analyzer.js';
import { readFeishuRecords } from '../../scenarios/topic/feishu-sync.js';
import { backfillCompetitorAnalysis } from '../../scenarios/topic/backfill-analysis.js';
import { analyzePatterns } from '../../scenarios/learning/pattern-analyzer.js';
import { updateCreativePreferences, loadCreativePreferences, loadCreativePreferencesFromFeishu, formatPreferencesReport } from '../../scenarios/learning/creative-preferences.js';
import { loadOverrides, saveOverrides } from '../../scenarios/learning/preference-override.js';
import { isTerminalInteractive } from '../ui/interactive.js';
import type { RevisionManifest } from '../../scenarios/revision/types.js';
import type { Platform } from '../../scenarios/learning/types.js';
import { writeFeedbackRecord } from '../../scenarios/feedback/feishu-feedback.js';

export async function runLearn(options: {
  corpusDir?: string;
  list?: boolean;
  listBySource?: boolean;
  stats?: boolean;
  delete?: string;
  clearType?: string;
  inspect?: string;
  decay?: boolean;
  includeCompetitor?: boolean;
  analyze?: boolean;
  extractFragments?: boolean;
  feedbackSummary?: boolean;
  feedbackCompare?: boolean;
  backfillAnalysis?: boolean;
  updatePreferences?: boolean;
  showPreferences?: boolean;
  showPreferencesJson?: boolean;
  dashboard?: boolean;
  viralLibrary?: boolean;
  viralLibraryShow?: string;
  feedbackEntry?: {
    runId: string;
    likes: number;
    comments: number;
    shares: number;
    reads?: number;
    platform: Platform;
  };
}): Promise<void> {
  const config = await loadConfig();
  setCachedConfig(config);

  // Register LLM providers (needed for --analyze)
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

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

  // ── --dashboard (创作偏好交互面板) ──────────────────────────
  if (options.dashboard) {
    await loadCreativePreferencesFromFeishu();
    const prefs = loadCreativePreferences();
    const overrides = await loadOverrides();

    if (isTerminalInteractive()) {
      const { showPreferenceDashboard } = await import('../../cli/ui/preference-dashboard.js');
      const result = await showPreferenceDashboard(prefs, overrides);
      await saveOverrides(result.overrides);
      console.log(chalk.green('\n✅ 偏好覆盖已保存\n'));
      // Show final prompt previews
      for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
        const prompt = (await import('../../scenarios/learning/creative-preferences.js')).buildPreferencePrompt(platform);
        console.log(chalk.bold(`【${platform}】注入预览:`) + (prompt || chalk.gray('（无偏好注入）')));
      }
      console.log('');
    } else {
      const { formatDashboardNonTty } = await import('../../cli/ui/preference-dashboard.js');
      console.log(formatDashboardNonTty(prefs, overrides));
    }
    return;
  }

  // ── --show-preferences ─────────────────────────────────────────
  if (options.showPreferences) {
    await loadCreativePreferencesFromFeishu(); // ensure cache populated
    const prefs = loadCreativePreferences();
    const report = formatPreferencesReport(prefs, options.showPreferencesJson);
    console.log(report);
    return;
  }

  // ── --viral-library ───────────────────────────────────────────
  if (options.viralLibrary) {
    const { loadViralGenomeFromFeishu } = await import('../../scenarios/feedback/feishu-viral-library.js');
    const { readFeishuRecords } = await import('../../scenarios/topic/feishu-sync.js');

    console.log(chalk.bold('\n📚 爆款素材库\n'));

    // List all records (read all from Feishu library table)
    // For now, show a message that full list requires FEISHU_VIRAL_LIBRARY credentials
    console.log('使用 --viral-library show <record_id> 查看详情\n');
    return;
  }

  // ── --viral-library show <record_id> ──────────────────────────
  if (options.viralLibraryShow) {
    const { loadViralGenomeFromFeishu } = await import('../../scenarios/feedback/feishu-viral-library.js');
    const recordId = options.viralLibraryShow;
    console.log(chalk.bold(`\n📚 ViralGenome: ${recordId}\n`));

    try {
      const genome = await loadViralGenomeFromFeishu(recordId);
      console.log(`painPoint: ${genome.topicStrategy.painPoint}`);
      console.log(`whyItWorks: ${genome.topicStrategy.whyItWorks}`);
      console.log(`targetAudience: ${genome.topicStrategy.targetAudience}`);
      console.log(`\n叙事结构 (${genome.narrativeStructure.length} 段):`);
      for (const s of genome.narrativeStructure) {
        console.log(`  ${s.sectionIndex + 1}. ${s.purpose} — ${s.argumentativePath}`);
      }
      console.log(`\n钩子: ${genome.hookTechnique.type} / ${genome.hookTechnique.template}`);
      console.log(`\n高光表达 (${genome.forbiddenExpressions.length}):`);
      for (const f of genome.forbiddenExpressions) {
        console.log(`  - "${f.text}" (${f.reason})`);
      }
      console.log(`\n案例 (${genome.caseStudies.length}):`);
      for (const c of genome.caseStudies) {
        console.log(`  - ${c.protagonist}: ${c.story}`);
      }
      console.log(`\n数据点 (${genome.keyDataPoints.length}):`);
      for (const d of genome.keyDataPoints) {
        console.log(`  - ${d.data} (${d.context})`);
      }
    } catch (err) {
      console.log(chalk.red(`错误: ${err}`));
    }
    return;
  }

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
    const { buildDecayReportData, renderDecayReport } = await import('../../fragment-library/decay-report.js');
    const before = store.getDecayStats();
    const { dormant, expired } = store.decayFragments();
    await store.save();
    const after = store.getDecayStats();
    const allSentences = store.getAllSentences();
    const allParagraphs = store.getAllParagraphs();
    const reportData = buildDecayReportData(after, allSentences, allParagraphs);
    renderDecayReport(reportData, before);
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
          const rawText = 'text' in f ? f.text : ('content' in f ? f.content : '');
          const shortText = rawText.slice(0, 40).replace(/\n/g, ' ');
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
          const rawText = 'text' in f ? f.text : ('content' in f ? f.content : '');
          const shortText = rawText.slice(0, 40).replace(/\n/g, ' ');
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

  // ── --extract-fragments (碎片提取到 Obsidian) ─────────────────────
  if (options.extractFragments) {
    const { runFragmentExtraction } = await import('../../scenarios/topic/feishu-extract.js');
    console.log(chalk.bold('\n🧩 碎片提取到 Obsidian\n'));
    const result = await runFragmentExtraction();
    console.log(chalk.green(`\n✅ 提取完成`));
    console.log(`  总记录: ${result.total}`);
    console.log(`  已提取: ${result.extracted}`);
    console.log(`  跳过: ${result.skipped}`);
    console.log(`  失败: ${result.errors}`);
    console.log(`  写入原子卡: ${result.cardsWritten}`);
    return;
  }

  // ── --analyze (飞书 AI 分析) ──────────────────────────────────────
  if (options.analyze) {
    const { runFeishuAnalysis } = await import('../../scenarios/topic/feishu-analyze.js');
    console.log(chalk.bold('\n🔍 飞书竞品文章 AI 分析\n'));
    const result = await runFeishuAnalysis();
    console.log(chalk.green(`\n✅ 分析完成`));
    console.log(`  总记录: ${result.total}`);
    console.log(`  已分析: ${result.analyzed}`);
    console.log(`  跳过: ${result.skipped}`);
    console.log(`  失败: ${result.errors}`);
    return;
  }

  // ── --backfill-analysis ────────────────────────────────────────
  if (options.backfillAnalysis) {
    console.log(chalk.bold('\n🔄 竞品历史记录补填中...\n'));
    const result = await backfillCompetitorAnalysis();
    console.log(chalk.green(`\n✅ 补填完成\n`));
    console.log(`待补填: ${result.total} 条`);
    console.log(`已更新: ${result.updated} 条`);
    console.log(`跳过: ${result.skipped} 条`);
    console.log(`失败: ${result.errors} 条`);
    return;
  }

  // ── --include-competitor ────────────────────────────────────────
  if (options.includeCompetitor) {
    const { generateCompetitorStyleReport } = await import('../../scenarios/topic/competitor-style-report.js');
    console.log(chalk.bold('\n📊 竞品风格报告生成中...\n'));
    await generateCompetitorStyleReport();
    console.log(chalk.green('\n✅ 竞品风格报告已生成\n'));
    return;
  }

  // ── --feedback-summary ────────────────────────────────────────
  if (options.feedbackSummary) {
    const records = await readFeedbackRecords();
    const signal = buildFeedbackSignal(records);
    const stats = computeFeedbackStats(records);

    console.log(chalk.bold('\n📈 反馈数据分析报告\n'));
    console.log(`总文章数: ${stats.totalArticles}`);
    console.log(`平均阅读: ${stats.avgReads.toFixed(0)}`);
    console.log(`平均互动率: ${(stats.avgEngagement * 100).toFixed(2)}%`);
    console.log(chalk.bold('\n🏆 表现最佳\n'));
    if (signal.topPlatform) console.log(`平台: ${signal.topPlatform}`);
    console.log(`结构: ${signal.topStructures.join(' > ')}`);
    console.log(`调性: ${signal.topTones.join(' > ')}`);
    console.log(`角度: ${signal.topAngles.join(' > ')}`);

    if (signal.weakPatterns.length > 0) {
      console.log(chalk.bold('\n⚠️ 弱势模式\n'));
      for (const w of signal.weakPatterns) {
        console.log(`  ${w.recommendation}`);
      }
    }

    if (Object.keys(signal.platformDiff).length > 0) {
      console.log(chalk.bold('\n📱 平台差异\n'));
      for (const [p, eng] of Object.entries(signal.platformDiff)) {
        console.log(`  ${p}: ${(eng * 100).toFixed(2)}%`);
      }
    }

    console.log(chalk.green('\n✅ 反馈分析完成\n'));
    return;
  }

  // ── --feedback-compare ─────────────────────────────────────────
  if (options.feedbackCompare) {
    const myRecords = await readFeedbackRecords();
    const competitorRecords = await readFeishuRecords();
    const analyzed = competitorRecords.filter(r => r.fields.状态 === 'analyzed' || r.fields.状态 === 'stored');

    // Build competitor engagement map by tag (from structured number fields)
    const competitorEngByTag: Record<string, number> = {};
    for (const r of analyzed) {
      const reads = r.fields.阅读数 ?? 0;
      if (!reads) continue;
      const eng = ((r.fields.点赞数 ?? 0) + (r.fields.评论数 ?? 0) + (r.fields.转发数 ?? 0)) / reads;
      for (const tag of (r.fields.标签 ?? [])) {
        if (!competitorEngByTag[tag]) competitorEngByTag[tag] = 0;
        competitorEngByTag[tag] = Math.max(competitorEngByTag[tag], eng);
      }
    }

    const gaps = compareWithCompetitor(myRecords, competitorEngByTag);

    console.log(chalk.bold('\n🔍 我方 vs 竞品差距分析\n'));
    for (const g of gaps) {
      const icon = g.direction === 'mine_better' ? '✅' : g.direction === 'competitor_better' ? '❌' : '➖';
      console.log(`${icon} ${g.myTag} | 我: ${(g.myAvgEngagement * 100).toFixed(2)}% | 竞品: ${(g.competitorAvgEngagement * 100).toFixed(2)}%`);
      console.log(`   → ${g.recommendation}`);
    }
    console.log(chalk.green('\n✅ 差距分析完成\n'));
    return;
  }

  // ── --update-preferences ─────────────────────────────────────
  if (options.updatePreferences) {
    const outputDir = options.corpusDir ?? config.output?.dir ?? './output';
    const corpusDir = path.join(outputDir, 'corpus');

    // Load latest preferences from Feishu first
    await loadCreativePreferencesFromFeishu();

    // Collect all revision manifests
    const manifests: RevisionManifest[] = [];
    try {
      const revDir = path.join(outputDir);
      const entries = await fs.readdir(revDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('create_') && !entry.name.startsWith('recreate_')) continue;
        const manifestPath = path.join(revDir, entry.name, 'revisions', 'manifest.json');
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          manifests.push(JSON.parse(content));
        } catch { /* skip */ }
      }
    } catch { /* no revisions yet */ }

    const feedbackRecords = await readFeedbackRecords().catch(() => []);
    const competitorRecords = await readFeishuRecords().catch(() => []);
    const analyzedCompetitors = competitorRecords.filter(r => r.fields.状态 === 'analyzed' || r.fields.状态 === 'stored');

    console.log(chalk.bold('\n🧠 创作偏好更新中...\n'));
    console.log(`Revision manifests: ${manifests.length}`);
    console.log(`Feedback records: ${feedbackRecords.length}`);
    console.log(`Competitor records: ${analyzedCompetitors.length}`);

    const prefs = analyzePatterns(manifests, feedbackRecords, analyzedCompetitors);
    await updateCreativePreferences(prefs);

    console.log(chalk.bold('\n📊 当前创作偏好\n'));
    const current = loadCreativePreferences();
    for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
      const p = current[platform];
      console.log(`\n【${platform}】`);
      console.log(`  结构: ${p.structure.preference} (样本${p.structure.sampleSize}, 置信度 ${p.structure.confidence})`);
      console.log(`  调性: ${p.tone.preference} (样本${p.tone.sampleSize}, 置信度 ${p.tone.confidence})`);
    }
    console.log(chalk.green('\n✅ 创作偏好已更新\n'));
    return;
  }

  // ── --feedback (快捷录入反馈数据) ─────────────────────────────────
  if (options.feedbackEntry) {
    const { runId, likes, comments, shares, reads, platform } = options.feedbackEntry;

    // 1. Find manifest.json by runId under output/
    const outputDir = path.resolve(options.corpusDir ?? config.output?.dir ?? './output');
    let manifestPath: string | null = null;
    let manifestContent: object | null = null;

    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(outputDir, entry.name, 'manifest.json');
        try {
          const content = await fs.readFile(candidate, 'utf-8');
          const manifest = JSON.parse(content);
          if (manifest.runId === runId || entry.name.includes(runId)) {
            manifestPath = candidate;
            manifestContent = manifest;
            break;
          }
        } catch { /* skip */ }
      }
    } catch { /* output dir may not exist */ }

    if (!manifestContent) {
      console.log(chalk.red(`错误: 未找到 runId="${runId}" 对应的 manifest.json`));
      return;
    }

    // 2. Extract article title from manifest
    const title = (manifestContent as { title?: string }).title ?? runId;
    const articleId = runId;

    // 3. Compute engagement rate
    const engagementRate = (likes + comments + shares) / (reads || 1);

    // 4. Write to feedback table
    try {
      await writeFeedbackRecord({
        articleId,
        title,
        platform,
        reads: reads ?? 0,
        likes,
        comments,
        shares,
        notes: `快速录入 | engagement rate: ${(engagementRate * 100).toFixed(2)}%`,
      });
      console.log(chalk.green('\n✅ 反馈数据已写入飞书反馈表\n'));
      console.log(`  runId: ${runId}`);
      console.log(`  标题: ${title}`);
      console.log(`  平台: ${platform}`);
      console.log(`  阅读: ${reads ?? 0} | 点赞: ${likes} | 评论: ${comments} | 转发: ${shares}`);
      console.log(`  互动率: ${(engagementRate * 100).toFixed(2)}%\n`);
    } catch (err) {
      console.log(chalk.red(`错误: 写入飞书失败: ${err}`));
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
    .option('--include-competitor', '生成竞品风格报告（基于飞书竞品素材库 analyzed/stored 记录）')
    .option('--analyze', 'AI 分析飞书待分析记录（提取爆款结构/选题角度/标签）')
    .option('--extract-fragments', '从飞书已分析记录提取碎片写入 Obsidian 原子库')
    .option('--feedback-summary', '分析反馈数据，输出表现最佳的平台/结构/调性/角度')
    .option('--feedback-compare', '对比我方内容与竞品内容的标签级差距')
    .option('--backfill-analysis', '对竞品表已有记录补填叙事结构/情感调性/内容角度')
    .option('--update-preferences', '从 revision manifests + 反馈数据 + 竞品数据分析创作偏好并更新')
    .option('--dashboard', '交互式创作偏好面板（含临时覆盖功能）')
    .option('--show-preferences', '展示当前创作偏好（从飞书读取）')
    .option('--json', '输出原始 JSON 格式（配合 --show-preferences）')
    .option('--feedback', '快捷录入反馈数据（配合 --run-id/--likes/--comments/--shares/--reads/--platform）')
    .option('--run-id <id>', '关联的 run ID')
    .option('--likes <n>', '点赞数')
    .option('--comments <n>', '评论数')
    .option('--shares <n>', '转发数')
    .option('--reads <n>', '阅读数（可选）')
    .option('--platform <platform>', '平台 wechat/xiaohongshu/douyin')
    .option('--viral-library', '查看爆款素材库列表')
    .option('--viral-library-show <record_id>', '查看指定 ViralGenome 详情')
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
          includeCompetitor: opts.includeCompetitor,
          analyze: opts.analyze,
          extractFragments: opts.extractFragments,
          feedbackSummary: opts.feedbackSummary,
          feedbackCompare: opts.feedbackCompare,
          backfillAnalysis: opts.backfillAnalysis,
          updatePreferences: opts.updatePreferences,
          dashboard: opts.dashboard,
          showPreferences: opts.showPreferences,
          showPreferencesJson: opts.json,
          viralLibrary: opts.viralLibrary,
          viralLibraryShow: opts.viralLibraryShow,
          feedbackEntry: opts.feedback ? {
            runId: opts.runId,
            likes: Number(opts.likes) || 0,
            comments: Number(opts.comments) || 0,
            shares: Number(opts.shares) || 0,
            reads: opts.reads ? Number(opts.reads) : undefined,
            platform: opts.platform,
          } : undefined,
        });
      } catch (error) {
        logger.error('learn command failed', { error: String(error) });
        console.error(chalk.red(`错误: ${error}`));
        process.exit(1);
      }
    });
}

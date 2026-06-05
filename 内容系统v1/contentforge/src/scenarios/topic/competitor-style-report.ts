import fs from 'fs/promises';
import path from 'path';
import { fetchCompetitiveRecords } from './competitor-cache.js';
import { formatRecordsForPrompt } from './competitor-cache.js';
import { readFeishuRecords } from './feishu-sync.js';
import { llmFactory } from '../../llm/factory.js';
import { loadConfig, getCachedConfig, setCachedConfig } from '../../config/loader.js';
import { safeJsonParse } from '../../utils/json-parser.js';
import type { FeishuRecord } from './types.js';
import { readFeedbackRecords } from '../feedback/feishu-feedback.js';
import { computeFeedbackStats } from '../feedback/analyzer.js';

/**
 * Generate report file path with date stamp in the corpus directory.
 */
function reportPath(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10);
  return path.join(process.cwd(), 'output', 'corpus', '竞品库', `竞品分析报告-${dateStr}.md`);
}

/**
 * Obsidian vault path for competitor reports.
 */
function obsidianReportPath(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10);
  const config = getCachedConfig();
  const vaultPath = config.obsidian?.vaultPath ?? '';
  if (!vaultPath) return '';
  return path.join(vaultPath, '竞品库', `竞品分析报告-${dateStr}.md`);
}

/**
 * Copy report to Obsidian vault if configured.
 */
async function copyToObsidian(content: string, date: Date): Promise<void> {
  const obsidianPath = obsidianReportPath(date);
  if (!obsidianPath) return;
  try {
    await fs.mkdir(path.dirname(obsidianPath), { recursive: true });
    await fs.writeFile(obsidianPath, content, 'utf-8');
  } catch {
    // Obsidian write is non-fatal — log but don't fail
  }
}

// ─── Statistics helpers ──────────────────────────────────────────────

interface DimStat {
  avgReads: number;
  avgEngagement: number;
  count: number;
}

interface CompetitorDimStats {
  byStructure: Record<string, DimStat>;
  byTone: Record<string, DimStat>;
  byAngle: Record<string, DimStat>;
  byTag: Record<string, DimStat>;
  overallAvgEngagement: number;
}

function calcEngagement(r: { fields: { 点赞数?: number; 评论数?: number; 转发数?: number; 阅读数?: number } }): number {
  const reads = r.fields.阅读数 ?? 0;
  if (!reads) return 0;
  return ((r.fields.点赞数 ?? 0) + (r.fields.评论数 ?? 0) + (r.fields.转发数 ?? 0)) / reads;
}

function safeAvg(values: number[]): number {
  const nz = values.filter(v => v > 0);
  return nz.length === 0 ? 0 : nz.reduce((a, b) => a + b, 0) / nz.length;
}

function parseInteraction(raw?: string): { likes: number; reads: number } {
  if (!raw) return { likes: 0, reads: 0 };
  const parts = raw.split(/[,/]/).map(Number);
  return { likes: parts[0] || 0, reads: parts[1] || 0 };
}

function groupBy<T>(records: T[], keyFn: (r: T) => string): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  for (const r of records) {
    const k = keyFn(r);
    if (!k) continue;
    if (!m[k]) m[k] = [];
    m[k].push(r);
  }
  return m;
}

function dimStats(groups: Record<string, FeishuRecord[]>, getEng: (r: FeishuRecord) => number): Record<string, DimStat> {
  const out: Record<string, DimStat> = {};
  for (const [k, recs] of Object.entries(groups)) {
    if (!k) continue;
    out[k] = {
      avgReads: safeAvg(recs.map(r => r.fields.阅读数 ?? 0)),
      avgEngagement: safeAvg(recs.map(getEng)),
      count: recs.length,
    };
  }
  return out;
}

async function computeCompetitorStats(records: FeishuRecord[]): Promise<CompetitorDimStats> {
  const byStructure = dimStats(groupBy(records, r => r.fields.叙事结构 ?? ''), calcEngagement);
  const byTone = dimStats(groupBy(records, r => r.fields.情感调性 ?? ''), calcEngagement);
  const byAngle = dimStats(groupBy(records, r => r.fields.内容角度 ?? r.fields.选题角度 ?? ''), calcEngagement);
  const allEng = records.map(r => calcEngagement(r)).filter(v => v > 0);

  // Tags across all records
  const tagGroups: Record<string, FeishuRecord[]> = {};
  for (const r of records) {
    for (const tag of (r.fields.标签 ?? [])) {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(r);
    }
  }
  const byTag = dimStats(tagGroups, calcEngagement);

  return {
    byStructure,
    byTone,
    byAngle,
    byTag,
    overallAvgEngagement: safeAvg(allEng),
  };
}

// ─── LLM-assisted insight generation ──────────────────────────────

interface CoreFinding {
  sentence: string;
  source: string;
}

interface KeyInsights {
  findings: CoreFinding[];
  nextActions: string[];
}

async function generateCoreFinding(
  compStats: CompetitorDimStats,
  feedbackStats: { avgEngagement: number; byStructure: Record<string, DimStat> },
  gapData: { structure: string; compEng: number; myEng: number }[],
): Promise<KeyInsights> {
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get('kimi');
  const model = config.providers['kimi']?.defaultModel ?? 'moonshot-v1-8k';

  const prompt = `你是一个内容策略分析师。基于以下竞品和我方数据，生成一条核心发现和 2-3 条可执行的下一步行动建议。

数据：
【竞品结构偏好】${JSON.stringify(compStats.byStructure, null, 2)}
【我方结构偏好】${JSON.stringify(feedbackStats.byStructure, null, 2)}
【差距】${JSON.stringify(gapData, null, 2)}

请严格按以下 JSON 格式输出（只输出 JSON）：
{
  "findings": [
    { "sentence": "一句话核心发现（包含具体数字和可执行判断）", "source": "来源说明" }
  ],
  "nextActions": [
    "行动1：具体动作（目标话题）- 预期效果",
    "行动2：具体动作（目标话题）- 预期效果",
    "行动3：具体动作（目标话题）- 预期效果"
  ]
}

要求：
- 核心发现必须包含具体数字（互动率、占比等）
- 下一步行动必须具体可执行，不说空话
- 如果竞品和我方数据不足 3 条，记录"数据样本不足，无法得出可靠结论"`;

  try {
    const response = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });
    return safeJsonParse<KeyInsights>(response.content, 'core-finding') ?? {
      findings: [{ sentence: '数据样本不足，无法得出可靠结论', source: '样本量 < 3' }],
      nextActions: [],
    };
  } catch {
    return {
      findings: [{ sentence: 'AI 分析调用失败，请检查日志', source: 'LLM error' }],
      nextActions: [],
    };
  }
}

// ─── Main report generator ─────────────────────────────────────────

export async function generateCompetitorStyleReport(): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  // 1. Load data
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  setCachedConfig(config);

  const [compRecords, feedbackRecords] = await Promise.all([
    fetchCompetitiveRecords(),
    readFeedbackRecords().catch(() => [] as unknown as Awaited<ReturnType<typeof readFeedbackRecords>>),
  ]);

  const compStats = await computeCompetitorStats(compRecords);
  const feedbackStats = computeFeedbackStats(feedbackRecords as Parameters<typeof computeFeedbackStats>[0]);

  // 2. Build gap analysis (structure level)
  const gapData: { structure: string; compEng: number; myEng: number }[] = [];
  for (const [s, comp] of Object.entries(compStats.byStructure)) {
    const mine = feedbackStats.byStructure[s];
    gapData.push({
      structure: s,
      compEng: comp.avgEngagement,
      myEng: mine?.avgEngagement ?? 0,
    });
  }

  // 3. Core finding + next actions (LLM-assisted)
  const { findings, nextActions } = await generateCoreFinding(compStats, feedbackStats, gapData);

  // 4. Build tables
  const sortByEng = (m: Record<string, DimStat>) =>
    Object.entries(m).sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);

  const structureTable = sortByEng(compStats.byStructure)
    .map(([s, d]) => `| ${s} | ${d.count} | ${(d.avgEngagement * 100).toFixed(1)}% |`)
    .join('\n');

  const toneTable = sortByEng(compStats.byTone)
    .map(([t, d]) => `| ${t} | ${d.count} | ${(d.avgEngagement * 100).toFixed(1)}% |`)
    .join('\n');

  const angleTable = sortByEng(compStats.byAngle)
    .slice(0, 8)
    .map(([a, d]) => `| ${a} | ${d.count} | ${(d.avgEngagement * 100).toFixed(1)}% |`)
    .join('\n');

  const tagTable = sortByEng(compStats.byTag)
    .slice(0, 10)
    .map(([tag, d]) => `| ${tag} | ${d.count} | ${(d.avgEngagement * 100).toFixed(1)}% |`)
    .join('\n');

  const gapTable = gapData
    .filter(g => g.myEng > 0)
    .sort((a, b) => (b.compEng - b.myEng) - (a.compEng - a.myEng))
    .map(g => {
      const diff = g.compEng - g.myEng;
      const icon = diff > 0.01 ? '❌' : diff < -0.01 ? '✅' : '➖';
      return `| ${g.structure} | ${(g.myEng * 100).toFixed(1)}% | ${(g.compEng * 100).toFixed(1)}% | ${icon} |`;
    })
    .join('\n');

  const latestTable = compRecords.slice(0, 5)
    .map(r => `| ${r.fields.原文标题} | ${r.fields.平台} | ${r.fields.叙事结构 ?? '-'} | ${r.fields.情感调性 ?? '-'} |`)
    .join('\n');

  // 5. Compose report
  const report = `# 竞品分析报告 · ${dateStr}

> 生成时间：${now.toLocaleString('zh-CN')}
> 数据来源：飞书竞品素材库（${compRecords.length} 条）+ 反馈数据表（${feedbackRecords.length} 条）
> 竞品平均互动率：${(compStats.overallAvgEngagement * 100).toFixed(2)}%
> 我方平均互动率：${(feedbackStats.avgEngagement * 100).toFixed(2)}%

---

## 0. 核心发现一句话

${findings.length > 0 ? findings.map(f => `- **${f.sentence}**（来源：${f.source}）`).join('\n') : '（数据样本不足）'}

---

## 1. 市场格局

### 竞品水位
- 样本量：${compRecords.length} 篇竞品文章
- 平均阅读量：${(Object.values(compStats.byTag).reduce((s, d) => s + d.avgReads, 0) / Math.max(Object.keys(compStats.byTag).length, 1)).toFixed(0)}
- 平均互动率：${(compStats.overallAvgEngagement * 100).toFixed(2)}%

### 我方位置
- 样本量：${feedbackRecords.length} 篇已录入文章
- 平均互动率：${(feedbackStats.avgEngagement * 100).toFixed(2)}%
- 差距：${((feedbackStats.avgEngagement - compStats.overallAvgEngagement) * 100).toFixed(2)}%（${feedbackStats.avgEngagement >= compStats.overallAvgEngagement ? '我方优于竞品' : '竞品优于我方'}）

### 结论
${feedbackStats.avgEngagement >= compStats.overallAvgEngagement
    ? '我方内容整体互动率优于竞品基准，保持当前策略。'
    : '我方内容整体互动率低于竞品，存在结构性差距，需针对性优化。'}

---

## 2. 高表现规律

### 2.1 叙事结构偏好

| 结构 | 篇数 | 平均互动率 |
|------|------|----------|
${structureTable || '| - | - | - |'}

### 2.2 情感调性偏好

| 调性 | 篇数 | 平均互动率 |
|------|------|----------|
${toneTable || '| - | - | - |'}

### 2.3 切入角度分布（Top 8）

| 角度 | 篇数 | 平均互动率 |
|------|------|----------|
${angleTable || '| - | - | - |'}

### 2.4 标签热度（Top 10）

| 标签 | 篇数 | 平均互动率 |
|------|------|----------|
${tagTable || '| - | - | - |'}

---

## 3. 差距缺口

### 3.1 结构差距（我方 vs 竞品）

| 结构 | 我方互动率 | 竞品互动率 | 差距 |
|------|----------|----------|------|
${gapTable || '| 暂无重叠数据 | - | - | - |'}

### 3.2 弱势维度分析

${gapData.filter(g => g.myEng > 0 && g.compEng - g.myEng > 0.02)
    .map(g => `- **${g.structure}**：我方 ${(g.myEng * 100).toFixed(1)}% vs 竞品 ${(g.compEng * 100).toFixed(1)}%，建议优先优化`)
    .join('\n') || '暂无显著差距（数据样本不足时请继续填充数据）'}

---

## 4. 关键洞察

${nextActions.length > 0
    ? nextActions.map((a, i) => `${i + 1}. ${a}`)
    .join('\n')
    : '（AI 洞察生成失败，请基于 Section 2/3 人工判断）'}

---

## 5. 下一步行动

| 优先级 | 具体动作 | 目标话题 | 预期效果 |
|--------|----------|----------|----------|
${nextActions.slice(0, 3).map((a, i) => `| P${i + 1} | ${a} | - | - |`).join('\n') || '| - | - | - | - |'}

---

## 6. 最新竞品记录

| 标题 | 平台 | 叙事结构 | 情感调性 |
|------|------|----------|----------|
${latestTable || '| - | - | - | - |'}

---

## 附：数据来源说明

- 竞品数据：飞书竞品素材库（analyzed/stored 状态）
- 我方数据：飞书反馈数据表（已录入记录）
- 互动率计算公式：(点赞 + 评论 + 转发) / 阅读量
- 数据周期：${dateStr}
`;

  // 7. Write output
  const outputDir = path.join(process.cwd(), 'output', 'corpus', '竞品库');
  await fs.mkdir(outputDir, { recursive: true });

  const reportFilePath = reportPath(now);
  await fs.writeFile(reportFilePath, report, 'utf-8');
  await copyToObsidian(report, now);

  console.log(`竞品分析报告已生成：${reportFilePath}`);
}
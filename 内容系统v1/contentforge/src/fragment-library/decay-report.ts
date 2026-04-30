import chalk from 'chalk';
import type { SentenceFragment, ParagraphFragment } from './types.js';

const DECAY_BAR_WIDTH = 16;

type DecayLevel = SentenceFragment['decayLevel'];

interface DecayStats {
  total: number;
  active: number;
  dormant: number;
  expired: number;
}

interface TypeHealth {
  label: string;
  total: number;
  active: number;
  dormant: number;
  expired: number;
  isSentence: boolean;
}

interface SourceDecay {
  source: 'edited' | 'external';
  total: number;
  active: number;
  dormant: number;
  expired: number;
}

interface BurnedFragment {
  id: string;
  type: string;
  text: string;
  useCount: number;
  isSentence: boolean;
}

export interface DecayReportData {
  stats: DecayStats;
  sentenceTypes: TypeHealth[];
  paragraphTypes: TypeHealth[];
  sourceDecay: SourceDecay[];
  burnedFragments: BurnedFragment[];
  suggestions: Array<{ priority: 'high' | 'medium' | 'low' | 'info'; text: string }>;
}

/**
 * Compute suggestions from decay scan results.
 * Rules-based, no LLM call.
 */
function computeSuggestions(
  sentenceTypes: TypeHealth[],
  paragraphTypes: TypeHealth[],
  sourceDecay: SourceDecay[],
  burnedFragments: BurnedFragment[],
  stats: DecayStats,
): Array<{ priority: 'high' | 'medium' | 'low' | 'info'; text: string }> {
  const suggestions: Array<{ priority: 'high' | 'medium' | 'low' | 'info'; text: string }> = [];
  const allTypes = [...sentenceTypes, ...paragraphTypes];

  // Rule 1: Type with < 5 total fragments
  for (const t of allTypes) {
    if (t.total < 5) {
      const kind = t.isSentence ? '句式' : '段落';
      const name = t.label;
      suggestions.push({
        priority: 'high',
        text: `[高] ${kind}碎片 ${name} 数量严重不足（仅${t.total}个），建议从 external 文章补充`,
      });
    }
  }

  // Rule 2: Type with > 50% dormant ratio
  for (const t of allTypes) {
    if (t.total === 0) continue;
    const dormantRatio = (t.dormant + t.expired) / t.total;
    if (dormantRatio > 0.5) {
      const kind = t.isSentence ? '句式' : '段落';
      suggestions.push({
        priority: 'medium',
        text: `[中] ${kind}碎片 ${name} 超过50%已衰减（${t.dormant} dormant + ${t.expired} expired），建议补充新鲜素材`,
      });
    }
  }

  // Rule 3: Burned fragments
  if (burnedFragments.length > 0) {
    const count = burnedFragments.length;
    suggestions.push({
      priority: 'low',
      text: `[通知] ${count}个碎片因过度使用（≥5次）已标记为 dormant，建议下次 create 时手动排除或重写`,
    });
  }

  // Rule 4: Expired ratio > 20%
  const expiredRatio = stats.expired / stats.total;
  if (expiredRatio > 0.2) {
    suggestions.push({
      priority: 'info',
      text: `[清理] 过期碎片占比${Math.round(expiredRatio * 100)}%（${stats.expired}个），可用 learn --clear-type 清理`,
    });
  }

  // Rule 5: external decays faster than edited
  const ext = sourceDecay.find(s => s.source === 'external');
  const edt = sourceDecay.find(s => s.source === 'edited');
  if (ext && edt && ext.total > 0 && edt.total > 0) {
    const extDormantRatio = (ext.dormant + ext.expired) / ext.total;
    const edtDormantRatio = (edt.dormant + edt.expired) / edt.total;
    if (extDormantRatio > edtDormantRatio + 0.15) {
      suggestions.push({
        priority: 'info',
        text: `[来源] external 来源碎片衰减更快（${Math.round(extDormantRatio * 100)}% 已衰减 vs edited ${Math.round(edtDormantRatio * 100)}%），可能需重新学习`,
      });
    }
  }

  return suggestions;
}

function typeHealthLabel(type: SentenceFragment['type'] | ParagraphFragment['type']): string {
  return type;
}

/**
 * Render a health bar for a single type.
 */
function renderTypeHealth(t: TypeHealth): string {
  if (t.total === 0) {
    return `  ${t.label.padEnd(18)} ${'─'.repeat(DECAY_BAR_WIDTH)}  0  ${chalk.gray('(无数据)')}`;
  }
  const activeBar = Math.round((t.active / t.total) * DECAY_BAR_WIDTH);
  const dormantBar = Math.round((t.dormant / t.total) * DECAY_BAR_WIDTH);
  const expiredBar = DECAY_BAR_WIDTH - activeBar - dormantBar;

  const activeStr = chalk.green('█'.repeat(activeBar));
  const dormantStr = chalk.yellow('█'.repeat(dormantBar));
  const expiredStr = chalk.red('█'.repeat(Math.max(0, expiredBar)));
  const emptyStr = chalk.gray('░'.repeat(Math.max(0, DECAY_BAR_WIDTH - activeBar - dormantBar - Math.max(0, expiredBar))));

  const status = t.dormant > 0 || t.expired > 0
    ? t.expired > 0
      ? chalk.red(`⚠️ ${t.dormant} dormant ${t.expired} expired`)
      : chalk.yellow(`⚠️ ${t.dormant} dormant`)
    : chalk.green('active');

  return `  ${t.label.padEnd(18)} ${activeStr}${dormantStr}${expiredStr}${emptyStr}  ${String(t.total).padStart(3)}  ${status}`;
}

export function buildDecayReportData(
  stats: DecayStats,
  allSentences: SentenceFragment[],
  allParagraphs: ParagraphFragment[],
): DecayReportData {
  // Group by type
  const sentenceTypes: TypeHealth[] = [];
  for (const type of ['hook', 'transition', 'cta', 'power-line', 'rhetorical-question', 'data-opener'] as const) {
    const frags = allSentences.filter(f => f.type === type);
    sentenceTypes.push({
      label: type,
      total: frags.length,
      active: frags.filter(f => f.decayLevel === 'active').length,
      dormant: frags.filter(f => f.decayLevel === 'dormant').length,
      expired: frags.filter(f => f.decayLevel === 'expired').length,
      isSentence: true,
    });
  }

  const paragraphTypes: TypeHealth[] = [];
  for (const type of ['opening', 'argument', 'emotional-peak', 'closing', 'case-study'] as const) {
    const frags = allParagraphs.filter(f => f.type === type);
    paragraphTypes.push({
      label: type,
      total: frags.length,
      active: frags.filter(f => f.decayLevel === 'active').length,
      dormant: frags.filter(f => f.decayLevel === 'dormant').length,
      expired: frags.filter(f => f.decayLevel === 'expired').length,
      isSentence: false,
    });
  }

  // Source decay
  const sourceDecay: SourceDecay[] = [];
  for (const source of ['edited', 'external'] as const) {
    const sent = allSentences.filter(f => f.source === source);
    const para = allParagraphs.filter(f => f.source === source);
    const all = [...sent, ...para];
    sourceDecay.push({
      source,
      total: all.length,
      active: all.filter(f => f.decayLevel === 'active').length,
      dormant: all.filter(f => f.decayLevel === 'dormant').length,
      expired: all.filter(f => f.decayLevel === 'expired').length,
    });
  }

  // Burned fragments (useCount >= 5)
  const burnedFragments: BurnedFragment[] = [];
  for (const f of [...allSentences, ...allParagraphs]) {
    if ((f.useCount ?? 0) >= 5) {
      burnedFragments.push({
        id: f.id,
        type: f.type,
        text: 'text' in f ? String(f.text).slice(0, 40) : String(f.content).slice(0, 40),
        useCount: f.useCount ?? 0,
        isSentence: 'text' in f,
      });
    }
  }

  const suggestions = computeSuggestions(sentenceTypes, paragraphTypes, sourceDecay, burnedFragments, stats);

  return { stats, sentenceTypes, paragraphTypes, sourceDecay, burnedFragments, suggestions };
}

/**
 * Render decay report to console.
 */
export function renderDecayReport(data: DecayReportData, before: DecayStats): void {
  const { stats, sentenceTypes, paragraphTypes, sourceDecay, burnedFragments, suggestions } = data;

  // Health score
  const healthScore = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const healthColor = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : healthScore >= 40 ? chalk.red : chalk.red.bold;
  const healthLabel =
    healthScore >= 80 ? '优秀' :
    healthScore >= 60 ? '良好' :
    healthScore >= 40 ? '⚠️ 预警' : '🔴 告警';

  // Overall bar
  const activeBars = Math.round((stats.active / stats.total) * DECAY_BAR_WIDTH);
  const dormantBars = Math.round((stats.dormant / stats.total) * DECAY_BAR_WIDTH);
  const expiredBars = DECAY_BAR_WIDTH - activeBars - dormantBars;
  const overallBar =
    chalk.green('█'.repeat(activeBars)) +
    chalk.yellow('█'.repeat(dormantBars)) +
    chalk.red('█'.repeat(Math.max(0, expiredBars))) +
    chalk.gray('░'.repeat(Math.max(0, DECAY_BAR_WIDTH - activeBars - dormantBars - Math.max(0, expiredBars))));

  console.log(chalk.bold('\n📊 碎片健康报告\n'));
  console.log(`整体健康度: ${overallBar} ${healthColor(healthScore + '%')} (${stats.active}/${stats.total})`);
  console.log(`状态: ${healthLabel}`);
  if (before.dormant !== stats.dormant || before.expired !== stats.expired) {
    const changed = (stats.dormant - before.dormant) + (stats.expired - before.expired);
    console.log(`本次扫描: ${changed > 0 ? chalk.yellow(`+${changed} 衰减`) : chalk.green('无变化')}`);
  }

  // Decay distribution
  console.log(chalk.bold('\n── 衰减分布 ─────────────────────────────'));
  const total = stats.total || 1;
  const activeBar2 = Math.round((stats.active / total) * 20);
  const dormantBar2 = Math.round((stats.dormant / total) * 20);
  const expiredBar2 = 20 - activeBar2 - dormantBar2;
  console.log(`active   ${String(stats.active).padStart(4)} (${Math.round(stats.active / total * 100)}%)  ${chalk.green('█'.repeat(activeBar2))}${chalk.gray('░'.repeat(20 - activeBar2))}`);
  console.log(`dormant  ${String(stats.dormant).padStart(4)} (${Math.round(stats.dormant / total * 100)}%)  ${chalk.yellow('█'.repeat(dormantBar2))}${chalk.gray('░'.repeat(20 - dormantBar2))}`);
  console.log(`expired  ${String(stats.expired).padStart(4)} (${Math.round(stats.expired / total * 100)}%)  ${chalk.red('█'.repeat(Math.max(0, expiredBar2)))}${chalk.gray('░'.repeat(20 - Math.max(0, expiredBar2)))}`);

  // Type health — sentences
  console.log(chalk.bold('\n── 类型健康度 ───────────────────────────'));
  console.log(chalk.bold('句式碎片:'));
  for (const t of sentenceTypes) {
    console.log(renderTypeHealth(t));
  }
  console.log(chalk.bold('\n段落碎片:'));
  for (const t of paragraphTypes) {
    console.log(renderTypeHealth(t));
  }

  // Source decay
  if (sourceDecay.length > 0 && sourceDecay.some(s => s.total > 0)) {
    console.log(chalk.bold('\n── 来源衰减对比 ──────────────────────────'));
    for (const s of sourceDecay) {
      if (s.total === 0) continue;
      const total2 = s.total || 1;
      const a = Math.round((s.active / total2) * 20);
      const d = Math.round((s.dormant / total2) * 20);
      const e = 20 - a - d;
      const label = s.source === 'edited' ? 'edited  ' : 'external';
      console.log(
        `${label} ${String(s.total).padStart(3)}  active: ${chalk.green(String(s.active).padStart(3))} (${Math.round(s.active / total2 * 100)}%)  ` +
        `${chalk.yellow('dormant: ' + String(s.dormant).padStart(3))} (${Math.round(s.dormant / total2 * 100)}%)  ` +
        `${chalk.red('expired: ' + String(s.expired).padStart(3))} (${Math.round(s.expired / total2 * 100)}%)`
      );
    }
  }

  // Burned fragments
  if (burnedFragments.length > 0) {
    console.log(chalk.bold('\n── 烧坏碎片 (使用≥5次) ───────────────────'));
    for (const bf of burnedFragments) {
      const shortText = bf.text.replace(/\n/g, ' ').slice(0, 40);
      console.log(`  ${chalk.yellow('⚠️')} [${bf.type}] "${shortText}" (使用${bf.useCount}次)`);
    }
  }

  // Suggestions
  if (suggestions.length > 0) {
    console.log(chalk.bold('\n── 行动建议 ─────────────────────────────────'));
    const priorityColor = { high: chalk.red, medium: chalk.yellow, low: chalk.cyan, info: chalk.gray };
    for (const s of suggestions) {
      console.log(`  ${priorityColor[s.priority]('•')} ${s.text}`);
    }
  } else {
    console.log(chalk.bold('\n── 行动建议 ─────────────────────────────────'));
    console.log(`  ${chalk.green('✓')} 碎片库健康，无需特殊干预`);
  }

  console.log('');
}
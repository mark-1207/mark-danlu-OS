import chalk from 'chalk';
import readline from 'readline';
import { isTerminalInteractive } from './interactive.js';
import type { CreativePreferences, PlatformPreferences } from '../../scenarios/learning/types.js';
import type { PlatformOverrides, OverrideDimension } from '../../scenarios/learning/preference-override.js';
import { buildPreferencePrompt } from '../../scenarios/learning/creative-preferences.js';

function consoleClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号',
  xiaohongshu: '小红书',
  douyin: '抖音',
};

const DIMENSION_LABELS: Record<string, string> = {
  structure: '叙事结构',
  tone: '情感调性',
  angle: '内容角度',
};

function confidenceColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high': return chalk.green('🟢');
    case 'medium': return chalk.yellow('🟡');
    case 'low': return chalk.red('🔴');
  }
}

function confidenceStr(level: 'low' | 'medium' | 'high'): string {
  const icon = confidenceColor(level);
  return `${icon} ${level}`;
}

function formatPatterns(patterns: Array<{ pattern: string; adoptionRate: number; count: number }>): string {
  if (!patterns || patterns.length === 0) return chalk.dim('(无)');
  return patterns
    .map((p) => `${p.pattern}`)
    .join(', ');
}

export function formatDashboardNonTty(prefs: CreativePreferences, overrides: PlatformOverrides): string {
  const lines: string[] = [];
  lines.push(chalk.bold('\n📊 创作偏好面板\n'));

  for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
    const p = prefs[platform];
    const over = overrides[platform];
    const label = PLATFORM_LABELS[platform];
    lines.push(chalk.bold(`\n【${label}】`));

    const showOverride = (dim: OverrideDimension, val: string) => {
      const ov = over[dim];
      return ov && ov !== val ? chalk.yellow(` ${ov} ★`) : '';
    };

    lines.push(`  结构: ${confidenceStr(p.structure.confidence)} ${chalk.white(p.structure.preference)}${showOverride('structure', p.structure.preference)} (样本${p.structure.sampleSize})`);
    lines.push(`  调性: ${confidenceStr(p.tone.confidence)} ${chalk.white(p.tone.preference)}${showOverride('tone', p.tone.preference)} (样本${p.tone.sampleSize})`);
    lines.push(`  角度: ${confidenceStr(p.angle.confidence)} ${chalk.white(p.angle.preference)}${showOverride('angle', p.angle.preference)} (样本${p.angle.sampleSize})`);
    lines.push(`  标题: ${formatPatterns(p.title.effectivePatterns)}`);
    lines.push(`  钩子: ${formatPatterns(p.hook.effectivePatterns)}`);

    // Prompt preview per platform
    lines.push(chalk.dim(`  Prompt 注入预览:`));
    const prompt = buildPreferencePrompt(platform);
    if (prompt) {
      lines.push(chalk.dim(`    ${prompt.replace(/\n/g, '\n    ')}`));
    } else {
      lines.push(chalk.dim(`    (无偏好注入)`));
    }
  }

  if (prefs.lastUpdated) {
    lines.push(chalk.dim(`\n最后更新: ${prefs.lastUpdated}`));
  }
  lines.push('');

  return lines.join('\n');
}

// Platform card rendering for TTY
function renderPlatformCard(
  p: PlatformPreferences,
  over: PlatformOverride,
  isActive: boolean,
  cursorDim: number,
  dimCount: number,
): string[] {
  const borderColor = isActive ? chalk.cyan : chalk.dim;
  const dims: OverrideDimension[] = ['structure', 'tone', 'angle'];
  const lines: string[] = [];

  const topBorder = borderColor('┌' + '─'.repeat(33) + '┐');
  lines.push(topBorder);

  // Header
  const header = isActive ? chalk.bold.cyan(` ${PLATFORM_LABELS['wechat']} `) : chalk.dim(` ${PLATFORM_LABELS['wechat']} `);
  lines.push(borderColor('│') + header + borderColor('│'));

  lines.push(borderColor('│') + ' '.repeat(34) + borderColor('│'));

  // Dimensions
  for (let i = 0; i < dims.length; i++) {
    const dim = dims[i];
    const label = DIMENSION_LABELS[dim];
    const pref = p[dim].preference;
    const conf = p[dim].confidence;
    const overrideVal = over[dim];
    const hasOverride = overrideVal && overrideVal !== pref;

    let line = borderColor('│') + ' ';
    if (isActive && i === cursorDim) {
      line += chalk.bgCyan.black('>') + ' ';
    } else {
      line += '  ';
    }

    const labelStr = chalk.dim(label + ':');
    const prefStr = chalk.white(pref.length > 12 ? pref.slice(0, 10) + '…' : pref);
    const confIcon = confidenceColor(conf);
    const overrideStr = hasOverride ? chalk.yellow(` ★${overrideVal}`) : '';

    line += `${labelStr} ${confIcon} ${prefStr}${overrideStr}`;
    line += borderColor('│');
    lines.push(line);
  }

  lines.push(borderColor('│') + ' '.repeat(34) + borderColor('│'));

  // Title/Hook summary
  const titleCount = p.title.effectivePatterns?.length ?? 0;
  const hookCount = p.hook.effectivePatterns?.length ?? 0;
  lines.push(borderColor('│') + chalk.dim(`   标题模式: ${titleCount} 种`) + ' '.repeat(Math.max(0, 20 - String(titleCount).length)) + borderColor('│'));
  lines.push(borderColor('│') + chalk.dim(`   钩子模式: ${hookCount} 种`) + ' '.repeat(Math.max(0, 20 - String(hookCount).length)) + borderColor('│'));

  // Competitor insights
  if (p.competitorInsights) {
    lines.push(borderColor('│') + ' '.repeat(34) + borderColor('│'));
    const ci = p.competitorInsights;
    lines.push(borderColor('│') + chalk.gray(`   竞品结构: ${ci.structure.preference}`) + borderColor('│'));
    lines.push(borderColor('│') + chalk.gray(`   竞品调性: ${ci.tone.preference}`) + borderColor('│'));
  }

  const bottomBorder = borderColor('└' + '─'.repeat(33) + '┘');
  lines.push(bottomBorder);

  return lines;
}

export async function showPreferenceDashboard(
  prefs: CreativePreferences,
  overrides: PlatformOverrides,
): Promise<{ overrides: PlatformOverrides }> {
  if (!isTerminalInteractive()) {
    console.log(formatDashboardNonTty(prefs, overrides));
    return { overrides };
  }

  type Platform = 'wechat' | 'xiaohongshu' | 'douyin';
  const platforms: Platform[] = ['wechat', 'xiaohongshu', 'douyin'];
  const dims: OverrideDimension[] = ['structure', 'tone', 'angle'];
  let activePlatform = 0;
  let cursorDim = 0;

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  function render(): void {
    consoleClear();
    console.log(chalk.bold('\n📊 创作偏好面板\n'));
    console.log(chalk.dim('  ← → 切换平台  ↑ ↓ 选维度  Enter 编辑覆盖  p 预览  r 重置  q 退出\n'));

    // Render three platform columns side by side
    const columns: string[][] = [];
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const isActive = i === activePlatform;
      const cursor = isActive ? cursorDim : -1;
      const lines = renderPlatformCard(prefs[platform], overrides[platform], isActive, cursor, dims.length);
      columns.push(lines);
    }

    const maxHeight = Math.max(...columns.map((c) => c.length));
    for (let row = 0; row < maxHeight; row++) {
      const parts: string[] = [];
      for (let col = 0; col < columns.length; col++) {
        parts.push(columns[col][row] ?? ' '.repeat(35));
      }
      console.log(parts.join('  '));
    }

    // Show overrides section for active platform
    const activeP = platforms[activePlatform];
    const activeOver = overrides[activeP];
    const hasOverrides = activeOver.structure || activeOver.tone || activeOver.angle;
    if (hasOverrides) {
      console.log(chalk.yellow(`\n  ★ 当前覆盖 (${PLATFORM_LABELS[activeP]}):`));
      for (const dim of dims) {
        if (activeOver[dim]) {
          const original = prefs[activeP][dim].preference;
          console.log(`    ${DIMENSION_LABELS[dim]}: ${chalk.dim(original)} → ${chalk.yellow(activeOver[dim])}`);
        }
      }
    }

    console.log(chalk.dim(`\n  最后更新: ${prefs.lastUpdated || '从未'}`));
  }

  return new Promise((resolve) => {
    // Override input session state
    let inOverride = false;

    function onKeypress(_chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? '';

      if (inOverride) return; // waiting for readline.question

      if (keyName === 'q' || keyName === 'escape') {
        cleanup();
        resolve({ overrides });
        return;
      }

      if (keyName === 'left' || keyName === 'h') {
        activePlatform = (activePlatform - 1 + platforms.length) % platforms.length;
        cursorDim = Math.min(cursorDim, dims.length - 1);
        render();
        return;
      }

      if (keyName === 'right' || keyName === 'l') {
        activePlatform = (activePlatform + 1) % platforms.length;
        cursorDim = Math.min(cursorDim, dims.length - 1);
        render();
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursorDim = Math.max(0, cursorDim - 1);
        render();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursorDim = Math.min(dims.length - 1, cursorDim + 1);
        render();
        return;
      }

      if (keyName === 'return' || keyName === 'enter') {
        // Start override input
        inOverride = true;
        const platform = platforms[activePlatform];
        const dim = dims[cursorDim];
        const currentPref = prefs[platform][dim].preference;
        const currentOverride = overrides[platform][dim] || '';
        process.stdin.pause();

        // Need a new readline for question (the old one is in raw mode)
        const overrideRl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
        overrideRl.question(
          chalk.cyan(`\n  ${PLATFORM_LABELS[platform]} → ${DIMENSION_LABELS[dim]}\n  当前: ${currentPref}\n  覆盖值 (回车清除, 空取消): `),
          (answer) => {
            overrideRl.close();
            const trimmed = answer.trim();
            if (trimmed) {
              overrides[platform] = { ...overrides[platform], [dim]: trimmed };
            } else if (answer === '') {
              // Empty with no previous override = cancel
              // But if there IS an override, empty = clear it
              if (overrides[platform][dim]) {
                overrides[platform] = { ...overrides[platform], [dim]: null };
              }
            }
            inOverride = false;
            process.stdin.resume();
            process.stdin.setRawMode?.(true);
            render();
          },
        );
        return;
      }

      if (keyName === 'r' || keyName === 'R') {
        overrides[platforms[activePlatform]] = {};
        render();
        return;
      }

      if (keyName === 'p' || keyName === 'P') {
        // Preview buildPreferencePrompt output
        const platform = platforms[activePlatform];
        const prompt = buildPreferencePrompt(platform);
        consoleClear();
        console.log(chalk.bold(`\n📝 Prompt 注入预览 — ${PLATFORM_LABELS[platform]}\n`));
        if (prompt) {
          console.log(prompt);
        } else {
          console.log(chalk.dim('  (无偏好注入 — 结构/调性置信度过低时跳过)'));
        }
        console.log(chalk.dim('\n  按任意键返回面板\n'));

        // Wait for a single keypress then return to dashboard
        process.stdin.removeListener('keypress', onKeypress);
        process.stdin.once('keypress', () => {
          process.stdin.removeAllListeners('keypress');
          process.stdin.on('keypress', onKeypress);
          render();
        });
        return;
      }

      render();
    }

    function cleanup() {
      rl.close();
      process.stdin.setRawMode?.(false);
      process.stdin.removeListener('keypress', onKeypress);
      console.log('');
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

import chalk from 'chalk';
import readline from 'readline';
import { type TopicAnalysisReview } from '../../scenarios/create/types.js';
import type { PlatformSelectionConfirmed } from '../../scenarios/create/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopicAssignmentDisplay {
  wechat: { angle: string; titles: string[]; selectedIndex: number };
  xiaohongshu: { angle: string; titles: string[]; selectedIndex: number };
  douyin: { angle: string; titles: string[]; selectedIndex: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function consoleClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function renderStep1Header(keyword: string): void {
  console.log(chalk.bold(`\n📋 选题分析确认 — ${keyword}\n`));
  console.log('─'.repeat(60));
}

function renderStep2Header(): void {
  console.log(chalk.bold('\n📋 话题分配确认\n'));
  console.log('─'.repeat(60));
}

function heatLabel(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return chalk.red('🔥');
    case 'medium':
      return chalk.yellow('📊');
    case 'low':
      return chalk.gray('📉');
  }
}

// ─── Step 1: reviewTopicAnalysis ─────────────────────────────────────────────

/**
 * Step 1 TUI — review topic analysis with subTopic selection, controversies
 * and trendingAngles display-only, plus re-run capability via `r` key.
 *
 * Navigation:
 * - ↑↓  move cursor within active group
 * - 空格 toggle selection on subTopics (only pending items)
 * - r    re-run analysis for current group
 * - 回车  confirm and return
 *
 * Returns { selectedIndices: number[]; excludeDirections: string[] }
 */
export async function reviewTopicAnalysis(
  reviewData: TopicAnalysisReview,
  onRewrite: (group: string) => Promise<TopicAnalysisReview>,
): Promise<{ selectedIndices: number[]; excludeDirections: string[]; extraDirections: string[] }> {
  // Non-TTY fallback — resolve immediately with all pending subTopics selected
  if (!process.stdin.isTTY) {
    const selectedIndices = reviewData.subTopics
      .map((st, i) => (st.decision === 'pending' ? i : -1))
      .filter((i) => i >= 0);
    return { selectedIndices, excludeDirections: [], extraDirections: [] };
  }

  // State
  type Group = 'subTopics' | 'controversies' | 'trendingAngles';
  const groups: Group[] = ['subTopics', 'controversies', 'trendingAngles'];
  let activeGroup: Group = 'subTopics';
  let cursorInGroup = 0;
  const selected = new Set<number>(
    reviewData.subTopics
      .map((st, i) => (st.decision === 'confirmed' ? i : -1))
      .filter((i) => i >= 0),
  );
  const extraDirections: string[] = [];

const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  const getItemsInGroup = (group: Group) => {
    switch (group) {
      case 'subTopics':
        return reviewData.subTopics;
      case 'controversies':
        return reviewData.controversies;
      case 'trendingAngles':
        return reviewData.trendingAngles;
    }
  };

  function render(): void {
    consoleClear();
    renderStep1Header(reviewData.keyword);

    for (const group of groups) {
      const items = getItemsInGroup(group);
      const isActive = group === activeGroup;

      switch (group) {
        case 'subTopics': {
          const selectedCount = selected.size;
          const total = items.length;
          const label = isActive
            ? chalk.bold.cyan(`▶ 热度子话题 (已选${selectedCount}/${total})`)
            : chalk.dim(`  热度子话题 (已选${selectedCount}/${total})`);
          console.log(label);
          break;
        }
        case 'controversies': {
          const label = isActive
            ? chalk.bold.cyan('▶ 争议话题')
            : chalk.dim('  争议话题');
          console.log(label);
          break;
        }
        case 'trendingAngles': {
          const label = isActive
            ? chalk.bold.cyan('▶ 热门角度')
            : chalk.dim('  热门角度');
          console.log(label);
          break;
        }
      }

      items.forEach((item: any, idx: number) => {
        const isCursor = isActive && idx === cursorInGroup;
        const isSelected = selected.has(idx);

        let marker = '  ';
        let prefix = '    ';

        if (group === 'subTopics') {
          const decision = item.decision as string;
          if (decision === 'confirmed') {
            marker = chalk.green('✓ ');
            prefix = '    ';
          } else if (isCursor) {
            marker = chalk.bold.yellow('● ');
            prefix = '    ';
          } else {
            marker = chalk.dim('○ ');
            prefix = '    ';
          }
        } else {
          marker = isCursor ? chalk.bold.yellow('● ') : chalk.dim('○ ');
          prefix = '    ';
        }

        const cursorMark = isCursor ? chalk.bgYellow.black('>') + ' ' : '  ';

        if (group === 'subTopics') {
          const heatIcon = heatLabel(item.heatLevel as 'high' | 'medium' | 'low');
          console.log(`${prefix}${cursorMark}${marker}${chalk.white(item.name)} ${heatIcon}`);
          if (item.description) {
            console.log(`${prefix}    ${chalk.dim(item.description.substring(0, 60))}${item.description.length > 60 ? '…' : ''}`);
          }
        } else if (group === 'controversies') {
          console.log(`${prefix}${cursorMark}${marker}${chalk.white(item.topic)}`);
          console.log(`${prefix}    ${chalk.dim('A: ' + item.sideA.substring(0, 40))}…`);
          console.log(`${prefix}    ${chalk.dim('B: ' + item.sideB.substring(0, 40))}…`);
        } else {
          console.log(`${prefix}${cursorMark}${marker}${chalk.white(item.angle)}`);
          console.log(`${prefix}    ${chalk.dim(item.whyTrending.substring(0, 60))}…`);
        }
      });
      console.log('');
    }

    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.dim('  ↑↓ 选择   空格 确认   r 重新分析   a 增加排除方向   回车 确认'));
  }

  return new Promise((resolve) => {
    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'r' && key?.meta === false) {
        // Re-run analysis for current group
        process.stdin.pause();
        consoleClear();
        console.log(chalk.cyan('  ⏳ 正在重新分析...\n'));
        onRewrite(activeGroup).then((newData) => {
          Object.assign(reviewData, newData);
          process.stdin.resume();
          render();
        }).catch((err) => {
          process.stdin.resume();
          console.error(chalk.red(`  ✗ 重写失败: ${err.message}`));
          render();
        });
        return;
      }

      if (keyName === 'return' || keyName === 'enter') {
        cleanup();
        const selectedIndices = Array.from(selected);
        const excludeDirections = reviewData.subTopics
          .filter((st) => st.decision === 'rejected')
          .map((st) => st.name);
        resolve({ selectedIndices, excludeDirections, extraDirections });
        return;
      }

      if (keyName === 'a' || keyName === 'A') {
        process.stdin.pause();
        cleanup();
        rl.question(chalk.cyan('输入想排除的方向（直接回车跳过）: '), (answer) => {
          const direction = answer.trim();
          if (direction) {
            extraDirections.push(direction);
          }
          const newRl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
          readline.emitKeypressEvents(process.stdin);
          process.stdin.setRawMode?.(true);
          process.stdin.resume();
          process.stdin.on('keypress', onKeypress);
          render();
        });
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursorInGroup = Math.max(0, cursorInGroup - 1);
        render();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursorInGroup = Math.min(getItemsInGroup(activeGroup).length - 1, cursorInGroup + 1);
        render();
        return;
      }

      if (keyName === 'tab') {
        const idx = groups.indexOf(activeGroup);
        activeGroup = groups[(idx + 1) % groups.length];
        const items = getItemsInGroup(activeGroup);
        cursorInGroup = Math.min(cursorInGroup, items.length - 1);
        render();
        return;
      }

      if ((keyName === ' ' || keyName === 'space') && activeGroup === 'subTopics') {
        const decision = reviewData.subTopics[cursorInGroup]?.decision;
        if (decision === 'confirmed') {
          // Cannot toggle confirmed items
          render();
          return;
        }
        if (isSelected) {
          selected.delete(cursorInGroup);
        } else {
          selected.add(cursorInGroup);
        }
        render();
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

// ─── Step 2: reviewTopicAssignment ───────────────────────────────────────────

/**
 * Step 2 TUI — review topic assignment across three platforms simultaneously.
 *
 * Navigation:
 * - ←→   switch active platform
 * - ↑↓   move cursor within active platform's titles
 * - 1-3  directly select a title
 * - 回车  confirm all and return
 *
 * Returns { wechat, xiaohongshu, douyin } each with PlatformSelectionConfirmed
 */
export async function reviewTopicAssignment(
  assignment: TopicAssignmentDisplay,
): Promise<{ wechat: PlatformSelectionConfirmed; xiaohongshu: PlatformSelectionConfirmed; douyin: PlatformSelectionConfirmed }> {
  // Non-TTY fallback — resolve immediately with current selections
  if (!process.stdin.isTTY) {
    const toConfirm = (platform: keyof TopicAssignmentDisplay) => ({
      titleIndex: assignment[platform].selectedIndex,
      title: assignment[platform].titles[assignment[platform].selectedIndex],
    });
    return {
      wechat: toConfirm('wechat'),
      xiaohongshu: toConfirm('xiaohongshu'),
      douyin: toConfirm('douyin'),
    };
  }

  type Platform = 'wechat' | 'xiaohongshu' | 'douyin';
  const platforms: Platform[] = ['wechat', 'xiaohongshu', 'douyin'];
  const platformLabels: Record<Platform, string> = {
    wechat: '公众号',
    xiaohongshu: '小红书',
    douyin: '抖音',
  };

  let activePlatform: Platform = 'wechat';
  let cursorInTitles = assignment.wechat.selectedIndex;
  let editingAngle = false;

  // Keep a copy of original angle for each platform (for angleOverride detection)
  const originalAngles = {
    wechat: assignment.wechat.angle,
    xiaohongshu: assignment.xiaohongshu.angle,
    douyin: assignment.douyin.angle,
  };

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  function render(): void {
    consoleClear();
    renderStep2Header();

    for (const platform of platforms) {
      const data = assignment[platform];
      const isActive = platform === activePlatform;
      const borderColor = isActive ? chalk.cyan : chalk.dim;

      console.log(borderColor('┌' + '─'.repeat(58) + '┐'));

      const label = platformLabels[platform];
      const titleCount = data.titles.length;
      const selectedIdx = platform === activePlatform ? cursorInTitles : getSelectedIndexForPlatform(platform);
      const header = isActive
        ? chalk.bold.cyan(`▶ ${label} (已选 ${selectedIdx + 1}/${titleCount})`)
        : chalk.dim(`  ${label} (已选 ${selectedIdx + 1}/${titleCount})`);
      console.log(borderColor('│') + ` ${header}${' '.repeat(Math.max(0, 50 - header.length))}` + borderColor('│'));

      console.log(borderColor('│') + chalk.dim(`   角度: ${data.angle.substring(0, 45)}${data.angle.length > 45 ? '…' : ''}${' '.repeat(Math.max(0, 50 - data.angle.length))}`) + borderColor('│'));

      console.log(borderColor('│') + ' '.repeat(59) + borderColor('│'));

      data.titles.forEach((title: string, idx: number) => {
        const isSelected = platform === activePlatform ? idx === cursorInTitles : idx === getSelectedIndexForPlatform(platform);
        const marker = isSelected ? chalk.bold.yellow('●') : chalk.dim('○');
        const numLabel = `${idx + 1}.`;
        const numStr = platform === activePlatform ? chalk.bold.white(numLabel) : chalk.dim(numLabel);
        const titleStr = isSelected ? chalk.white(title) : chalk.dim(title);
        const padding = ' '.repeat(Math.max(0, 50 - title.length));
        console.log(borderColor('│') + `   ${marker} ${numStr} ${titleStr}${padding}` + borderColor('│'));
      });

      console.log(borderColor('└' + '─'.repeat(58) + '┘'));
      console.log('');
    }

    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.dim('  ←→ 切换平台   ↑↓ 选择标题   1-3 直接选择   e 编辑角度   回车 确认'));
  }

  function getSelectedIndexForPlatform(platform: Platform): number {
    return assignment[platform].selectedIndex;
  }

  return new Promise((resolve) => {
    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        cleanup();
        const toConfirm = (platform: Platform): PlatformSelectionConfirmed => {
          const rawIdx = platform === activePlatform ? cursorInTitles : assignment[platform].selectedIndex;
          const safeIdx = Math.min(Math.max(0, rawIdx), assignment[platform].titles.length - 1);
          const title = assignment[platform].titles[safeIdx];
          // if angle was edited via 'e', capture as override
          const angleOverride = assignment[platform].angle !== originalAngles[platform]
            ? assignment[platform].angle
            : undefined;
          return { titleIndex: safeIdx, title, angleOverride };
        };
        resolve({
          wechat: toConfirm('wechat'),
          xiaohongshu: toConfirm('xiaohongshu'),
          douyin: toConfirm('douyin'),
        });
        return;
      }

      if (keyName === 'left' || keyName === 'h') {
        const idx = platforms.indexOf(activePlatform);
        activePlatform = platforms[(idx - 1 + platforms.length) % platforms.length];
        cursorInTitles = assignment[activePlatform].selectedIndex;
        render();
        return;
      }

      if (keyName === 'right' || keyName === 'l') {
        const idx = platforms.indexOf(activePlatform);
        activePlatform = platforms[(idx + 1) % platforms.length];
        cursorInTitles = assignment[activePlatform].selectedIndex;
        render();
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursorInTitles = Math.max(0, cursorInTitles - 1);
        render();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursorInTitles = Math.min(assignment[activePlatform].titles.length - 1, cursorInTitles + 1);
        render();
        return;
      }

      if (keyName === 'e' || keyName === 'E') {
        process.stdin.pause();
        cleanup();
        rl.question(chalk.cyan('输入新角度描述（直接回车跳过）: '), (answer) => {
          const newAngle = answer.trim();
          if (newAngle) {
            assignment[activePlatform].angle = newAngle;
            originalAngles[activePlatform] = newAngle;
          }
          // Reinitialize readline after cleanup
          const newRl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
          readline.emitKeypressEvents(process.stdin);
          process.stdin.setRawMode?.(true);
          process.stdin.resume();
          process.stdin.on('keypress', onKeypress);
          render();
        });
        return;
      }

      // Direct number selection 1-3
      if (['1', '2', '3'].includes(keyName)) {
        const idx = parseInt(keyName, 10) - 1;
        const titles = assignment[activePlatform].titles;
        if (idx >= 0 && idx < titles.length) {
          cursorInTitles = idx;
          render();
          return;
        }
      } else if (/^[4-9]$/.test(keyName)) {
        // Feedback for out-of-range number keys
        console.log(chalk.gray('只支持1-3'));
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

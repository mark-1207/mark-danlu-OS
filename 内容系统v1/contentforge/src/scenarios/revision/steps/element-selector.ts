import chalk from 'chalk';
import readline from 'readline';
import { type RevisionSelection, type RevisionElement } from '../../revision/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ElementSelectorResult {
  selections: RevisionSelection[];
  userInstruction: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function consoleClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

// ─── Element metadata ────────────────────────────────────────────────────────

interface ElementMeta {
  key: RevisionElement;
  label: string;
  sublabel: string;
}

const ELEMENTS: ElementMeta[] = [
  { key: 'title', label: '标题', sublabel: 'title' },
  { key: 'hook', label: 'Hook', sublabel: '开头' },
  { key: 'body', label: '正文', sublabel: 'body' },
  { key: 'cta', label: 'CTA', sublabel: '结尾召唤' },
  { key: 'example', label: '案例', sublabel: 'example' },
  { key: 'power-sentence', label: '金句', sublabel: 'power-sentence' },
];

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * TUI element selector for revision workflow.
 *
 * Navigation:
 * - ↑↓  move cursor
 * - 空格 toggle selection
 * - 回车 confirm selections and prompt for free-form instruction
 *
 * Returns { selections: RevisionSelection[], userInstruction: string }
 */
export async function selectRevisionElements(
  platformCount: number = 3,
): Promise<ElementSelectorResult> {
  // Non-TTY fallback — resolve immediately with empty selections
  if (!process.stdin.isTTY) {
    return { selections: [], userInstruction: '' };
  }

  // State
  let cursor = 0;
  const selected = new Set<RevisionElement>();

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  function render(): void {
    consoleClear();
    console.log(chalk.bold('\n╔════════════════════════════════════════╗'));
    console.log(chalk.bold('║') + chalk.cyan.bold('  Revision — 选择要修订的元素        ') + chalk.bold('║'));
    console.log(chalk.bold('╠════════════════════════════════════════╣'));

    for (let i = 0; i < ELEMENTS.length; i++) {
      const el = ELEMENTS[i];
      const isCursor = i === cursor;
      const isSelected = selected.has(el.key);

      const checkbox = isSelected ? chalk.green('×') : chalk.dim(' ');
      const cursorMark = isCursor ? chalk.bgYellow.black('>') + ' ' : '  ';
      const nameStr = isCursor
        ? chalk.white(`${el.label} (${el.sublabel})`)
        : chalk.dim(`${el.label} (${el.sublabel})`);
      const countStr = chalk.dim(`${platformCount}个平台`);

      console.log(
        chalk.bold('║') +
        `  ${cursorMark}${checkbox} ${nameStr}${' '.repeat(Math.max(0, 24 - el.label.length - el.sublabel.length - 4))}${countStr}${' '.repeat(Math.max(0, 8))}` +
        chalk.bold('║'),
      );
    }

    console.log(chalk.bold('╠════════════════════════════════════════╣'));
    console.log(chalk.bold('║') + chalk.dim('  ↑↓ 移动  空格 选中  回车 确认      ') + chalk.bold('║'));
    console.log(chalk.bold('╚════════════════════════════════════════╝'));
  }

  return new Promise((resolve) => {
    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        cleanup();
        // Build selection summary for prompt
        const selSummary = buildSelectionSummary(selected);
        rl.question(chalk.cyan('\n已选中：') + selSummary + chalk.cyan('\n\n请说明要怎么改（直接描述，比如"标题更有冲击力，hook 更短更有劲"）：\n> '), (answer) => {
          const trimmed = answer.trim();
          resolve({
            selections: Array.from(selected).map((el) => ({
              element: el,
              platforms: ['wechat', 'xiaohongshu', 'douyin'] as const,
            })),
            userInstruction: trimmed,
          });
        });
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursor = Math.min(ELEMENTS.length - 1, cursor + 1);
        render();
        return;
      }

      if (keyName === ' ' || keyName === 'space') {
        const el = ELEMENTS[cursor];
        if (selected.has(el.key)) {
          selected.delete(el.key);
        } else {
          selected.add(el.key);
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

    function buildSelectionSummary(selectedSet: Set<RevisionElement>): string {
      const platformLabels: Record<string, string> = {
        wechat: 'wechat',
        xiaohongshu: 'xiaohongshu',
        douyin: 'douyin',
      };
      const parts: string[] = [];
      for (const el of ELEMENTS) {
        if (selectedSet.has(el.key)) {
          const platforms = ['wechat', 'xiaohongshu', 'douyin']
            .map((p) => platformLabels[p])
            .join('、');
          parts.push(`${el.label}(${platforms})`);
        }
      }
      return parts.length > 0 ? parts.join('、') : chalk.dim('无');
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

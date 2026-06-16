import chalk from 'chalk';
import readline from 'readline';
import { type RevisionSelection, type RevisionElement } from '../../revision/types.js';
import { getRevisionSuggestions, formatSuggestions } from './revision-suggestions.js';

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
  key: RevisionElement | 'direct-edit' | 'custom-instruction';
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
  { key: 'direct-edit', label: '直接编辑', sublabel: '选段改字' },
  { key: 'custom-instruction', label: '自定义指令', sublabel: '自由指令' },
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
export async function selectRevisionElements(): Promise<ElementSelectorResult> {
  // Non-TTY fallback — resolve immediately with empty selections
  if (!process.stdin.isTTY) {
    return { selections: [], userInstruction: '' };
  }

  // State
  let cursor = 0;
  const selected = new Set<ELEMENT_KEY>();

  // Union type for all selectable keys
  type ELEMENT_KEY = RevisionElement | 'direct-edit' | 'custom-instruction';

  const rl = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50000 });
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
      const countStr = chalk.dim('3个平台');

      console.log(
        chalk.bold('║') +
        `  ${cursorMark}${checkbox} ${nameStr}${' '.repeat(Math.max(0, 24 - el.label.length - el.sublabel.length - 4))}${countStr}${' '.repeat(Math.max(0, 8))}` +
        chalk.bold('║'),
      );
    }

    console.log(chalk.bold('╠════════════════════════════════════════╣'));
    console.log(chalk.bold('║') + chalk.dim('  ↑↓ 移动  空格 选中  回车 确认      ') + chalk.bold('║'));
    console.log(chalk.bold('╚════════════════════════════════════════╝'));

    // Show suggestions for selected element(s)
    if (selected.size > 0) {
      const firstSelected = Array.from(selected)[0];
      if (firstSelected && ELEMENTS.find(e => e.key === firstSelected)) {
        const el = ELEMENTS.find(e => e.key === firstSelected)!;
        if (el && typeof el.key === 'string') {
          const suggestions = getRevisionSuggestions(el.key as RevisionElement);
          if (suggestions.length > 0) {
            console.log(chalk.bold('\n╔══ 推荐改法 ════════════════════════════╗'));
            console.log(formatSuggestions(suggestions));
            console.log(chalk.bold('╚════════════════════════════════════════╝'));
          }
        }
      }
    }
  }

  return new Promise((resolve) => {
    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        cleanup();

        // Separate normal elements from special types
        const normalSelections = Array.from(selected).filter(
          (el): el is RevisionElement => el !== 'direct-edit' && el !== 'custom-instruction'
        );
        const hasDirectEdit = selected.has('direct-edit');
        const hasCustomInstruction = selected.has('custom-instruction');

        if (normalSelections.length === 0 && !hasDirectEdit && !hasCustomInstruction) {
          resolve({
            selections: [],
            userInstruction: '',
          });
          return;
        }

        // Build selection summary for prompt
        const selSummary = buildSelectionSummary(selected);

        if (hasDirectEdit) {
          // Direct edit mode — return a special marker, handled by caller
          resolve({
            selections: [{ element: 'body', platforms: ['wechat', 'xiaohongshu', 'douyin'] as const }],
            userInstruction: '__DIRECT_EDIT__',
          });
          return;
        }

        let question = '\n已选中：' + selSummary;
        if (hasCustomInstruction) {
          question += chalk.cyan('\n\n请输入修改指令（会应用到所有选中的元素）：\n> ');
        } else {
          question += chalk.cyan('\n\n请说明要怎么改（直接描述，比如"标题更有冲击力，hook 更短更有劲"）：\n> ');
        }

        rl.question(chalk.cyan(question), (answer) => {
          const trimmed = answer.trim();
          resolve({
            selections: normalSelections.map((el) => ({
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

    function buildSelectionSummary(selectedSet: Set<ELEMENT_KEY>): string {
      const parts: string[] = [];
      for (const el of ELEMENTS) {
        if (selectedSet.has(el.key as ELEMENT_KEY)) {
          parts.push(`${el.label}(3平台)`);
        }
      }
      return parts.length > 0 ? parts.join('、') : chalk.dim('无');
    }

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

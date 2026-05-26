import chalk from 'chalk';
import readline from 'readline';
import { isTerminalInteractive } from './interactive.js';
import type { TopicItem } from '../../scenarios/topic-engine/types.js';

function consoleClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

function statusBadge(status: string): string {
  switch (status) {
    case 'new': return chalk.green('●');
    case 'selected': return chalk.blue('◉');
    case 'generated': return chalk.gray('◆');
    case 'dismissed': return chalk.dim('✕');
    default: return chalk.dim('○');
  }
}

export async function browseAndSelectTopics(items: TopicItem[]): Promise<TopicItem | null> {
  if (!isTerminalInteractive()) {
    console.log(chalk.bold('\n📋 选题列表\n'));
    items.forEach((item, i) => {
      const badge = statusBadge(item.status);
      console.log(`  ${String(i + 1).padStart(3)}. ${badge} ${chalk.white(item.title)}`);
      console.log(`       ${chalk.dim(item.source)} | ${chalk.dim(formatDate(item.publishedAt))}`);
    });
    console.log(chalk.dim('\n输入编号选择（0 取消）: '));
    const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
    return new Promise((resolve) => {
      rl.question('', (answer) => {
        rl.close();
        const idx = parseInt(answer, 10) - 1;
        if (idx >= 0 && idx < items.length) {
          resolve(items[idx]);
        } else {
          resolve(null);
        }
      });
    });
  }

  // TTY mode
  let cursor = 0;
  let filterStatus: string | null = null;

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  const visibleItems = (): TopicItem[] =>
    filterStatus ? items.filter((t) => t.status === filterStatus) : items;

  function render(): void {
    consoleClear();
    console.log(chalk.bold('\n📋 选题引擎\n'));
    console.log(chalk.dim(`  总数: ${items.length}  |  按 n:新  s:已选  g:已生成  d:已弃  a:全部\n`));

    const list = visibleItems();
    const start = Math.max(0, cursor - 8);
    const end = Math.min(list.length, start + 16);

    for (let i = start; i < end; i++) {
      const item = list[i];
      const isCursor = i === cursor;
      const prefix = isCursor ? chalk.bgCyan.black(' > ') : '   ';
      const badge = statusBadge(item.status);
      const title = isCursor ? chalk.bold.white(item.title) : chalk.white(item.title);
      const truncTitle = title.length > 55 ? title.slice(0, 52) + '…' : title;
      console.log(`${prefix}${badge} ${truncTitle}`);
      console.log(`       ${chalk.dim(item.source)} | ${chalk.dim(formatDate(item.publishedAt))}`);
    }
    if (end < list.length) {
      console.log(`   ${chalk.dim(`...还有 ${list.length - end} 条`)}`);
    }

    console.log(chalk.dim('\n  ↑↓ 浏览  Enter 选题  d 详情  n/s/g 筛选  a 全部  q 退出\n'));
  }

  return new Promise((resolve) => {
    function onKeypress(_chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? '';
      const list = visibleItems();

      if (keyName === 'up' || keyName === 'k') {
        cursor = Math.max(0, cursor - 1);
      } else if (keyName === 'down' || keyName === 'j') {
        cursor = Math.min(list.length - 1, cursor + 1);
      } else if (keyName === 'return' || keyName === 'enter') {
        if (list[cursor]) {
          cleanup();
          resolve(list[cursor]);
          return;
        }
      } else if (keyName === 'd') {
        if (list[cursor]) {
          cleanup();
          resolve(list[cursor]);
          return;
        }
      } else if (keyName === 'n' || keyName === 's' || keyName === 'g') {
        const map: Record<string, string> = { n: 'new', s: 'selected', g: 'generated' };
        filterStatus = map[keyName] ?? null;
        cursor = 0;
      } else if (keyName === 'a') {
        filterStatus = null;
        cursor = 0;
      } else if (keyName === 'q' || keyName === 'escape') {
        cleanup();
        resolve(null);
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

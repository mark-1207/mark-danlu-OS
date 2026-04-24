import chalk from 'chalk';
import readline from 'readline';
import type { StyleProfile, BlendConfig } from '../types.js';
import { StyleProfileStore } from '../profile-store.js';
import { analyzePersonalStyle } from '../analyzer.js';
import { importExternalStyle } from '../importer.js';
import { blendStyles } from '../blender.js';
import { injectStyle } from '../inject.js';

export interface StyleSelection {
  profile: StyleProfile | null;
  injectResult: { systemPrompt: string; constraints: string[] } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function consoleClear(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function renderHeader(): void {
  console.log(chalk.bold('\n🎨 风格管理\n'));
  console.log('─'.repeat(60));
}

// ─── Main TUI ─────────────────────────────────────────────────────────────────

/**
 * Style TUI — interactive style management menu.
 *
 * Menu:
 * - [1] 分析个人风格
 * - [2] 导入外部风格
 * - [3] 融合风格
 * - [4] 选择已有风格
 * - [0] 跳过
 *
 * Returns StyleSelection { profile, injectResult }
 */
export async function styleTUI(options: {
  stylesDir: string;
  corpusDir: string;
}): Promise<StyleSelection> {
  // Non-TTY fallback — skip style selection
  if (!process.stdin.isTTY) {
    return { profile: null, injectResult: null };
  }

  const store = new StyleProfileStore(options.stylesDir);
  let cursor = 0;
  const menuItems = [
    { key: '1', label: '分析个人风格' },
    { key: '2', label: '导入外部风格' },
    { key: '3', label: '融合风格' },
    { key: '4', label: '选择已有风格' },
    { key: '0', label: '跳过' },
  ];

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  function render(): void {
    consoleClear();
    renderHeader();

    menuItems.forEach((item, idx) => {
      const isCursor = idx === cursor;
      const marker = isCursor ? chalk.bold.yellow('▶') : chalk.dim(' ');
      const label = isCursor ? chalk.bold.cyan(item.label) : chalk.dim(item.label);
      console.log(`${marker} [${item.key}] ${label}`);
    });

    console.log(chalk.dim('\n─'.repeat(60)));
    console.log(chalk.dim('  ↑↓ 选择   回车 确认'));
  }

  return new Promise((resolve) => {
    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        cleanup();
        handleSelect(menuItems[cursor].key, options, store).then(resolve);
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursor = Math.max(0, cursor - 1);
        render();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursor = Math.min(menuItems.length - 1, cursor + 1);
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

// ─── Menu Handlers ─────────────────────────────────────────────────────────────

async function handleSelect(
  key: string,
  options: { stylesDir: string; corpusDir: string },
  store: StyleProfileStore,
): Promise<StyleSelection> {
  switch (key) {
    case '1':
      return handleAnalyzePersonalStyle(options, store);
    case '2':
      return handleImportExternalStyle(options, store);
    case '3':
      return handleBlendStyles(options, store);
    case '4':
      return handleSelectExistingStyle(store);
    case '0':
    default:
      return { profile: null, injectResult: null };
  }
}

async function handleAnalyzePersonalStyle(
  options: { stylesDir: string; corpusDir: string },
  store: StyleProfileStore,
): Promise<StyleSelection> {
  consoleClear();
  console.log(chalk.cyan('  ⏳ 正在分析个人风格...\n'));

  try {
    const profile = await analyzePersonalStyle({
      stylesDir: options.stylesDir,
      corpusDir: options.corpusDir,
    });
    console.log(chalk.green(`  ✓ 风格分析完成: ${profile.name}`));
    const injectResult = injectStyle(profile);
    return { profile, injectResult };
  } catch (err: any) {
    console.error(chalk.red(`  ✗ 分析失败: ${err.message}`));
    return { profile: null, injectResult: null };
  }
}

async function handleImportExternalStyle(
  options: { stylesDir: string; corpusDir: string },
  store: StyleProfileStore,
): Promise<StyleSelection> {
  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  return new Promise((resolve) => {
    rl.question(chalk.cyan('输入文章路径: '), async (articlePath) => {
      rl.question(chalk.cyan('输入风格名称: '), async (name) => {
        rl.close();
        consoleClear();
        console.log(chalk.cyan('  ⏳ 正在导入风格...\n'));

        try {
          const profile = await importExternalStyle({
            stylesDir: options.stylesDir,
            name: name.trim() || 'external',
            articlePath: articlePath.trim(),
          });
          console.log(chalk.green(`  ✓ 导入完成: ${profile.name}`));
          const injectResult = injectStyle(profile);
          resolve({ profile, injectResult });
        } catch (err: any) {
          console.error(chalk.red(`  ✗ 导入失败: ${err.message}`));
          resolve({ profile: null, injectResult: null });
        }
      });
    });
  });
}

async function handleBlendStyles(
  options: { stylesDir: string; corpusDir: string },
  store: StyleProfileStore,
): Promise<StyleSelection> {
  const profiles = await store.list();
  if (profiles.length === 0) {
    console.log(chalk.yellow('  没有可用的风格，请先分析或导入风格'));
    return { profile: null, injectResult: null };
  }

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  return new Promise((resolve) => {
    consoleClear();
    console.log(chalk.bold('\n📋 选择要融合的风格 (最多5个)\n'));

    const selected = new Set<number>();
    let cursor = 0;

    function renderProfiles(): void {
      consoleClear();
      console.log(chalk.bold('\n📋 选择要融合的风格 (按空格选中，回车确认)\n'));

      profiles.forEach((profile, idx) => {
        const isCursor = idx === cursor;
        const isSelected = selected.has(idx);
        const marker = isSelected
          ? chalk.green('✓')
          : isCursor
            ? chalk.bold.yellow('●')
            : chalk.dim('○');
        const cursorMark = isCursor ? chalk.bgYellow.black('>') + ' ' : '  ';
        const label = isSelected ? chalk.bold.green(profile.name) : isCursor ? chalk.bold.cyan(profile.name) : chalk.dim(profile.name);
        const typeTag = chalk.dim(`[${profile.type}]`);
        console.log(`${cursorMark}${marker} ${label} ${typeTag}`);
      });

      console.log(chalk.dim('\n─'.repeat(60)));
      console.log(chalk.dim('  ↑↓ 选择   空格 选中/取消   回车 确认'));
    }

    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        rl.close();
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('keypress', onKeypress);
        handleBlendConfirm(profiles, selected, options).then(resolve);
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursor = Math.max(0, cursor - 1);
        renderProfiles();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursor = Math.min(profiles.length - 1, cursor + 1);
        renderProfiles();
        return;
      }

      if (keyName === ' ' || keyName === 'space') {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else if (selected.size < 5) {
          selected.add(cursor);
        }
        renderProfiles();
        return;
      }

      renderProfiles();
    }

    process.stdin.on('keypress', onKeypress);
    renderProfiles();
  });
}

async function handleBlendConfirm(
  profiles: StyleProfile[],
  selected: Set<number>,
  options: { stylesDir: string; corpusDir: string },
): Promise<StyleSelection> {
  const selectedProfiles = Array.from(selected).map((i) => profiles[i]);
  if (selectedProfiles.length < 2) {
    console.log(chalk.yellow('  需要至少2个风格才能融合'));
    return { profile: null, injectResult: null };
  }

  consoleClear();
  console.log(chalk.cyan('  ⏳ 正在融合风格...\n'));

  const ratio = 1 / selectedProfiles.length;
  const config: BlendConfig = {
    sources: selectedProfiles.map((p) => ({ profileName: p.name, ratio })),
    resultName: `blend-${Date.now()}`,
  };

  try {
    const result = await blendStyles(options.stylesDir, config);
    console.log(chalk.green(`  ✓ 融合完成: ${result.profile.name}`));
    console.log(chalk.dim(`  ${result.preview}`));
    const injectResult = injectStyle(result.profile);
    return { profile: result.profile, injectResult };
  } catch (err: any) {
    console.error(chalk.red(`  ✗ 融合失败: ${err.message}`));
    return { profile: null, injectResult: null };
  }
}

async function handleSelectExistingStyle(store: StyleProfileStore): Promise<StyleSelection> {
  const profiles = await store.list();
  if (profiles.length === 0) {
    console.log(chalk.yellow('  没有已存储的风格'));
    return { profile: null, injectResult: null };
  }

  const rl = readline.createInterface({ input: process.stdin, escapeCommandTimeout: 50000 });
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode?.(true);

  return new Promise((resolve) => {
    let cursor = 0;

    function renderProfiles(): void {
      consoleClear();
      console.log(chalk.bold('\n📋 选择已有风格\n'));

      profiles.forEach((profile, idx) => {
        const isCursor = idx === cursor;
        const marker = isCursor ? chalk.bold.yellow('●') : chalk.dim('○');
        const cursorMark = isCursor ? chalk.bgYellow.black('>') + ' ' : '  ';
        const label = isCursor ? chalk.bold.cyan(profile.name) : chalk.dim(profile.name);
        const typeTag = chalk.dim(`[${profile.type}]`);
        console.log(`${cursorMark}${marker} ${label} ${typeTag}`);
      });

      console.log(chalk.dim('\n─'.repeat(60)));
      console.log(chalk.dim('  ↑↓ 选择   回车 确认   0 返回'));
    }

    function onKeypress(chunk: Buffer | string, key?: readline.Key) {
      const keyName = key?.name ?? (typeof chunk === 'string' ? chunk : chunk.toString());

      if (keyName === 'return' || keyName === 'enter') {
        rl.close();
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('keypress', onKeypress);
        const profile = profiles[cursor];
        console.log(chalk.green(`  ✓ 已选择: ${profile.name}`));
        const injectResult = injectStyle(profile);
        resolve({ profile, injectResult });
        return;
      }

      if (keyName === '0') {
        rl.close();
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('keypress', onKeypress);
        resolve({ profile: null, injectResult: null });
        return;
      }

      if (keyName === 'up' || keyName === 'k') {
        cursor = Math.max(0, cursor - 1);
        renderProfiles();
        return;
      }

      if (keyName === 'down' || keyName === 'j') {
        cursor = Math.min(profiles.length - 1, cursor + 1);
        renderProfiles();
        return;
      }

      renderProfiles();
    }

    process.stdin.on('keypress', onKeypress);
    renderProfiles();
  });
}

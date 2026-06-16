// Direct-edit TUI — paragraph-level inline editing

import chalk from 'chalk';
import readline from 'readline';

/**
 * Interactive paragraph-level editor.
 *
 * Flow:
 * 1. Split article into paragraphs (blank-line separated)
 * 2. Display numbered list, user picks one to edit
 * 3. Present current text as editable prompt (pre-filled)
 * 4. User types new text (or keeps original)
 * 5. Return updated content
 *
 * Returns { updatedContent, editedParagraph }
 */
export async function directEditParagraphs(
  content: string,
  platform: string = 'wechat',
): Promise<{ updatedContent: string; editedParagraph: string }> {
  if (!process.stdin.isTTY) {
    // Non-interactive fallback: return unchanged
    return { updatedContent: content, editedParagraph: '' };
  }

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) {
    return { updatedContent: content, editedParagraph: '' };
  }

  console.log(chalk.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold('║') + chalk.cyan.bold('  直接编辑 — 选择要修改的段落          ') + chalk.bold('║'));
  console.log(chalk.bold('╚════════════════════════════════════════╝'));

  // Show paragraphs with numbers
  for (let i = 0; i < paragraphs.length; i++) {
    const preview = paragraphs[i].replace(/\n/g, ' ').slice(0, 60);
    const ellipsis = paragraphs[i].length > 60 ? '…' : '';
    console.log(`  [${i + 1}] ${chalk.dim(preview + ellipsis)}`);
  }
  console.log('');
  console.log(chalk.dim('  [0] 取消，不做修改'));
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const selected = await new Promise<number>((resolve) => {
    rl.question(chalk.cyan('选择要编辑的段落编号: '), (answer) => {
      const num = parseInt(answer.trim(), 10);
      resolve(num);
    });
  });

  if (selected === 0 || isNaN(selected) || selected < 1 || selected > paragraphs.length) {
    rl.close();
    return { updatedContent: content, editedParagraph: '' };
  }

  const idx = selected - 1;
  const original = paragraphs[idx];

  console.log(chalk.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold('║') + chalk.yellow.bold('  当前内容                              ') + chalk.bold('║'));
  console.log(chalk.bold('╚════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim(original.split('\n').map((l) => '  ' + l).join('\n')));
  console.log('');
  console.log(chalk.bold('╔════════════════════════════════════════╗'));
  console.log(chalk.bold('║') + chalk.green.bold('  输入新的内容（直接回车保持不变）      ') + chalk.bold('║'));
  console.log(chalk.bold('╚════════════════════════════════════════╝'));

  const newText = await new Promise<string>((resolve) => {
    rl.question(chalk.cyan('\n新内容:\n> '), (answer) => {
      resolve(answer.trim());
    });
  });

  rl.close();

  if (!newText) {
    return { updatedContent: content, editedParagraph: '' };
  }

  paragraphs[idx] = newText;
  const updatedContent = paragraphs.join('\n\n');

  return { updatedContent, editedParagraph: original };
}
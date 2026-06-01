/**
 * Opinion-review UI: user confirms refined opinion, selects/inputs title, injects personal case.
 */
import { createInterface } from 'readline';
import chalk from 'chalk';
import { isTerminalInteractive } from '../../../cli/ui/interactive.js';
import type { RefinedOpinion, ConfirmedOpinion } from '../types.js';

async function ask(question: string, fallback = ''): Promise<string> {
  if (!isTerminalInteractive()) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

async function askChoice(question: string, options: string[]): Promise<number> {
  if (!isTerminalInteractive()) return Promise.resolve(0);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(question);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    rl.question(chalk.cyan('选择: '), (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      resolve(Number.isNaN(idx) ? 0 : Math.max(0, Math.min(idx, options.length - 1)));
    });
  });
}

function hkrLabel(score: number): string {
  if (score >= 80) return chalk.green(`${score}/100`);
  if (score >= 60) return chalk.yellow(`${score}/100`);
  return chalk.red(`${score}/100`);
}

export interface OpinionReviewResult {
  confirmed: ConfirmedOpinion;
  regenerate: boolean;
}

/**
 * Show refined opinion, get user confirmation, title selection, and personal case.
 */
export async function confirmOpinion(
  refined: RefinedOpinion,
  platform = 'wechat',
): Promise<OpinionReviewResult> {
  console.log(chalk.bold('\n=== 观点锤炼结果 ===\n'));

  // HKR Scores
  console.log(chalk.bold('【HKR 质检】'));
  console.log(
    `  Happy（悬念感）:   ${hkrLabel(refined.hkrScore.h)} ${refined.hkrFeedback?.h ? `— ${refined.hkrFeedback.h}` : ''}`
  );
  console.log(
    `  Knowledge（信息量）: ${hkrLabel(refined.hkrScore.k)} ${refined.hkrFeedback?.k ? `— ${refined.hkrFeedback.k}` : ''}`
  );
  console.log(
    `  Resonance（共鸣感）: ${hkrLabel(refined.hkrScore.r)} ${refined.hkrFeedback?.r ? `— ${refined.hkrFeedback.r}` : ''}`
  );

  // Refined thesis
  console.log(chalk.bold('\n【核心论点（已锤炼）】'));
  console.log(chalk.cyan(`  ${refined.refinedThesis}`));

  // Boundaries
  if (refined.boundaries) {
    console.log(chalk.bold('\n【适用边界】'));
    console.log(`  ${refined.boundaries}`);
  }

  // Recommended titles
  const titleOptions = refined.recommendedTitles.slice(0, 5);
  console.log(chalk.bold(`\n【推荐标题】（选一个或自己写）`));
  const selectedTitleIdx = await askChoice(
    chalk.cyan('选择标题（直接回车用第1个）:\n'),
    titleOptions
  );
  let customTitle = '';
  console.log();
  const customInput = await ask(
    chalk.cyan(`自定义标题（直接回车用推荐）: `),
    ''
  );
  if (customInput.trim()) {
    customTitle = customInput.trim();
  }

  const confirmedTitle = customTitle || titleOptions[selectedTitleIdx] || refined.recommendedTitles[0];

  // Personal case
  console.log();
  const personalCase = await ask(
    chalk.cyan('是否有真实经历/案例要注入？（直接回车跳过，输入内容并回车确认）: '),
    ''
  );

  // Ask if user wants to regenerate
  console.log();
  const wantsRegen = await ask(
    chalk.yellow('是否重新生成锤炼结果？(y: 重新生成，其他键继续): '),
    'n'
  );

  return {
    confirmed: {
      refinedThesis: refined.refinedThesis,
      confirmedTitle,
      opinionType: refined.type,
      personalCase: personalCase.trim(),
      seedMaterial: '',
    },
    regenerate: wantsRegen.toLowerCase() === 'y',
  };
}

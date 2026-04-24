import { createInterface } from 'readline';

/**
 * Interactive selection prompt using readline.
 */
export async function interactiveSelect<T>(
  message: string,
  options: Array<{ label: string; value: T }>,
): Promise<T> {
  console.log(`\n${message}\n`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  [${i + 1}] ${options[i].label}`);
  }
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise<T>((resolve) => {
    rl.question('请选择 (输入数字): ', (answer) => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < options.length) {
        resolve(options[index].value);
      } else {
        resolve(options[0].value);
      }
    });
  });
}

export type RevisionChoice = 'accept' | 'revise' | 'abort';

/**
 * Ask user if they are satisfied with the generated content and want to proceed
 * to review, revise, or abort.
 */
export async function confirmRevision(): Promise<RevisionChoice> {
  console.log('\n这版满意吗？\n');
  console.log('  [1] ✓ 满意，进入审查');
  console.log('  [2] ↺ 修订一下（r）');
  console.log('  [3] ✗ 不满意，退出');
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise<RevisionChoice>((resolve) => {
    rl.question('请选择 (输入数字): ', (answer) => {
      rl.close();
      const index = parseInt(answer, 10) - 1;
      // 0 = accept, 1 = revise, 2 = abort
      if (index === 0) {
        resolve('accept');
      } else if (index === 1) {
        resolve('revise');
      } else if (index === 2) {
        resolve('abort');
      } else {
        resolve('accept'); // default
      }
    });
  });
}

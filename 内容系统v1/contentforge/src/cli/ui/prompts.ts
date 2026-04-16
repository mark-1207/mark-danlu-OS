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

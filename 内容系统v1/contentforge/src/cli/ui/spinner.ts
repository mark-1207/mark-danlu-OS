import ora, { type Ora } from 'ora';

/**
 * Lightweight spinner wrapper.
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    spinner: 'dots',
  }).start();
}

export { ora };

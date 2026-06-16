/**
 * Shared TTY/interactive detection.
 *
 * Centralizes `process.stdin.isTTY` checks so that the two-phase protocol
 * (Phase 1 outline → Claude Code confirmation → Phase 2 content) and the
 * legacy inline-TUI path can coexist without duplicating logic.
 */

export function isTerminalInteractive(): boolean {
  // Force interactive mode via environment variable (for Claude Code or non-TTY environments)
  if (process.env.FORCE_INTERACTIVE === '1') return true;
  return process.stdin.isTTY === true;
}

/**
 * Read pre-collected user input from a JSON file (for non-TTY environments).
 * File format: { "answers": ["answer1", "answer2", ...] }
 */
let cachedAnswers: string[] = [];
let answerIndex = 0;

function loadAnswers(): string[] {
  if (cachedAnswers.length > 0) return cachedAnswers;
  const filePath = process.env.INTERACTIVE_INPUT_FILE;
  if (!filePath) return cachedAnswers;
  try {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    cachedAnswers = data.answers || [];
  } catch {
    // ignore
  }
  return cachedAnswers;
}

export function getNextAnswer(): string | null {
  const answers = loadAnswers();
  if (answerIndex < answers.length) {
    return answers[answerIndex++];
  }
  return null;
}

export function resetAnswerIndex(): void {
  answerIndex = 0;
}

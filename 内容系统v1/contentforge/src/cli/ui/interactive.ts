/**
 * Shared TTY/interactive detection.
 *
 * Centralizes `process.stdin.isTTY` checks so that the two-phase protocol
 * (Phase 1 outline → Claude Code confirmation → Phase 2 content) and the
 * legacy inline-TUI path can coexist without duplicating logic.
 */

export function isTerminalInteractive(): boolean {
  return process.stdin.isTTY === true;
}

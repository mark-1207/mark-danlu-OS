import { interactiveSelect } from './prompts.js';

export type DisambiguationChoice = 'opinion' | 'explore';

/**
 * Ask the user whether they want to write from a strong opinion or explore the topic.
 *
 * Returns:
 * - 'opinion' — user wants to write from a personal opinion (runs OpinionRefineStep)
 * - 'explore' — standard create flow (TopicAssignment → outlines → content)
 *
 * Default (empty input or invalid): 'explore' (safer fallback).
 */
export async function askDisambiguation(): Promise<DisambiguationChoice> {
  return interactiveSelect<DisambiguationChoice>(
    '你想要从什么角度展开？',
    [
      { label: '🎯 观点输出 — 我对这事有明确看法，要用这个观点写', value: 'opinion' },
      { label: '🔍 探索生成 — 我还没想清楚，让 AI 帮我分析展开', value: 'explore' },
    ],
  );
}

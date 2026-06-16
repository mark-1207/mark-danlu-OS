import { logger } from './logger.js';

/**
 * Safely parse JSON from LLM output.
 * LLM output often contains markdown code blocks or trailing text.
 * Strategy: direct parse → extract code block → regex extract → throw
 */
export function safeJsonParse<T>(text: string, context = 'JSON'): T {
  // Strategy 1: direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    // not fatal, try next strategy
  }

  // Strategy 2: extract from ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // not fatal, try next strategy
    }
  }

  // Strategy 3: regex extract first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // not fatal, try next strategy
    }
  }

  logger.error(`Failed to parse ${context} after all strategies`, { text: text.slice(0, 200) });
  throw new Error(`Invalid ${context} output: unable to parse as JSON`);
}

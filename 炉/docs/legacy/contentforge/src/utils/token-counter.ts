/**
 * Token counting using tiktoken (cl100k_base encoding).
 *
 * cl100k_base is used by: GPT-4, Claude, Kimi, OpenAI models.
 * Falls back to character-based approximation if tiktoken fails to initialize.
 *
 * Note: Output token counts from LLM provider responses are accurate (from API metadata).
 *       Input token counts use tiktoken (this module) for accuracy.
 */
import { get_encoding } from 'tiktoken';

type TiktokenEncoder = ReturnType<typeof get_encoding>;

let _encoder: TiktokenEncoder | null = null;

/**
 * Initialize the tiktoken encoder (call once at app startup).
 * Idempotent — subsequent calls are no-ops.
 */
export async function initTokenizer(): Promise<void> {
  if (!_encoder) {
    _encoder = get_encoding('cl100k_base');
  }
}

/**
 * Estimate tokens for a text string.
 * Uses tiktoken for accurate counting, falls back to char approximation.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  if (!_encoder) {
    // Fallback to character approximation when encoder not initialized
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  }
  return _encoder.encode(text).length;
}

/**
 * Estimate cost based on token usage and pricing.
 * Pricing is per million tokens.
 *
 * NOTE: Output token counts from LLM responses are accurate (API metadata).
 *       Input token counts use tiktoken (accurate when initialized).
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion = 3.0,   // Claude Sonnet input
  outputPricePerMillion = 15.0,  // Claude Sonnet output
): number {
  return (inputTokens / 1_000_000) * inputPricePerMillion + (outputTokens / 1_000_000) * outputPricePerMillion;
}

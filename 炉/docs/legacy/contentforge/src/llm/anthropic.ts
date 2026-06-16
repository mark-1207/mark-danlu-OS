import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequestOptions, LLMResponse } from './types.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  constructor(private apiKey: string) {}

  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    const client = new Anthropic({ apiKey: this.apiKey });

    // Separate system message from others
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

    return withRetry(async () => {
      const response = await client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system: systemPrompt || undefined,
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';

      return {
        content: text,
        tokenUsage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        model: response.model,
        finishReason: response.stop_reason ?? 'end_turn',
      };
    }, {}, `Anthropic chat(${options.model})`);
  }
}

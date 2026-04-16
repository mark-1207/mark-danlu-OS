import OpenAI from 'openai';
import type { LLMProvider, LLMRequestOptions, LLMResponse } from './types.js';
import { withRetry } from '../utils/retry.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';

  constructor(private apiKey: string, private baseUrl?: string) {
    // nothing
  }

  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });

    return withRetry(async () => {
      const response = await client.chat.completions.create({
        model: options.model,
        messages: options.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        // OpenAI supports response_format for JSON mode
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content ?? '',
        tokenUsage: {
          input: response.usage?.prompt_tokens ?? 0,
          output: response.usage?.completion_tokens ?? 0,
        },
        model: response.model,
        finishReason: choice.finish_reason ?? 'stop',
      };
    }, {}, `OpenAI chat(${options.model})`);
  }
}

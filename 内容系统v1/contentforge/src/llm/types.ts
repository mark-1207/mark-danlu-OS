/**
 * LLM type definitions
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Force JSON output (if provider supports) */
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  tokenUsage: {
    input: number;
    output: number;
  };
  model: string;
  finishReason: string;
}

export interface LLMProvider {
  name: string;
  chat(options: LLMRequestOptions): Promise<LLMResponse>;
}

export type { LLMProvider, LLMRequestOptions, LLMResponse } from '../../llm/types.js';

export interface TextLLMRouterConfig {
  providers: string[];
  maxErrorsPerProvider?: number;
}

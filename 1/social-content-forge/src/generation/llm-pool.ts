import { LLMCall } from '../types';

export interface LLMConfig {
  name: string;
  strengths: string[];
  maxRetries: number;
  apiKey: string;
}

export const LLM_POOL: LLMConfig[] = [
  {
    name: 'claude',
    strengths: ['深度长文', '个人洞察', '反常识观点'],
    maxRetries: 1,
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  {
    name: 'gpt',
    strengths: ['结构清晰', '实操指南', '叙事完整'],
    maxRetries: 1,
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  {
    name: 'deepseek',
    strengths: ['快速生成', '观点鲜明', '效率高'],
    maxRetries: 1,
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  },
];

export class LLMPool {
  private currentIndex: number = 0;
  private retryCounters: Map<string, number> = new Map();

  constructor(private llmCall: LLMCall) {}

  /**
   * Get next available LLM
   */
  getNext(): LLMConfig | null {
    if (this.currentIndex >= LLM_POOL.length) {
      return null;
    }
    return LLM_POOL[this.currentIndex];
  }

  /**
   * Move to next LLM in pool
   */
  next(): void {
    this.currentIndex++;
    this.retryCounters.clear(); // Reset retry counters when switching LLMs
  }

  /**
   * Reset pool to beginning
   */
  reset(): void {
    this.currentIndex = 0;
    this.retryCounters.clear();
  }

  /**
   * Get retry count for current LLM
   */
  getRetryCount(): number {
    return this.retryCounters.get(LLM_POOL[this.currentIndex]?.name) || 0;
  }

  /**
   * Increment retry count
   */
  incrementRetry(): number {
    const llmName = LLM_POOL[this.currentIndex]?.name;
    if (llmName) {
      const current = this.retryCounters.get(llmName) || 0;
      this.retryCounters.set(llmName, current + 1);
      return current + 1;
    }
    return 0;
  }

  /**
   * Check if current LLM has retries remaining
   */
  hasRetries(): boolean {
    const llm = LLM_POOL[this.currentIndex];
    if (!llm) return false;
    return this.getRetryCount() < llm.maxRetries;
  }

  /**
   * Get current LLM name
   */
  getCurrentName(): string | null {
    return LLM_POOL[this.currentIndex]?.name || null;
  }
}

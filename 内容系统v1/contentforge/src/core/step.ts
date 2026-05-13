import { z } from 'zod';
import type { PipelineContext, StepResult } from './context.js';
import type { LLMProvider } from '../llm/types.js';
import { safeJsonParse } from '../utils/json-parser.js';
import { logger } from '../utils/logger.js';

export interface StepConfig {
  name: string;
  description: string;
  /** The LLM provider key to use */
  providerKey?: string;
  /** Override model */
  model?: string;
  /** Temperature */
  temperature?: number;
  /** Max output tokens */
  maxTokens?: number;
  /** Can this step be skipped? */
  optional?: boolean;
  /** Number of retries on failure */
  retries?: number;
}

/**
 * Base class for all pipeline steps.
 * Handles LLM calls, retries, output validation, and error handling.
 */
export abstract class PipelineStep<TInput = unknown, TOutput = unknown> {
  abstract config: StepConfig;
  abstract inputSchema: z.ZodType<TInput>;
  abstract outputSchema: z.ZodType<TOutput>;

  /** Stores the last LLM call's token usage for retrieval after doExecute */
  protected lastTokenUsage = { input: 0, output: 0 };

  constructor(
    protected provider: LLMProvider,
    protected defaultModel: string,
  ) {}

  /**
   * Execute this step with the given input and context.
   * Handles retries and validation — subclasses only need to implement doExecute.
   */
  async execute(input: TInput, context: PipelineContext): Promise<StepResult<TOutput>> {
    const startTime = Date.now();
    const retries = this.config.retries ?? 1;
    let lastError: unknown;
    let rawResult: TOutput | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Validate input
        const validatedInput = this.inputSchema.parse(input);

        // Execute
        const result = await this.doExecute(validatedInput, context);
        rawResult = result;

        // Validate output
        const validatedOutput = this.outputSchema.parse(result);

        const durationMs = Date.now() - startTime;
        const tokenUsage = this.lastTokenUsage;

        logger.info(`[Step:${this.config.name}] completed in ${durationMs}ms`, {
          attempt: attempt + 1,
          durationMs,
        });

        return {
          success: true,
          data: validatedOutput,
          tokenUsage,
          durationMs,
        };
      } catch (error) {
        lastError = error;

        if (error instanceof z.ZodError) {
          if (attempt < retries) {
            logger.warn(`[Step:${this.config.name}] output validation failed, retry ${attempt + 1}/${retries}`, {
              errors: error.errors.slice(0, 3),
            });
            continue;
          } else {
            logger.warn(`[Step:${this.config.name}] output validation failed after all retries, using raw output`, {
              errors: error.errors.slice(0, 3),
            });
            // Return partial success with raw data so downstream steps can use it
            return {
              success: true,
              data: rawResult,
              warning: 'Partial validation failure',
              tokenUsage: { input: 0, output: 0 },
              durationMs: Date.now() - startTime,
            };
          }
        }

        // Non-validation error — retry with backoff
        if (attempt < retries) {
          const delay = 1000 * Math.pow(2, attempt);
          logger.warn(`[Step:${this.config.name}] failed, retry ${attempt + 1}/${retries} after ${delay}ms`, {
            error: String(error),
          });
          await sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: String(lastError),
      tokenUsage: { input: 0, output: 0 },
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Subclasses implement this to perform the actual step logic.
   * Return value is raw — validation happens in execute().
   */
  protected abstract doExecute(input: TInput, context: PipelineContext): Promise<TOutput>;

  /**
   * Call the LLM with messages and return the response content.
   * Subclasses can use this for JSON responses.
   */
  protected async callLLM(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { jsonMode?: boolean },
  ): Promise<{ content: string; tokenUsage: { input: number; output: number } }> {
    const model = this.config.model ?? this.defaultModel;

    const response = await this.provider.chat({
      model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      jsonMode: options?.jsonMode,
    });

    // Store for retrieval after doExecute completes
    this.lastTokenUsage = response.tokenUsage;

    return {
      content: response.content,
      tokenUsage: response.tokenUsage,
    };
  }

  /**
   * Call LLM and parse response as JSON.
   * Handles safe parsing with retry hints.
   */
  protected async callLLMJson<T>(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<T> {
    const { content, tokenUsage } = await this.callLLM(messages, { jsonMode: true });

    // Store token usage in context (will be stored by execute())
    const result: { content: string; tokenUsage: { input: number; output: number } } = {
      content,
      tokenUsage,
    };

    try {
      return safeJsonParse<T>(content, this.config.name);
    } catch {
      // Retry with format hint
      const hintMessage: typeof messages = [
        ...messages,
        { role: 'user', content: '\n\nReminder: Please respond with ONLY valid JSON, no markdown code blocks or extra text.' },
      ];

      const retryResponse = await this.callLLM(hintMessage, { jsonMode: true });
      return safeJsonParse<T>(retryResponse.content, this.config.name);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

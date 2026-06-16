import { loadConfig } from '../config/loader.js';
import { llmFactory } from '../llm/factory.js';
import { logger } from '../utils/logger.js';

const PRIMARY = process.env.DEFAULT_PROVIDER ?? 'openai';
const FALLBACK = process.env.FALLBACK_PROVIDER ?? 'kimi';

async function initProviders(): Promise<void> {
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
}

let initDone = false;
async function ensureInit(): Promise<void> {
  if (!initDone) {
    await initProviders();
    initDone = true;
  }
}

/**
 * Call LLM with automatic primary → fallback on failure.
 * model override:
 *   - 'light'  → use light model (mimo-v2-flash)
 *   - 'heavy'  → use heavy model (mimo-v2-pro) — primary Xiaomi provider
 *   - string    → use that exact model name
 *   - undefined → use provider default
 */
export async function callWithFallback(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    model?: 'light' | 'heavy' | string;
  }
): Promise<string> {
  await ensureInit();

  const primaryConfig = llmFactory.getConfig(PRIMARY);
  const fallbackProvider = llmFactory.get(FALLBACK);
  const fallbackConfig = llmFactory.getConfig(FALLBACK);

  // Resolve model
  let primaryModel: string;
  let fallbackModel = fallbackConfig.defaultModel;

  const modelHint = options?.model;
  if (modelHint === 'heavy') {
    primaryModel = 'mimo-v2-pro';
  } else if (modelHint === 'light' || modelHint === undefined) {
    primaryModel = modelHint === 'light'
      ? (process.env.MIMO_MODEL_LIGHT ?? primaryConfig.defaultModel)
      : primaryConfig.defaultModel;
  } else {
    primaryModel = modelHint;
  }

  const primaryName = modelHint === 'heavy' ? 'xiaomi' : PRIMARY;
  const activePrimaryProvider = llmFactory.get(primaryName);

  const tryCall = (provider: typeof activePrimaryProvider, model: string) =>
    provider.chat({
      model,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      jsonMode: options?.jsonMode,
    });

  try {
    const resp = await tryCall(activePrimaryProvider, primaryModel);
    return resp.content;
  } catch (primaryErr) {
    logger.warn(`Primary ${primaryName}(${primaryModel}) failed: ${primaryErr}, falling back to ${FALLBACK}(${fallbackModel})`);
    try {
      const resp = await tryCall(fallbackProvider, fallbackModel);
      return resp.content;
    } catch (fallbackErr) {
      throw new Error(`Both providers failed. Primary ${primaryName}: ${primaryErr}. Fallback: ${fallbackErr}`);
    }
  }
}

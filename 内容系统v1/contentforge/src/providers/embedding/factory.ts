import type { EmbeddingProvider } from './types.js';
import { TavilyEmbeddingProvider } from './implementations/tavily.js';
import { GoogleEmbeddingProvider } from './implementations/google.js';
import { OpenAIEmbeddingProvider } from './implementations/openai.js';
import { ZhipuEmbeddingProvider } from './implementations/zhipu.js';
import { EmbeddingRouter } from './router.js';

export type EmbeddingProviderType = 'tavily' | 'google' | 'openai' | 'zhipu';

export interface EmbeddingFactoryConfig {
  primary?: EmbeddingProviderType;
  fallback?: EmbeddingProviderType;
  tavilyApiKey?: string;
  googleApiKey?: string;
  openaiApiKey?: string;
  zhipuApiKey?: string;
}

export class EmbeddingFactory {
  private providers = new Map<EmbeddingProviderType, EmbeddingProvider>();

  constructor(config: EmbeddingFactoryConfig) {
    if (config.zhipuApiKey) {
      this.providers.set('zhipu', new ZhipuEmbeddingProvider(config.zhipuApiKey));
    }
    if (config.openaiApiKey) {
      this.providers.set('openai', new OpenAIEmbeddingProvider(config.openaiApiKey));
    }
    if (config.tavilyApiKey) {
      this.providers.set('tavily', new TavilyEmbeddingProvider(config.tavilyApiKey));
    }
    if (config.googleApiKey) {
      this.providers.set('google', new GoogleEmbeddingProvider(config.googleApiKey));
    }
  }

  getPrimary(): EmbeddingProvider {
    const p = this.providers.get('zhipu') ?? this.providers.get('openai') ?? this.providers.get('tavily') ?? this.providers.get('google');
    if (!p) throw new Error('No embedding provider available. Set ZHIPU_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, or GOOGLE_EMBEDDING_API_KEY.');
    return p;
  }

  getFallback(): EmbeddingProvider {
    const zhipu = this.providers.get('zhipu');
    const openai = this.providers.get('openai');
    const tavily = this.providers.get('tavily');
    const google = this.providers.get('google');
    const p = google ?? tavily ?? openai ?? zhipu;
    if (!p) throw new Error('No embedding provider available.');
    return p;
  }

  createRouter(): EmbeddingRouter {
    return new EmbeddingRouter(this.getPrimary(), this.getFallback());
  }
}

let _instance: EmbeddingRouter | null = null;

export function initEmbeddingFactory(config: EmbeddingFactoryConfig): void {
  const factory = new EmbeddingFactory(config);
  _instance = factory.createRouter();
}

export function getEmbeddingRouter(): EmbeddingRouter {
  if (!_instance) {
    const factory = new EmbeddingFactory({
      zhipuApiKey: process.env.ZHIPU_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      googleApiKey: process.env.GOOGLE_EMBEDDING_API_KEY ?? process.env.GEMINI_API_KEY,
    });
    _instance = factory.createRouter();
  }
  return _instance;
}

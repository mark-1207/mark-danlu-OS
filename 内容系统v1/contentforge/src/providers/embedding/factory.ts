import type { EmbeddingProvider } from './types.js';
import { TavilyEmbeddingProvider } from './implementations/tavily.js';
import { GoogleEmbeddingProvider } from './implementations/google.js';
import { EmbeddingRouter } from './router.js';

export type EmbeddingProviderType = 'tavily' | 'google';

export interface EmbeddingFactoryConfig {
  primary?: EmbeddingProviderType;
  fallback?: EmbeddingProviderType;
  tavilyApiKey?: string;
  googleApiKey?: string;
}

export class EmbeddingFactory {
  private providers = new Map<EmbeddingProviderType, EmbeddingProvider>();

  constructor(config: EmbeddingFactoryConfig) {
    if (config.tavilyApiKey) {
      this.providers.set('tavily', new TavilyEmbeddingProvider(config.tavilyApiKey));
    }
    if (config.googleApiKey) {
      this.providers.set('google', new GoogleEmbeddingProvider(config.googleApiKey));
    }
  }

  getPrimary(): EmbeddingProvider {
    const p = this.providers.get('tavily');
    if (!p) throw new Error('No primary embedding provider available. Set TAVILY_API_KEY.');
    return p;
  }

  getFallback(): EmbeddingProvider {
    const p = this.providers.get('google');
    if (!p) throw new Error('No fallback embedding provider available. Set GOOGLE_EMBEDDING_API_KEY.');
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
      tavilyApiKey: process.env.TAVILY_API_KEY,
      googleApiKey: process.env.GOOGLE_EMBEDDING_API_KEY ?? process.env.GEMINI_API_KEY,
    });
    _instance = factory.createRouter();
  }
  return _instance;
}

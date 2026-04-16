import { describe, it, expect, vi } from 'vitest';
import { LLMProviderFactory } from '../../src/llm/factory.js';
import { AnthropicProvider } from '../../src/llm/anthropic.js';
import { OpenAIProvider } from '../../src/llm/openai.js';

describe('LLMProviderFactory', () => {
  it('registers and retrieves an anthropic provider', () => {
    const factory = new LLMProviderFactory();
    factory.register('anthropic', {
      type: 'anthropic',
      apiKey: 'test-key',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    const provider = factory.get('anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('registers and retrieves an openai provider', () => {
    const factory = new LLMProviderFactory();
    factory.register('openai', {
      type: 'openai',
      apiKey: 'test-key',
      defaultModel: 'gpt-4o',
    });

    const provider = factory.get('openai');
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('throws when getting unregistered provider', () => {
    const factory = new LLMProviderFactory();
    expect(() => factory.get('nonexistent')).toThrow();
  });

  it('skips registration when api key is missing', () => {
    const factory = new LLMProviderFactory();
    delete process.env.ANTHROPIC_API_KEY;
    // Does not throw, just warns and skips
    factory.register('anthropic', { type: 'anthropic', defaultModel: 'claude-sonnet-4-20250514' });
    // Provider is not registered, so get() throws
    expect(() => factory.get('anthropic')).toThrow(/not found/i);
  });

  it('returns provider config with correct fields', () => {
    const factory = new LLMProviderFactory();
    factory.register('anthropic', { type: 'anthropic', apiKey: 'secret-key', defaultModel: 'claude' });
    const config = factory.getConfig('anthropic');
    expect(config.defaultModel).toBe('claude');
    expect(config.type).toBe('anthropic');
  });
});

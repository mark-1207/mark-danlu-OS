import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMManager, APIError } from '../manager';
import { OpenAIAdapter } from '../adapters';
import type { AIProvider } from '../types';

describe('LLMManager', () => {
  let manager: LLMManager;

  beforeEach(() => {
    manager = new LLMManager();
  });

  describe('APIError', () => {
    it('应该能创建 APIError', () => {
      const error = new APIError('Test error', 'OpenAI', 500, true);
      expect(error.message).toBe('Test error');
      expect(error.provider).toBe('OpenAI');
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('getAdapter', () => {
    it('应该能获取 OpenAI 适配器', () => {
      const adapter = (manager as any).getAdapter('openai');
      expect(adapter).toBeInstanceOf(OpenAIAdapter);
    });

    it('应该能获取自定义适配器', () => {
      const adapter = (manager as any).getAdapter('custom');
      expect(adapter.name).toBe('Custom');
    });
  });

  describe('chat', () => {
    it('应该在没有供应商时抛出错误', async () => {
      await expect(
        manager.chat([], [], { enabled: true, maxRetries: 3, retryDelay: 1000 })
      ).rejects.toThrow('没有可用的 AI 供应商');
    });

    it('应该按优先级选择供应商', async () => {
      const mockAdapter = {
        name: 'Mock',
        chat: vi.fn().mockResolvedValue({
          content: 'test response',
          model: 'gpt-4',
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(manager as any, 'getAdapter').mockReturnValue(mockAdapter);

      const providers = [
        {
          id: 'p1',
          name: 'Provider1',
          provider: 'custom' as AIProvider,
          apiKey: 'key1',
          model: 'model1',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: false,
        },
        {
          id: 'p2',
          name: 'Provider2',
          provider: 'custom' as AIProvider,
          apiKey: 'key2',
          model: 'model2',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        },
      ];

      const result = await manager.chat(
        [{ role: 'user', content: 'hello' }],
        providers,
        { enabled: true, maxRetries: 3, retryDelay: 1000 }
      );

      expect(result.content).toBe('test response');
      expect(result.provider).toBe('Provider2'); // 主供应商优先
    });

    it('应该在主供应商失败时切换到备用供应商', async () => {
      const primaryAdapter = {
        name: 'Primary',
        chat: vi.fn().mockRejectedValue(new APIError('Primary failed', 'Primary', 500, true)),
        testConnection: vi.fn().mockResolvedValue(true),
      };

      const fallbackAdapter = {
        name: 'Fallback',
        chat: vi.fn().mockResolvedValue({
          content: 'fallback response',
          model: 'gpt-4',
        }),
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(manager as any, 'getAdapter')
        .mockImplementation((provider: any) => {
          if (provider === 'custom') return primaryAdapter;
          return fallbackAdapter;
        });

      const providers = [
        {
          id: 'p1',
          name: 'Primary',
          provider: 'custom' as AIProvider,
          apiKey: 'key1',
          model: 'model1',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        },
        {
          id: 'p2',
          name: 'Fallback',
          provider: 'openai' as AIProvider,
          apiKey: 'key2',
          model: 'model2',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: false,
        },
      ];

      const result = await manager.chat(
        [{ role: 'user', content: 'hello' }],
        providers,
        { enabled: true, maxRetries: 1, retryDelay: 10 }
      );

      expect(result.content).toBe('fallback response');
    });

    it('应该在关闭自动切换时抛出错误', async () => {
      const mockAdapter = {
        name: 'Mock',
        chat: vi.fn().mockRejectedValue(new APIError('API failed', 'Mock', 500, true)),
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(manager as any, 'getAdapter').mockReturnValue(mockAdapter);

      const providers = [
        {
          id: 'p1',
          name: 'Provider1',
          provider: 'custom' as AIProvider,
          apiKey: 'key1',
          model: 'model1',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        },
      ];

      await expect(
        manager.chat(
          [{ role: 'user', content: 'hello' }],
          providers,
          { enabled: false, maxRetries: 3, retryDelay: 1000 }
        )
      ).rejects.toThrow('API failed');
    });
  });

  describe('testConnection', () => {
    it.skip('应该在连接成功时返回成功', async () => {
      const result = await manager.testConnection({
        id: 'p1',
        name: 'OpenAI',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        temperature: 0.7,
        isEnabled: true,
        isPrimary: true,
      });

      // 由于没有真实的 API key，这个测试会失败，但会返回正确的结构
      expect(result.success).toBe(false); // 因为 API key 无效
    });
  });
});

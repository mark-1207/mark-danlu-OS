import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZhipuEmbeddingProvider } from '../../../../src/providers/embedding/implementations/zhipu.js';

interface MockFetchCall {
  url: string;
  init: RequestInit;
}

describe('ZhipuEmbeddingProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let mockCalls: MockFetchCall[];

  beforeEach(() => {
    mockCalls = [];
    fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      mockCalls.push({ url: urlStr, init: init ?? {} });
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }], usage: { total_tokens: 42 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('T1: posts to https://open.bigmodel.cn/api/paas/v4/embeddings', async () => {
    const provider = new ZhipuEmbeddingProvider('test-key');
    await provider.embed({ text: 'hello' });
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0].url).toBe('https://open.bigmodel.cn/api/paas/v4/embeddings');
  });

  it('T2: sends Authorization: Bearer <key> header', async () => {
    const provider = new ZhipuEmbeddingProvider('my-secret-key');
    await provider.embed({ text: 'hi' });
    const headers = mockCalls[0].init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-secret-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('T3: defaults model to embedding-3; options.model overrides', async () => {
    const provider = new ZhipuEmbeddingProvider('k');
    await provider.embed({ text: 'a' });
    const body1 = JSON.parse(mockCalls[0].init.body as string);
    expect(body1.model).toBe('embedding-3');

    await provider.embed({ text: 'b', model: 'embedding-2' });
    const body2 = JSON.parse(mockCalls[1].init.body as string);
    expect(body2.model).toBe('embedding-2');
  });

  it('T4: truncates input to 8000 characters', async () => {
    const provider = new ZhipuEmbeddingProvider('k');
    const longText = 'x'.repeat(10000);
    await provider.embed({ text: longText });
    const body = JSON.parse(mockCalls[0].init.body as string);
    expect(body.input).toHaveLength(8000);
  });

  it('T5: returns { embedding, tokens } parsed from response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ embedding: [0.5, 0.6, 0.7, 0.8] }],
          usage: { total_tokens: 99 },
        }),
        { status: 200 },
      ),
    );
    const provider = new ZhipuEmbeddingProvider('k');
    const result = await provider.embed({ text: 'foo' });
    expect(result.embedding).toEqual([0.5, 0.6, 0.7, 0.8]);
    expect(result.tokens).toBe(99);
  });

  it('T6: throws with status code on HTTP 4xx/5xx (401 is fatal, no retry)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    }));
    const provider = new ZhipuEmbeddingProvider('k');
    await expect(provider.embed({ text: 'x' })).rejects.toThrow(/401/);
  });

  it('T7: withRetry retries on transient failure and succeeds on second attempt', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ embedding: [1, 2] }], usage: { total_tokens: 5 } }),
          { status: 200 },
        ),
      );
    const provider = new ZhipuEmbeddingProvider('k');
    const result = await provider.embed({ text: 'retry-me' });
    expect(result.embedding).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

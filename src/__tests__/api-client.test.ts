import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiJson, apiErrorMessage, isUnauthorized, ApiError } from '@/lib/api-client';

/** 构造一个最小 Response 形状的对象 */
function makeResponse(
  ok: boolean,
  status: number,
  body: unknown,
  rawText?: string
): {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
} {
  const text = rawText !== undefined ? rawText : JSON.stringify(body);
  return { ok, status, text: async () => text };
}

describe('apiJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('2xx 返回解析后的 JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse(true, 200, { hello: 'world' }))
    );
    await expect(apiJson('/api/x')).resolves.toEqual({ hello: 'world' });
  });

  it('非 2xx 抛出携带服务端 error 字段的 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse(false, 400, { error: 'Invalid input' }))
    );
    const err = await apiJson('/api/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).message).toBe('Invalid input');
  });

  it('非 2xx 且无 error 字段时回退到 HTTP 状态码文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse(false, 500, {}))
    );
    const err = (await apiJson('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(500);
    expect(err.message).toBe('HTTP 500');
  });

  it('响应体不是合法 JSON 时按空数据处理', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeResponse(false, 502, null, '<html>bad gateway</html>'))
    );
    const err = (await apiJson('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    // 非 JSON 错误响应应携带响应体片段，便于看清具体错在哪（如网关错误页）
    expect(err.message).toContain('bad gateway');
  });

  it('网络错误抛出 status=0 的 ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      })
    );
    const err = (await apiJson('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(0);
    expect(err.message).toBe('network down');
  });

  it('超时后中止请求并抛出 status=0 的 ApiError', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('aborted', 'AbortError'));
              });
            })
        )
      );
      const pending = apiJson('/api/slow', { timeoutMs: 20 });
      const assertion = expect(pending).rejects.toMatchObject({ status: 0 });
      await vi.advanceTimersByTimeAsync(30);
      await assertion;
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe('apiErrorMessage', () => {
  it('服务端错误原样透出 message', () => {
    const err = new ApiError(400, '名称过长');
    expect(apiErrorMessage(err, 'fallback')).toBe('名称过长');
  });

  it('网络错误/超时回退到本地化文案', () => {
    const err = new ApiError(0, 'timeout after 20000ms');
    expect(apiErrorMessage(err, '加载失败')).toBe('加载失败');
  });

  it('普通 Error 回退到本地化文案', () => {
    expect(apiErrorMessage(new Error('boom'), '加载失败')).toBe('加载失败');
  });
});

describe('isUnauthorized', () => {
  it('401 判定为登录态失效', () => {
    expect(isUnauthorized(new ApiError(401, 'Not authenticated'))).toBe(true);
  });

  it('其他状态码判定为否', () => {
    expect(isUnauthorized(new ApiError(403, 'Forbidden'))).toBe(false);
    expect(isUnauthorized(new Error('x'))).toBe(false);
  });
});

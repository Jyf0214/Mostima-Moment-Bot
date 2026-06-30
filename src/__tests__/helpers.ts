/**
 * 测试工具函数
 *
 * 提供共享的 mock 工厂函数，减少测试文件中的 `as any` 类型断言。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// ============================================================
// Mock 请求/响应工厂
// ============================================================

/**
 * 创建模拟的 NextApiRequest 对象
 */
export function createMockReq(
  opts: {
    method?: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextApiRequest {
  const body = opts.body || {};
  return {
    method: opts.method || 'GET',
    query: opts.query || {},
    body,
    cookies: opts.cookies || {},
    headers: opts.headers || {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify(body));
    },
  } as any as NextApiRequest;
}

/**
 * 创建模拟的 NextApiResponse 对象
 */
export function createMockRes(): NextApiResponse & {
  _getStatusCode(): number;
  _getData(): string;
} {
  let statusCode = 200;
  let responseData: unknown = null;

  const res: any = {
    status: vi.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn().mockImplementation((data: unknown) => {
      responseData = data;
      return res;
    }),
    setHeader: vi.fn().mockReturnThis(),
    _getStatusCode: () => statusCode,
    _getData: () => JSON.stringify(responseData),
  };

  return res;
}

// ============================================================
// JWT 工具
// ============================================================

/**
 * 生成测试用 JWT token
 */
export function createTestToken(payload: Record<string, unknown>, options?: jwt.SignOptions) {
  return jwt.sign(payload, JWT_SECRET, options || { expiresIn: '1h' });
}

/**
 * 解码 JWT 并返回完整载荷（带类型）
 */
export function decodeToken(token: string): Record<string, unknown> {
  return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
}

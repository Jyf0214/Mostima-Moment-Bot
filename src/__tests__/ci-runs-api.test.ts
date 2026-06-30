import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockReq, createMockRes, createTestToken } from './helpers';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    ciRun: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import handler from '@/pages/api/ci/runs';

function mockReqRes(
  method: string,
  opts: {
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
) {
  const req = createMockReq({ method, ...opts });
  const res = createMockRes();
  return {
    req,
    res,
    getResponse: () => ({ statusCode: res._getStatusCode(), data: res._getData() }),
  };
}

describe('/api/ci/runs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_KEY = 'test-internal-key';
  });

  describe('GET /api/ci/runs', () => {
    it('应该拒绝未认证的请求', async () => {
      const { req, res } = mockReqRes('GET', { query: { repo: 'owner/repo' } });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Not authenticated' });
    });

    it('应该拒绝无效 token', async () => {
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo' },
        cookies: { auth_token: 'invalid-token' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid token' });
    });

    it('缺少 repo 参数时应返回仓库列表', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([
        {
          repoFullName: 'owner/repo',
          status: 'success',
          createdAt: new Date(),
          event: 'push',
          branch: 'main',
        },
      ]);
      mockPrisma.ciRun.count.mockResolvedValue(10);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        cookies: { auth_token: token },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.repos).toBeDefined();
      expect(Array.isArray(data.repos)).toBe(true);
    });

    it('应该正确查询仓库运行日志', async () => {
      const mockRuns = [
        { id: 1, event: 'push', status: 'success', branch: 'main' },
        { id: 2, event: 'pull_request', status: 'failure', branch: 'feature' },
      ];
      mockPrisma.ciRun.findMany.mockResolvedValue(mockRuns);
      mockPrisma.ciRun.count.mockResolvedValue(2);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.runs).toEqual(mockRuns);
      expect(data.total).toBe(2);
      expect(data.limit).toBe(50);
      expect(data.offset).toBe(0);
    });

    it('应该支持 limit 和 offset 分页参数', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([]);
      mockPrisma.ciRun.count.mockResolvedValue(100);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo', limit: '10', offset: '20' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(20);

      const findManyArgs = mockPrisma.ciRun.findMany.mock.calls[0][0];
      expect(findManyArgs.take).toBe(10);
      expect(findManyArgs.skip).toBe(20);
    });

    it('limit 不应超过 200', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([]);
      mockPrisma.ciRun.count.mockResolvedValue(0);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo', limit: '500' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.limit).toBe(200);
    });

    it('offset 为负数时应归零', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([]);
      mockPrisma.ciRun.count.mockResolvedValue(0);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo', offset: '-5' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.offset).toBe(0);
    });

    it('列表查询不应返回 logs 字段', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([{ id: 1 }]);
      mockPrisma.ciRun.count.mockResolvedValue(1);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      const findManyArgs = mockPrisma.ciRun.findMany.mock.calls[0][0];
      expect(findManyArgs.select.logs).toBe(false);
    });

    it('数据库查询失败时应返回 500', async () => {
      mockPrisma.ciRun.findMany.mockRejectedValue(new Error('DB error'));

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Failed to query CI runs');
    });

    it('应该拒绝非 GET/POST 方法', async () => {
      const { req, res } = mockReqRes('DELETE');

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
    });

    it('应该按 createdAt 降序排列', async () => {
      mockPrisma.ciRun.findMany.mockResolvedValue([]);
      mockPrisma.ciRun.count.mockResolvedValue(0);

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('GET', {
        query: { repo: 'owner/repo' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      const findManyArgs = mockPrisma.ciRun.findMany.mock.calls[0][0];
      expect(findManyArgs.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('POST /api/ci/runs', () => {
    it('应该创建运行记录', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 42 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          status: 'success',
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.runId).toBe(42);
    });

    it('缺少必要字段时应返回 400', async () => {
      const { req, res } = mockReqRes('POST', {
        body: { repo: 'owner/repo' },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Missing required fields: repo, event',
      });
    });

    it('repo 无效类型应返回 400', async () => {
      const { req, res } = mockReqRes('POST', {
        body: { repo: 123, event: 'push' },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid repo' });
    });

    it('repo 超长应返回 400', async () => {
      const { req, res } = mockReqRes('POST', {
        body: { repo: 'a'.repeat(256), event: 'push' },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid repo' });
    });

    it('无效 status 应回退到 pending', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          status: 'invalid-status',
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('pending');
    });

    it('日志大小应限制在 50KB', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          logs: 'x'.repeat(60000),
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.logs).toHaveLength(50000);
    });

    it('checksRan 应正确传递数组', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'pull_request',
          checksRan: ['lint', 'build'],
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.checksRan).toEqual(['lint', 'build']);
    });

    it('非数组的 checksRan 应回退到空数组', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          checksRan: 'not-an-array',
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.checksRan).toEqual([]);
    });

    it('running 状态应设置 startedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          status: 'running',
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.startedAt).toBeInstanceOf(Date);
      expect(createArgs.data.completedAt).toBeNull();
    });

    it('success 状态应设置 completedAt', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const { req, res } = mockReqRes('POST', {
        body: {
          repo: 'owner/repo',
          event: 'push',
          status: 'success',
        },
        headers: { authorization: 'Bearer test-internal-key' },
      });

      await handler(req, res);

      const createArgs = mockPrisma.ciRun.create.mock.calls[0][0];
      expect(createArgs.data.completedAt).toBeInstanceOf(Date);
      expect(createArgs.data.startedAt).toBeNull();
    });

    it('应该通过 JWT cookie 认证', async () => {
      mockPrisma.ciRun.create.mockResolvedValue({ id: 1 });

      const token = createTestToken({ githubId: 12345 });
      const { req, res } = mockReqRes('POST', {
        body: { repo: 'owner/repo', event: 'push' },
        cookies: { auth_token: token },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });
  });
});

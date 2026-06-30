import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getJwtSecret, verifyAuthToken, requireAuth, requireAdmin } from '@/lib/auth-utils';
import { createMockReq, createMockRes } from './helpers';

describe('认证工具函数', () => {
  const JWT_SECRET = 'test-jwt-secret-key';

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('getJwtSecret', () => {
    it('应该返回配置的 JWT_SECRET', () => {
      expect(getJwtSecret()).toBe(JWT_SECRET);
    });

    it('JWT_SECRET 未配置时应该抛出错误', () => {
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is not configured');
    });

    it('JWT_SECRET 为空字符串时应该抛出错误', () => {
      process.env.JWT_SECRET = '';
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is not configured');
    });
  });

  describe('verifyAuthToken', () => {
    it('应该正确验证有效 token', () => {
      const payload = { githubId: 12345, githubLogin: 'testuser', isAdmin: true };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const result = verifyAuthToken(token);

      expect(result.githubId).toBe(12345);
      expect(result.githubLogin).toBe('testuser');
      expect(result.isAdmin).toBe(true);
    });

    it('应该拒绝使用错误密钥签名的 token', () => {
      const token = jwt.sign({ githubId: 1 }, 'wrong-secret', { expiresIn: '1h' });
      expect(() => verifyAuthToken(token)).toThrow();
    });

    it('应该拒绝过期的 token', () => {
      vi.useFakeTimers();
      const token = jwt.sign({ githubId: 1 }, JWT_SECRET, { expiresIn: '1s' });
      vi.advanceTimersByTime(2000);
      expect(() => verifyAuthToken(token)).toThrow('jwt expired');
      vi.useRealTimers();
    });

    it('应该拒绝空 token', () => {
      expect(() => verifyAuthToken('')).toThrow();
    });

    it('应该拒绝非 JWT 格式的字符串', () => {
      expect(() => verifyAuthToken('not-a-jwt-token')).toThrow();
    });
  });

  describe('requireAuth', () => {
    function createMockReqRes(cookies: Record<string, string> = {}) {
      const req = createMockReq({ cookies });
      const res = createMockRes();
      return { req, res };
    }

    it('有效 token 应该返回用户载荷', async () => {
      const payload = { githubId: 12345, githubLogin: 'user', isAdmin: false };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const { req, res } = createMockReqRes({ auth_token: token });

      const result = await requireAuth(req, res);
      expect(result).not.toBeNull();
      expect(result!.githubId).toBe(12345);
    });

    it('缺少 auth_token cookie 时应该返回 401', async () => {
      const { req, res } = createMockReqRes({});
      const result = await requireAuth(req, res);

      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });

    it('无效 token 时应该返回 401', async () => {
      const { req, res } = createMockReqRes({ auth_token: 'invalid-token' });
      const result = await requireAuth(req, res);

      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });
  });

  describe('requireAdmin', () => {
    function createMockReqRes(cookies: Record<string, string> = {}) {
      const req = createMockReq({ cookies });
      const res = createMockRes();
      return { req, res };
    }

    it('管理员 token 应该返回载荷', async () => {
      const payload = { githubId: 1, githubLogin: 'admin', isAdmin: true };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const { req, res } = createMockReqRes({ auth_token: token });

      const result = await requireAdmin(req, res);
      expect(result).not.toBeNull();
      expect(result!.isAdmin).toBe(true);
    });

    it('非管理员 token 应该返回 403', async () => {
      const payload = { githubId: 2, githubLogin: 'user', isAdmin: false };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      const { req, res } = createMockReqRes({ auth_token: token });

      const result = await requireAdmin(req, res);
      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin only' });
    });

    it('未认证请求应该返回 401', async () => {
      const { req, res } = createMockReqRes({});
      const result = await requireAdmin(req, res);

      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('无效 token 应该返回 401', async () => {
      const { req, res } = createMockReqRes({ auth_token: 'bad-token' });
      const result = await requireAdmin(req, res);

      expect(result).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});

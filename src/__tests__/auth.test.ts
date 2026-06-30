import { vi, describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('JWT 认证', () => {
  const testUser = {
    githubId: 12345,
    githubLogin: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    isAdmin: true,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该正确生成和验证 JWT', () => {
    const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;

    expect(decoded.githubId).toBe(testUser.githubId);
    expect(decoded.githubLogin).toBe(testUser.githubLogin);
    expect(decoded.avatarUrl).toBe(testUser.avatarUrl);
    expect(decoded.isAdmin).toBe(testUser.isAdmin);
  });

  it('应该拒绝无效的 JWT', () => {
    const token = jwt.sign(testUser, 'wrong-secret', { expiresIn: '7d' });

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow('invalid signature');
  });

  it('应该拒绝过期的 JWT', () => {
    vi.useFakeTimers();

    try {
      // 签发时设置过期时间为 1 秒
      const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1s' });

      // 模拟时间前进 2 秒，确保 token 已过期
      vi.advanceTimersByTime(2000);

      expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('应该包含正确的过期时间', () => {
    const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;

    const now = Math.floor(Date.now() / 1000);
    const expectedExp = now + 7 * 24 * 60 * 60;

    // 允许 10 秒的误差
    expect(decoded.exp).toBeGreaterThan(now);
    expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 10);
  });
});
